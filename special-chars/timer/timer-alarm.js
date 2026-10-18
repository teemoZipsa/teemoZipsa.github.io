/*
 * 티모집사 타이머 알림 도우미 (타이머·일상 퀘스트 공용)
 *
 * - 사용자가 시작 버튼을 누를 때 AudioContext를 만들고, 종료 시각의 알림음을 오디오 시계에
 *   미리 예약합니다. 백그라운드 탭에서 setInterval이 늦어져도 소리는 예약된 시각에 납니다.
 * - 같은 시각에 끝나는 무음 오실레이터의 ended 이벤트로 페이지에 종료를 알려, 타이머 지연과
 *   관계없이 화면·알림을 바로 갱신할 수 있게 합니다.
 * - 알림음은 사용자가 끌 때까지 최대 RING_SECONDS초 반복합니다.
 */
(function () {
  'use strict';

  const RING_SECONDS = 60;
  const CYCLE_SECONDS = 1.2;
  const BEEPS = [0, 0.2, 0.4];
  const BEEP_LENGTH = 0.15;
  const VOLUME = 0.3;

  let audioContext = null;
  let scheduled = null;
  let ringing = null;
  let ringTimer = null;
  let dueCallback = null;
  let ringEndCallback = null;
  let scheduleToken = 0;
  let ringToken = 0;

  function getContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextClass();
    } catch (_error) {
      return null;
    }
    return audioContext;
  }

  function resume(context) {
    if (!context) return Promise.resolve(false);
    if (context.state === 'running') return Promise.resolve(true);
    try {
      return context.resume().then(() => context.state === 'running').catch(() => false);
    } catch (_error) {
      return Promise.resolve(false);
    }
  }

  function prime() {
    return resume(getContext());
  }

  // 오실레이터 하나와 게인 자동화로 '삐삐삐' 패턴을 seconds초 동안 만듭니다.
  function buildRing(context, startAt, seconds) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0, Math.max(context.currentTime, 0));
    for (let cycle = 0; cycle * CYCLE_SECONDS < seconds; cycle += 1) {
      const base = startAt + cycle * CYCLE_SECONDS;
      BEEPS.forEach(offset => {
        const on = base + offset;
        gain.gain.setValueAtTime(0, on);
        gain.gain.linearRampToValueAtTime(VOLUME, on + 0.01);
        gain.gain.setValueAtTime(VOLUME, on + BEEP_LENGTH - 0.01);
        gain.gain.linearRampToValueAtTime(0, on + BEEP_LENGTH);
      });
    }
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + seconds);
    return { oscillator, gain, startAt, endAt: startAt + seconds };
  }

  function disposeNodes(entry) {
    if (!entry) return;
    ['oscillator', 'sentinel'].forEach(key => {
      const node = entry[key];
      if (!node) return;
      node.onended = null;
      try { node.stop(0); } catch (_error) { /* 이미 멈춘 노드 */ }
      try { node.disconnect(); } catch (_error) { /* 연결 없음 */ }
    });
    ['gain', 'mute'].forEach(key => {
      try { entry[key]?.disconnect(); } catch (_error) { /* 연결 없음 */ }
    });
  }

  function cancelScheduled() {
    scheduleToken += 1;
    disposeNodes(scheduled);
    scheduled = null;
  }

  function finishRinging(notify) {
    ringToken += 1;
    clearTimeout(ringTimer);
    ringTimer = null;
    disposeNodes(ringing);
    const wasRinging = Boolean(ringing);
    ringing = null;
    if (notify && wasRinging && typeof ringEndCallback === 'function') ringEndCallback();
  }

  function trackRinging(entry, context) {
    ringing = entry;
    clearTimeout(ringTimer);
    const remainingMs = Math.max(0, (entry.endAt - context.currentTime) * 1000);
    ringTimer = setTimeout(() => finishRinging(true), remainingMs + 100);
  }

  /*
   * endTimeMs(Date.now 기준)에 울릴 알림음을 예약합니다. onDue는 종료 시각에 한 번 호출됩니다.
   * 오디오를 쓸 수 없으면 false를 돌려주며, 이때 페이지는 기존 시계 보정만으로 동작합니다.
   */
  function schedule(endTimeMs, onDue) {
    cancelScheduled();
    dueCallback = typeof onDue === 'function' ? onDue : null;
    const context = getContext();
    if (!context) return false;
    const token = scheduleToken;
    const arm = () => {
      if (token !== scheduleToken || context.state !== 'running' || scheduled) return;
      const delaySeconds = Math.max(0, (endTimeMs - Date.now()) / 1000);
      const latency = (context.baseLatency || 0) + (context.outputLatency || 0);
      const startAt = context.currentTime + Math.max(0.02, delaySeconds - latency);
      const entry = buildRing(context, startAt, RING_SECONDS);
      const sentinel = context.createOscillator();
      const mute = context.createGain();
      mute.gain.value = 0;
      sentinel.connect(mute);
      mute.connect(context.destination);
      sentinel.onended = () => {
        if (!scheduled || scheduled.sentinel !== sentinel) return;
        const callback = dueCallback;
        if (callback) callback();
      };
      sentinel.start();
      sentinel.stop(context.currentTime + Math.max(0.02, delaySeconds));
      scheduled = { ...entry, sentinel, mute, endTimeMs };
    };
    resume(context).then(arm);
    return true;
  }

  // 종료 시점에 호출합니다. 이미 예약된 알림음이 울리기 시작했으면 그대로 이어서 사용합니다.
  function ring() {
    const context = getContext();
    if (!context) return false;
    if (ringing) return true;
    if (scheduled && context.state === 'running' && scheduled.startAt <= context.currentTime + 1) {
      const entry = scheduled;
      if (entry.sentinel) {
        entry.sentinel.onended = null;
        try { entry.sentinel.disconnect(); } catch (_error) { /* 연결 없음 */ }
        try { entry.mute.disconnect(); } catch (_error) { /* 연결 없음 */ }
      }
      scheduled = null;
      trackRinging({ oscillator: entry.oscillator, gain: entry.gain, startAt: entry.startAt, endAt: entry.endAt }, context);
      return true;
    }
    cancelScheduled();
    const token = ringToken;
    resume(context).then(ok => {
      if (!ok || ringing || token !== ringToken) return;
      trackRinging(buildRing(context, context.currentTime + 0.05, RING_SECONDS), context);
    });
    return true;
  }

  // 알림음과 예약을 모두 멈추고, 쓸 일이 없으면 오디오 장치를 쉬게 합니다.
  function stop() {
    cancelScheduled();
    finishRinging(false);
    release();
  }

  function release() {
    if (scheduled || ringing || !audioContext) return;
    try { if (audioContext.state === 'running') audioContext.suspend().catch(() => {}); } catch (_error) { /* 무시 */ }
  }

  function isRinging() {
    return Boolean(ringing);
  }

  function notificationsSupported() {
    return 'Notification' in window;
  }

  function requestNotificationPermission() {
    if (!notificationsSupported()) return Promise.resolve('unsupported');
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
    try {
      const result = Notification.requestPermission();
      return result && typeof result.then === 'function' ? result : Promise.resolve(Notification.permission);
    } catch (_error) {
      return Promise.resolve('denied');
    }
  }

  function notify(title, body) {
    if (!notificationsSupported() || Notification.permission !== 'granted') return false;
    const options = { body, tag: 'teemo-timer', renotify: true, requireInteraction: true, icon: '/special-chars/favicon.png' };
    try {
      const notification = new Notification(title, options);
      notification.onclick = () => { window.focus(); notification.close(); };
      return true;
    } catch (_error) {
      // Android Chrome은 페이지에서 Notification 생성자를 막으므로 서비스 워커로 표시합니다.
      if (navigator.serviceWorker?.getRegistration) {
        navigator.serviceWorker.getRegistration().then(registration => registration?.showNotification(title, options)).catch(() => {});
        return true;
      }
      return false;
    }
  }

  window.TeemoTimerAlarm = {
    prime,
    schedule,
    cancelScheduled: () => { cancelScheduled(); release(); },
    ring,
    stop,
    isRinging,
    set onRingEnd(callback) { ringEndCallback = typeof callback === 'function' ? callback : null; },
    notificationsSupported,
    requestNotificationPermission,
    notify,
    RING_SECONDS
  };
})();
