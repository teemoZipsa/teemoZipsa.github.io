(function () {
  'use strict';

  const STORAGE_KEY = 'teemo_daily_quest_v1';
  const STATE_VERSION = 1;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const numberFormat = new Intl.NumberFormat('ko-KR');

  const MISSIONS = {
    starter5: {
      id: 'starter5', icon: '🌱', minutes: 5, coins: 6, xp: 7,
      title: '5분 동안 가장 작은 시작 하나 만들기',
      description: '미뤄둔 일의 첫 동작만 해도 충분해요. 파일을 열거나, 첫 문장을 쓰거나, 도구를 꺼내 보세요.',
      target: '미뤄둔 일의 첫 동작 하나',
      goals: ['시작할 행동을 한 문장으로 정했다', '5분 동안 그 행동을 실제로 이어갔다']
    },
    focus25: {
      id: 'focus25', icon: '🧠', minutes: 25, coins: 20, xp: 25,
      title: '25분 동안 핵심 작업 한 덩어리 끝내기',
      description: '가장 중요한 결과 하나를 정하고, 알림이 울릴 때까지 그 일에만 집중해 보세요.',
      target: '가장 중요한 작업 한 가지',
      goals: ['끝낼 결과를 한 줄로 정했다', '타이머가 끝날 때까지 한 일에 집중했다']
    },
    tidy10: {
      id: 'tidy10', icon: '🧹', minutes: 10, coins: 10, xp: 12,
      title: '10분 동안 눈앞의 한 구역 정리하기',
      description: '범위를 작게 잡는 것이 핵심이에요. 책상 한쪽, 받은 편지함, 다운로드 폴더 중 하나만 정리하세요.',
      target: '책상 또는 폴더 한 구역',
      goals: ['정리할 범위를 한 구역으로 제한했다', '필요한 것과 치울 것을 실제로 나눴다']
    },
    move15: {
      id: 'move15', icon: '💪', minutes: 15, coins: 13, xp: 16,
      title: '15분 동안 몸을 깨우고 다시 돌아오기',
      description: '가벼운 스트레칭, 산책, 맨몸 운동 중 오늘 가능한 움직임 하나를 골라 끝까지 해보세요.',
      target: '오늘 가능한 움직임 한 가지',
      goals: ['할 움직임과 범위를 미리 정했다', '무리하지 않고 15분 동안 몸을 움직였다']
    }
  };

  const SHOP_ITEMS = [
    {
      id: 'cozy_cushion', icon: '🛋️', name: '폭신한 방석', price: 30, slot: 'scene', tag: '아지트',
      description: '티모의 아지트에 포근한 방석을 놓아요.', avatar: '🛋️'
    },
    {
      id: 'focus_headset', icon: '🎧', name: '집중 헤드셋', price: 55, slot: 'outfit', tag: '경험치 +3',
      description: '장착한 동안 퀘스트마다 경험치를 3 더 받아요.', avatar: '🎧', xpBonus: 3
    },
    {
      id: 'lucky_bell', icon: '🔔', name: '행운의 방울', price: 80, slot: 'charm', tag: '냥 +3',
      description: '장착한 동안 완료 퀘스트마다 3냥을 더 받아요.', avatar: '🔔', coinBonus: 3
    },
    {
      id: 'focus_cape', icon: '🦸', name: '집중 망토', price: 120, slot: 'outfit', tag: '경험치 +6',
      description: '집중 헤드셋보다 큰 경험치 보너스를 주는 의상이에요.', avatar: '🦸', xpBonus: 6
    },
    {
      id: 'streak_shield', icon: '🛡️', name: '연속 보호권', price: 100, type: 'consumable', tag: '소모품',
      description: '하루를 놓쳤을 때 다음 퀘스트 완료 시 연속 기록을 한 번 지켜줘요.'
    },
    {
      id: 'star_window', icon: '🌠', name: '별빛 창문', price: 180, slot: 'scene', tag: '아지트',
      description: '퀘스트 아지트의 배경을 반짝이는 밤으로 바꿔요.', avatar: '🌠'
    }
  ];

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function safeText(value, fallback, maxLength) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return (trimmed || fallback).slice(0, maxLength || 120);
  }

  function defaultState() {
    return {
      version: STATE_VERSION,
      coins: 0,
      xp: 0,
      totalCompleted: 0,
      streak: 0,
      lastCompletedDate: '',
      history: [],
      selectedMissionId: 'focus25',
      targets: {},
      owned: [],
      equipped: { scene: '', outfit: '', charm: '' },
      shields: 0,
      pendingReview: null,
      activeSession: null
    };
  }

  function normalizeMissionSnapshot(value) {
    if (!value || typeof value !== 'object') return null;
    const base = MISSIONS[value.id] || MISSIONS.focus25;
    const goals = Array.isArray(value.goals)
      ? value.goals.slice(0, 4).map((goal, index) => safeText(goal, base.goals[index] || '완료 조건을 지켰다', 100))
      : base.goals.slice();
    return {
      id: base.id,
      icon: base.icon,
      title: safeText(value.title, base.title, 100),
      target: safeText(value.target, base.target, 80),
      goals,
      coins: Math.round(clampNumber(value.coins, 0, 500, base.coins)),
      xp: Math.round(clampNumber(value.xp, 0, 500, base.xp)),
      durationMs: Math.round(clampNumber(value.durationMs, 1000, 99 * 60 * 60 * 1000, base.minutes * 60000)),
      createdAt: Math.round(clampNumber(value.createdAt, 0, Date.now() + DAY_MS, Date.now()))
    };
  }

  function normalizeState(raw) {
    const clean = defaultState();
    if (!raw || typeof raw !== 'object') return clean;
    clean.coins = Math.round(clampNumber(raw.coins, 0, 1000000, 0));
    clean.xp = Math.round(clampNumber(raw.xp, 0, 10000000, 0));
    clean.totalCompleted = Math.round(clampNumber(raw.totalCompleted, 0, 1000000, 0));
    clean.streak = Math.round(clampNumber(raw.streak, 0, 100000, 0));
    clean.lastCompletedDate = /^\d{4}-\d{2}-\d{2}$/.test(raw.lastCompletedDate || '') ? raw.lastCompletedDate : '';
    clean.selectedMissionId = MISSIONS[raw.selectedMissionId] ? raw.selectedMissionId : 'focus25';
    clean.shields = Math.round(clampNumber(raw.shields, 0, 999, 0));

    if (raw.targets && typeof raw.targets === 'object') {
      Object.keys(MISSIONS).forEach(id => {
        if (typeof raw.targets[id] === 'string') clean.targets[id] = safeText(raw.targets[id], MISSIONS[id].target, 80);
      });
    }

    const allowedItemIds = new Set(SHOP_ITEMS.map(item => item.id).filter(id => id !== 'streak_shield'));
    clean.owned = Array.isArray(raw.owned)
      ? Array.from(new Set(raw.owned.filter(id => allowedItemIds.has(id))))
      : [];
    ['scene', 'outfit', 'charm'].forEach(slot => {
      const item = SHOP_ITEMS.find(candidate => candidate.id === raw.equipped?.[slot]);
      if (item && item.slot === slot && clean.owned.includes(item.id)) clean.equipped[slot] = item.id;
    });

    clean.history = Array.isArray(raw.history) ? raw.history.slice(0, 30).map(entry => {
      const mission = normalizeMissionSnapshot(entry);
      if (!mission) return null;
      return {
        ...mission,
        completedAt: Math.round(clampNumber(entry.completedAt, 0, Date.now() + DAY_MS, Date.now())),
        dateKey: /^\d{4}-\d{2}-\d{2}$/.test(entry.dateKey || '') ? entry.dateKey : localDateKey(new Date(entry.completedAt || Date.now()))
      };
    }).filter(Boolean) : [];

    clean.pendingReview = normalizeMissionSnapshot(raw.pendingReview);
    if (clean.pendingReview && raw.pendingReview.completedAt) {
      clean.pendingReview.completedAt = Math.round(clampNumber(raw.pendingReview.completedAt, 0, Date.now() + DAY_MS, Date.now()));
    }
    if (raw.activeSession && typeof raw.activeSession === 'object') {
      const mission = normalizeMissionSnapshot(raw.activeSession.mission);
      if (mission) {
        clean.activeSession = {
          mission,
          status: raw.activeSession.status === 'paused' ? 'paused' : 'running',
          endAt: Math.round(clampNumber(raw.activeSession.endAt, 0, Date.now() + 7 * DAY_MS, 0)),
          remaining: Math.round(clampNumber(raw.activeSession.remaining, 0, 99 * 60 * 60 * 1000, mission.durationMs))
        };
      }
    }
    return clean;
  }

  function loadState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
    } catch (_error) {
      return defaultState();
    }
  }

  let state = loadState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function dateKeyDifference(previous, current) {
    if (!previous || !current) return Infinity;
    const [py, pm, pd] = previous.split('-').map(Number);
    const [cy, cm, cd] = current.split('-').map(Number);
    return Math.round((new Date(cy, cm - 1, cd, 12) - new Date(py, pm - 1, pd, 12)) / DAY_MS);
  }

  function currentLevel() {
    return Math.floor(state.xp / 100) + 1;
  }

  function levelTitle(level) {
    if (level >= 10) return '전설의 집사';
    if (level >= 7) return '몰입 수호자';
    if (level >= 4) return '꾸준한 집사';
    if (level >= 2) return '집중 탐험가';
    return '새싹 집사';
  }

  function itemById(id) {
    return SHOP_ITEMS.find(item => item.id === id) || null;
  }

  function rewardBonuses() {
    const outfit = itemById(state.equipped.outfit);
    const charm = itemById(state.equipped.charm);
    return {
      coins: (outfit?.coinBonus || 0) + (charm?.coinBonus || 0),
      xp: (outfit?.xpBonus || 0) + (charm?.xpBonus || 0)
    };
  }

  function configuredMission() {
    const base = MISSIONS[state.selectedMissionId] || MISSIONS.focus25;
    const durationMs = Math.max(1000, getTimerMs() || base.minutes * 60000);
    const roundedMinutes = Math.max(1, Math.round(durationMs / 60000));
    const adjusted = Math.abs(durationMs - base.minutes * 60000) > 1000;
    const bonuses = rewardBonuses();
    const baseCoins = adjusted ? Math.min(80, Math.max(3, Math.ceil(roundedMinutes * 0.8))) : base.coins;
    const baseXp = adjusted ? Math.min(120, Math.max(5, roundedMinutes)) : base.xp;
    return {
      ...base,
      title: adjusted ? `${roundedMinutes}분 동안 ${base.title.replace(/^\d+분 동안 /, '')}` : base.title,
      durationMs,
      coins: baseCoins + bonuses.coins,
      xp: baseXp + bonuses.xp,
      baseCoins,
      baseXp,
      coinBonus: bonuses.coins,
      xpBonus: bonuses.xp
    };
  }

  function missionSnapshot(source) {
    const mission = source || configuredMission();
    const targetInput = $('#missionTarget');
    const target = safeText(targetInput?.value, mission.target, 80);
    return {
      id: mission.id,
      icon: mission.icon,
      title: mission.title,
      target,
      goals: mission.goals.slice(),
      coins: mission.coins,
      xp: mission.xp,
      durationMs: mission.durationMs,
      createdAt: Date.now()
    };
  }

  function setTimerDuration(milliseconds) {
    const totalSeconds = Math.max(1, Math.round(milliseconds / 1000));
    $('#tHour').value = Math.floor(totalSeconds / 3600);
    $('#tMin').value = Math.floor((totalSeconds % 3600) / 60);
    $('#tSec').value = totalSeconds % 60;
    timerRemaining = milliseconds;
    timerFinished = false;
    updateDisplay();
  }

  function renderMissionSummary() {
    const mission = configuredMission();
    $('#missionTitle').textContent = mission.title;
    $('#missionDescription').textContent = mission.description;
    $('#missionCoinReward').textContent = numberFormat.format(mission.coins);
    $('#missionXpReward').textContent = numberFormat.format(mission.xp);
    const bonuses = [];
    if (mission.coinBonus) bonuses.push(`방울 +${mission.coinBonus}냥`);
    if (mission.xpBonus) bonuses.push(`장비 +${mission.xpBonus} XP`);
    $('#rewardBonusText').textContent = bonuses.length ? bonuses.join(' · ') : '기본 보상';

    const goals = $('#missionGoals');
    goals.replaceChildren(...mission.goals.map((goal, index) => {
      const span = document.createElement('span');
      span.className = 'mission-goal';
      span.textContent = `${index + 1} ${goal}`;
      return span;
    }));
    $('#timerRewardSummary').lastElementChild.innerHTML = `완료 확인 후 <strong>${numberFormat.format(mission.coins)}냥과 경험치 ${numberFormat.format(mission.xp)}</strong>가 게임에 바로 반영돼요.`;
    renderLinkedMission();
  }

  function selectMission(id, options) {
    const mission = MISSIONS[id];
    if (!mission) return;
    if (running) {
      showToast('진행 중에는 퀘스트를 바꿀 수 없어요.');
      return;
    }
    if (state.pendingReview) {
      showToast('먼저 끝난 퀘스트의 완료 여부를 확인해 주세요.');
      openReviewDialog();
      return;
    }
    state.selectedMissionId = id;
    const savedTarget = state.targets[id];
    $('#missionTarget').value = savedTarget || mission.target;
    setTimerDuration(mission.minutes * 60000);
    $$('.mission-choice').forEach(button => {
      const selected = button.dataset.mission === id;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    saveState();
    renderMissionSummary();
    updateTimerStatus('ready');
    if (!options?.silent) showToast(`${mission.icon} ${mission.minutes}분 퀘스트로 설정했어요.`);
  }

  function setMissionControlsDisabled(disabled) {
    $$('.mission-choice').forEach(button => { button.disabled = disabled; });
    $('#missionTarget').readOnly = disabled;
  }

  function updateTimerStatus(status) {
    const box = $('#timerStatus');
    box.classList.toggle('running', status === 'running');
    box.classList.toggle('pending', status === 'pending');
    const pending = Boolean(state.pendingReview);
    $('#reviewPendingBtn').hidden = !pending;
    if (status === 'running') {
      $('#timerPhase').textContent = '퀘스트 진행 중';
      $('#timerContext').textContent = state.activeSession?.mission.target || '정한 일에 집중하고 있어요.';
    } else if (status === 'paused') {
      $('#timerPhase').textContent = '잠시 멈춤';
      $('#timerContext').textContent = '준비되면 이어서 시작하세요. 기록은 이 기기에 남아 있어요.';
    } else if (status === 'pending') {
      $('#timerPhase').textContent = '완료 확인 대기';
      $('#timerContext').textContent = state.pendingReview?.target || '완료 조건을 확인해 주세요.';
    } else if (mode === 'stopwatch') {
      $('#timerPhase').textContent = '자유 측정';
      $('#timerContext').textContent = '스톱워치는 게임 보상 없이 자유롭게 기록합니다.';
    } else {
      $('#timerPhase').textContent = '준비됨';
      $('#timerContext').textContent = '퀘스트를 고르고 재생 버튼을 눌러주세요.';
    }
  }

  function switchJourney(name, focusTab) {
    const names = ['mission', 'game', 'shop'];
    if (!names.includes(name)) return;
    $$('.journey-tab').forEach(tab => {
      const active = tab.dataset.journey === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    names.forEach(panelName => {
      const panel = $(`#journey${panelName[0].toUpperCase()}${panelName.slice(1)}Panel`);
      panel.hidden = panelName !== name;
      panel.classList.toggle('active', panelName === name);
    });
    if (name === 'game') renderGame();
    if (name === 'shop') renderShop();
    if (focusTab) $(`.journey-tab[data-journey="${name}"]`)?.focus();
  }

  function renderHeader() {
    const level = currentLevel();
    $('#headerLevel').textContent = numberFormat.format(level);
    $('#headerCoins').textContent = numberFormat.format(state.coins);
    $('#gameCoinCount').textContent = numberFormat.format(state.coins);
    $('#shopCoinCount').textContent = numberFormat.format(state.coins);
  }

  function renderAvatar() {
    const scene = itemById(state.equipped.scene);
    const outfit = itemById(state.equipped.outfit);
    const charm = itemById(state.equipped.charm);
    $('#avatarScene').textContent = scene?.avatar || '';
    $('#avatarOutfit').textContent = outfit?.avatar || '';
    $('#avatarCharm').textContent = charm?.avatar || '';
  }

  function renderLinkedMission() {
    const mission = state.pendingReview || state.activeSession?.mission || configuredMission();
    $('#gameCurrentMission').textContent = mission.title;
    let stateText = `준비됨 · 완료 시 ${numberFormat.format(mission.coins)}냥`;
    let actionText = '타이머 열기';
    if (state.pendingReview) {
      stateText = '타이머 완료 · 확인 대기';
      actionText = '완료 확인';
    } else if (state.activeSession) {
      stateText = state.activeSession.status === 'paused' ? '잠시 멈춤 · 이어서 가능' : '타이머 진행 중';
      actionText = '타이머 보기';
    }
    $('#gameCurrentMissionState').textContent = stateText;
    $('#gameMissionAction').textContent = actionText;
  }

  function renderWeeklyTrail() {
    const container = $('#weeklyTrail');
    const today = new Date();
    const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
    let weekCount = 0;
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset, 12);
      const key = localDateKey(date);
      const count = state.history.filter(item => item.dateKey === key).length;
      weekCount += count;
      const item = document.createElement('div');
      item.className = `trail-day${count ? ' complete' : ''}${offset === 0 ? ' today' : ''}`;
      item.setAttribute('aria-label', `${date.getMonth() + 1}월 ${date.getDate()}일, 완료 ${count}회`);
      const label = document.createElement('strong');
      label.textContent = dayLabels[date.getDay()];
      const dot = document.createElement('span');
      dot.className = 'trail-dot';
      dot.textContent = count ? String(count) : '·';
      const number = document.createElement('small');
      number.textContent = String(date.getDate());
      item.append(label, dot, number);
      days.push(item);
    }
    container.replaceChildren(...days);
    $('#weeklySummary').textContent = `이번 주 ${numberFormat.format(weekCount)}회`;
  }

  function renderHistory() {
    const container = $('#missionHistory');
    if (!state.history.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = '아직 완료 기록이 없어요. 첫 퀘스트를 시작해 보세요.';
      container.replaceChildren(empty);
      return;
    }
    const formatter = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const entries = state.history.slice(0, 8).map(entry => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const icon = document.createElement('span');
      icon.className = 'history-icon';
      icon.textContent = entry.icon;
      const copy = document.createElement('div');
      copy.className = 'history-copy';
      const title = document.createElement('strong');
      title.textContent = entry.target;
      const meta = document.createElement('span');
      meta.textContent = `${formatter.format(new Date(entry.completedAt))} · ${entry.title}`;
      copy.append(title, meta);
      const reward = document.createElement('span');
      reward.className = 'history-reward';
      reward.textContent = `+${numberFormat.format(entry.coins)}냥`;
      item.append(icon, copy, reward);
      return item;
    });
    container.replaceChildren(...entries);
  }

  function renderGame() {
    renderHeader();
    renderAvatar();
    renderLinkedMission();
    renderWeeklyTrail();
    renderHistory();
    const level = currentLevel();
    const progress = state.xp % 100;
    $('#gameLevelBadge').textContent = `레벨 ${numberFormat.format(level)} · ${levelTitle(level)}`;
    $('#xpProgressBar').style.width = `${progress}%`;
    $('#xpTrack').setAttribute('aria-valuenow', String(progress));
    $('#xpProgressText').textContent = `${numberFormat.format(progress)} / 100 XP`;
    $('#nextLevelText').textContent = `다음 레벨까지 ${numberFormat.format(100 - progress)}`;
    $('#totalMissionCount').textContent = numberFormat.format(state.totalCompleted);
    $('#streakCount').textContent = numberFormat.format(state.streak);
    $('#shieldCount').textContent = numberFormat.format(state.shields);
    if (!state.totalCompleted) {
      $('#companionMessage').textContent = '첫 퀘스트를 끝내면 아지트가 열려요.';
    } else if (state.streak >= 7) {
      $('#companionMessage').textContent = `${state.streak}일째 퀘스트를 이어가고 있어요.`;
    } else {
      $('#companionMessage').textContent = `지금까지 ${state.totalCompleted}개의 퀘스트를 끝냈어요.`;
    }
  }

  function createShopCard(item) {
    const article = document.createElement('article');
    const owned = state.owned.includes(item.id);
    const equipped = item.slot && state.equipped[item.slot] === item.id;
    article.className = `shop-item${equipped ? ' equipped' : ''}`;

    const icon = document.createElement('div');
    icon.className = 'shop-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = item.icon;

    const info = document.createElement('div');
    info.className = 'shop-info';
    const nameRow = document.createElement('div');
    nameRow.className = 'shop-name-row';
    const name = document.createElement('h3');
    name.textContent = item.name;
    const tag = document.createElement('span');
    tag.className = 'item-tag';
    tag.textContent = equipped ? '사용 중' : item.tag;
    nameRow.append(name, tag);
    const description = document.createElement('p');
    description.textContent = item.description;

    const bottom = document.createElement('div');
    bottom.className = 'shop-item-bottom';
    const price = document.createElement('span');
    price.className = 'shop-price';
    price.textContent = item.type === 'consumable' && state.shields ? `보유 ${state.shields}개` : `🪙 ${numberFormat.format(item.price)}냥`;
    const button = document.createElement('button');
    button.className = 'shop-action';
    button.type = 'button';
    button.dataset.shopItem = item.id;
    if (item.type === 'consumable') {
      button.dataset.shopAction = 'buy';
      button.textContent = state.coins >= item.price ? '구매하기' : '냥 부족';
      button.disabled = state.coins < item.price;
    } else if (!owned) {
      button.dataset.shopAction = 'buy';
      button.textContent = state.coins >= item.price ? '구매하기' : '냥 부족';
      button.disabled = state.coins < item.price;
    } else if (equipped) {
      button.textContent = '사용 중';
      button.disabled = true;
    } else {
      button.dataset.shopAction = 'equip';
      button.textContent = '사용하기';
    }
    button.setAttribute('aria-label', `${item.name} ${button.textContent}`);
    bottom.append(price, button);
    info.append(nameRow, description, bottom);
    article.append(icon, info);
    return article;
  }

  function renderShop() {
    renderHeader();
    $('#shopGrid').replaceChildren(...SHOP_ITEMS.map(createShopCard));
  }

  function handleShopAction(itemId, action) {
    const item = itemById(itemId);
    if (!item) return;
    if (action === 'buy') {
      if (state.coins < item.price) {
        showToast('퀘스트를 완료해 냥을 더 모아주세요.');
        return;
      }
      state.coins -= item.price;
      if (item.type === 'consumable') {
        state.shields += 1;
        showToast(`🛡️ 연속 보호권을 준비했어요. 현재 ${state.shields}개`);
      } else {
        if (!state.owned.includes(item.id)) state.owned.push(item.id);
        state.equipped[item.slot] = item.id;
        showToast(`${item.icon} ${item.name}을 바로 사용했어요.`);
      }
    } else if (action === 'equip' && state.owned.includes(item.id) && item.slot) {
      state.equipped[item.slot] = item.id;
      showToast(`${item.icon} ${item.name}으로 바꿨어요.`);
    }
    saveState();
    renderShop();
    renderGame();
    renderMissionSummary();
  }

  function renderReviewDialog() {
    const pending = state.pendingReview;
    if (!pending) return;
    $('#reviewStep').hidden = false;
    $('#rewardStep').hidden = true;
    $('#reviewTarget').textContent = pending.target;
    $('#dialogReward').textContent = `완료 보상 · ${numberFormat.format(pending.coins)}냥 + 경험치 ${numberFormat.format(pending.xp)}`;
    const checks = pending.goals.map((goal, index) => {
      const label = document.createElement('label');
      label.className = 'review-check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = String(index);
      input.addEventListener('change', updateClaimButton);
      const text = document.createElement('span');
      text.textContent = goal;
      label.append(input, text);
      return label;
    });
    const legend = document.createElement('legend');
    legend.textContent = '완료 조건';
    $('#reviewChecklist').replaceChildren(legend, ...checks);
    $('#claimRewardBtn').disabled = true;
    $('#claimRewardBtn').textContent = '체크하고 보상 받기';
  }

  function updateClaimButton() {
    const inputs = $$('#reviewChecklist input[type="checkbox"]');
    const complete = inputs.length > 0 && inputs.every(input => input.checked);
    $('#claimRewardBtn').disabled = !complete;
    if (complete && state.pendingReview) {
      $('#claimRewardBtn').textContent = `${numberFormat.format(state.pendingReview.coins)}냥 받고 완료하기`;
    } else {
      $('#claimRewardBtn').textContent = '체크하고 보상 받기';
    }
  }

  function openReviewDialog() {
    if (!state.pendingReview) return;
    renderReviewDialog();
    const dialog = $('#missionReviewDialog');
    if (document.hidden) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    $('#reviewChecklist input')?.focus();
  }

  function applyStreak(completedAt) {
    const dateKey = localDateKey(new Date(completedAt));
    const gap = dateKeyDifference(state.lastCompletedDate, dateKey);
    let shieldUsed = false;
    if (!state.lastCompletedDate) {
      state.streak = 1;
    } else if (gap === 0) {
      state.streak = Math.max(1, state.streak);
    } else if (gap === 1) {
      state.streak += 1;
    } else if (gap === 2 && state.shields > 0) {
      state.shields -= 1;
      state.streak += 1;
      shieldUsed = true;
    } else {
      state.streak = 1;
    }
    state.lastCompletedDate = dateKey;
    return { dateKey, shieldUsed };
  }

  function claimReward() {
    const pending = state.pendingReview;
    if (!pending || $('#claimRewardBtn').disabled) return;
    const previousLevel = currentLevel();
    const completedAt = Date.now();
    const streakResult = applyStreak(completedAt);
    state.coins += pending.coins;
    state.xp += pending.xp;
    state.totalCompleted += 1;
    state.history.unshift({ ...pending, completedAt, dateKey: streakResult.dateKey });
    state.history = state.history.slice(0, 30);
    state.pendingReview = null;
    state.activeSession = null;
    saveState();

    const newLevel = currentLevel();
    $('#reviewStep').hidden = true;
    $('#rewardStep').hidden = false;
    $('#rewardResult').textContent = `+${numberFormat.format(pending.coins)}냥 · 경험치 +${numberFormat.format(pending.xp)}`;
    let message = newLevel > previousLevel
      ? `레벨 ${newLevel}, ${levelTitle(newLevel)}로 성장했어요!`
      : `${state.streak}일 연속 발자국을 이어가고 있어요.`;
    if (streakResult.shieldUsed) message += ' 보호권이 연속 기록을 지켜줬어요.';
    $('#rewardLevelMessage').textContent = message;
    setMissionControlsDisabled(false);
    updateTimerStatus('ready');
    renderHeader();
    renderGame();
    renderShop();
  }

  let suppressReset = false;
  let extensionSnapshot = null;
  let preparedSnapshot = null;

  function extendMission() {
    if (!state.pendingReview) return;
    extensionSnapshot = { ...state.pendingReview, createdAt: Date.now() };
    state.pendingReview = null;
    saveState();
    $('#missionReviewDialog').close();
    suppressReset = true;
    doReset();
    suppressReset = false;
    setTimerDuration(5 * 60000);
    $('#missionTarget').value = extensionSnapshot.target;
    doStartStop();
    showToast('5분을 더 이어서 집중해요. 보상은 그대로 유지됩니다.');
  }

  function abandonMission() {
    state.pendingReview = null;
    state.activeSession = null;
    saveState();
    $('#missionReviewDialog').close();
    doReset();
    setMissionControlsDisabled(false);
    updateTimerStatus('ready');
    renderLinkedMission();
    showToast('보상 없이 퀘스트를 종료했어요.');
  }

  function restoreSession() {
    if (state.pendingReview) {
      setMissionControlsDisabled(true);
      updateTimerStatus('pending');
      setTimeout(openReviewDialog, 250);
      return;
    }
    const session = state.activeSession;
    if (!session) return;
    state.selectedMissionId = session.mission.id;
    $('#missionTarget').value = session.mission.target;
    $$('.mission-choice').forEach(button => {
      const selected = button.dataset.mission === session.mission.id;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    setTimerDuration(session.mission.durationMs);
    setMissionControlsDisabled(true);
    if (session.status === 'running') {
      const remaining = Math.max(0, session.endAt - Date.now());
      if (remaining === 0) {
        state.pendingReview = { ...session.mission, completedAt: Date.now() };
        state.activeSession = null;
        saveState();
        updateTimerStatus('pending');
        setTimeout(openReviewDialog, 250);
        return;
      }
      timerRemaining = remaining;
      timerEndTime = session.endAt;
      timerFinished = false;
      running = true;
      clearInterval(intervalId);
      intervalId = setInterval(reconcileRunningClock, 100);
      $('#btnStart').textContent = '■';
      $('#btnStart').classList.add('running');
      $('#btnStart').setAttribute('aria-label', '타이머 일시정지');
      updateDisplay();
      updateTimerStatus('running');
    } else {
      timerRemaining = session.remaining;
      timerFinished = false;
      running = false;
      updateDisplay();
      updateTimerStatus('paused');
    }
  }

  window.teemoBeforeTimerStart = function () {
    if (state.pendingReview) {
      openReviewDialog();
      showToast('먼저 끝난 퀘스트를 확인해 주세요.');
      return false;
    }
    if (state.activeSession?.status === 'paused') {
      preparedSnapshot = state.activeSession.mission;
    } else if (extensionSnapshot) {
      preparedSnapshot = extensionSnapshot;
      extensionSnapshot = null;
    } else {
      preparedSnapshot = missionSnapshot();
    }
    return true;
  };

  window.addEventListener('teemo:timer-state', event => {
    if (event.detail.mode !== 'timer') return;
    if (event.detail.running) {
      const mission = preparedSnapshot || state.activeSession?.mission || missionSnapshot();
      state.activeSession = {
        mission,
        status: 'running',
        endAt: event.detail.endAt,
        remaining: event.detail.remaining
      };
      preparedSnapshot = null;
      setMissionControlsDisabled(true);
      updateTimerStatus('running');
    } else if (state.activeSession) {
      state.activeSession.status = 'paused';
      state.activeSession.endAt = 0;
      state.activeSession.remaining = event.detail.remaining;
      updateTimerStatus('paused');
    }
    saveState();
    renderLinkedMission();
  });

  window.addEventListener('teemo:timer-finished', event => {
    const snapshot = state.activeSession?.mission || preparedSnapshot || missionSnapshot();
    state.pendingReview = { ...snapshot, completedAt: event.detail.completedAt || Date.now() };
    state.activeSession = null;
    preparedSnapshot = null;
    saveState();
    setMissionControlsDisabled(true);
    updateTimerStatus('pending');
    renderLinkedMission();
    openReviewDialog();
  });

  window.addEventListener('teemo:timer-reset', () => {
    if (!suppressReset && !state.pendingReview) {
      state.activeSession = null;
      preparedSnapshot = null;
      saveState();
      setMissionControlsDisabled(false);
      updateTimerStatus('ready');
      renderLinkedMission();
    }
  });

  window.addEventListener('teemo:duration-changed', () => {
    if (!running && !state.activeSession && !state.pendingReview) renderMissionSummary();
  });

  window.addEventListener('teemo:mode-changed', event => {
    document.body.classList.toggle('stopwatch-mode', event.detail.mode === 'stopwatch');
    updateTimerStatus(event.detail.mode === 'stopwatch' ? 'stopwatch' : 'ready');
  });

  function bindEvents() {
    $$('.journey-tab').forEach(tab => {
      tab.addEventListener('click', () => switchJourney(tab.dataset.journey));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const names = ['mission', 'game', 'shop'];
        const current = names.indexOf(tab.dataset.journey);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? names.length - 1 :
          (current + (event.key === 'ArrowRight' ? 1 : -1) + names.length) % names.length;
        switchJourney(names[next], true);
      });
    });
    $$('[data-go-journey]').forEach(button => button.addEventListener('click', () => switchJourney(button.dataset.goJourney)));
    $$('.mission-choice').forEach(button => button.addEventListener('click', () => selectMission(button.dataset.mission)));
    $('#missionTarget').addEventListener('input', event => {
      state.targets[state.selectedMissionId] = safeText(event.target.value, MISSIONS[state.selectedMissionId].target, 80);
      saveState();
      renderLinkedMission();
    });
    $('#reviewPendingBtn').addEventListener('click', openReviewDialog);
    $('#gameMissionAction').addEventListener('click', () => {
      switchJourney('mission');
      if (state.pendingReview) openReviewDialog();
    });
    $('#shopGrid').addEventListener('click', event => {
      const button = event.target.closest('[data-shop-item]');
      if (button) handleShopAction(button.dataset.shopItem, button.dataset.shopAction);
    });
    $('#reviewCloseBtn').addEventListener('click', () => $('#missionReviewDialog').close());
    $('#claimRewardBtn').addEventListener('click', claimReward);
    $('#extendMissionBtn').addEventListener('click', extendMission);
    $('#abandonMissionBtn').addEventListener('click', abandonMission);
    $('#viewGameBtn').addEventListener('click', () => {
      $('#missionReviewDialog').close();
      doReset();
      switchJourney('game');
    });
    $('#nextMissionBtn').addEventListener('click', () => {
      $('#missionReviewDialog').close();
      doReset();
      switchJourney('mission');
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.pendingReview && !$('#missionReviewDialog').open) openReviewDialog();
    });
  }

  function initialize() {
    const selected = MISSIONS[state.selectedMissionId] || MISSIONS.focus25;
    $('#missionTarget').value = state.targets[selected.id] || selected.target;
    $$('.mission-choice').forEach(button => {
      const active = button.dataset.mission === selected.id;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (!state.activeSession && !state.pendingReview) setTimerDuration(selected.minutes * 60000);
    bindEvents();
    renderHeader();
    renderMissionSummary();
    renderGame();
    renderShop();
    updateTimerStatus('ready');
    restoreSession();
  }

  window.selectMission = selectMission;
  window.switchJourney = switchJourney;
  window.__teemoDailyQuest = {
    storageKey: STORAGE_KEY,
    getState: () => JSON.parse(JSON.stringify(state)),
    render: () => { renderHeader(); renderMissionSummary(); renderGame(); renderShop(); }
  };

  initialize();
})();
