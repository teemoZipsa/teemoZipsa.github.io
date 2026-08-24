/**
 * 티모집사 통합 테마 시스템
 * theme-toggle.js
 * 
 * - 메인 포털에서는 내비게이션 슬롯 또는 기존 고정 버튼 사용
 * - 개별 도구 페이지에서는 공통 헤더 안에 테마 버튼을 배치
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'theme';
  var LIGHT = 'light';
  var DARK = 'dark';

  function getPreferred() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === LIGHT || saved === DARK) return saved;
    } catch(e) {}
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return DARK;
    }
    return LIGHT;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = theme === DARK ? '#1a1a2e' : '#6366f1';
  }

  function updateButton(theme) {
    var btn = document.querySelector('.theme-toggle-portal:not(.blog-toggle-portal), .theme-toggle-tool');
    if (!btn) return;
    btn.textContent = theme === DARK ? '☀️' : '🌙';
    var english = window.location.pathname.indexOf('/en/') !== -1;
    btn.setAttribute('aria-label', theme === DARK
      ? (english ? 'Switch to light mode' : '라이트 모드로 전환')
      : (english ? 'Switch to dark mode' : '다크 모드로 전환'));
    btn.title = theme === DARK
      ? (english ? 'Light mode' : '라이트 모드')
      : (english ? 'Dark mode' : '다크 모드');
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || LIGHT;
    var next = current === DARK ? LIGHT : DARK;
    applyTheme(next);
    updateButton(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch(e) {}
  }

  function setupScrollTop() {
    var btn = document.querySelector('.scroll-top-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'scroll-top-btn';
      btn.textContent = '↑';
      document.body.appendChild(btn);
    }
    if (btn.getAttribute('data-scroll-top-ready') === 'true') return;

    var english = window.location.pathname.indexOf('/en/') !== -1;
    btn.type = 'button';
    btn.setAttribute('aria-label', english ? 'Back to top' : '맨 위로');
    btn.title = english ? 'Back to top' : '맨 위로';
    btn.setAttribute('data-scroll-top-ready', 'true');

    function updateVisibility() {
      btn.classList.toggle('visible', window.scrollY > 200);
    }

    window.addEventListener('scroll', updateVisibility, { passive: true });
    btn.addEventListener('click', function(event) {
      event.preventDefault();
      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    updateVisibility();
  }

  // 메인 포털인지 판별 (경로가 / 또는 /index.html 또는 /about.html 또는 /privacy.html)
  function isPortalPage() {
    var path = window.location.pathname;
    return path === '/' || path === '/index.html' || path === '/about.html' || path === '/privacy.html'
      || path === '/en/' || path === '/en/index.html' || path === '/en/about.html' || path === '/en/privacy.html'
      || path.endsWith('/teemoZipsa.github.io/') || path.endsWith('/teemoZipsa.github.io/index.html')
      || path.endsWith('/teemoZipsa.github.io/en/') || path.endsWith('/teemoZipsa.github.io/en/index.html');
  }

  function createToggleButton() {
    var portalPage = isPortalPage();
    var toolPage = window.location.pathname.indexOf('/special-chars/') !== -1;
    if (!portalPage && !toolPage) return;
    if (toolPage && !portalPage) setupScrollTop();
    if (document.querySelector('.theme-toggle-portal:not(.blog-toggle-portal), .theme-toggle-tool')) return;

    var theme = document.documentElement.getAttribute('data-theme') || LIGHT;
    var slot = document.querySelector('[data-theme-toggle-slot]');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = toolPage && !portalPage ? 'theme-toggle-tool' : 'theme-toggle-portal';
    btn.onclick = toggleTheme;

    if (toolPage && !portalPage && !slot) {
      var header = document.querySelector('.header, .calc-header');
      var title = header && header.querySelector(':scope > h1');
      if (header && title) {
        header.classList.add('tool-shell-header');

        var directChildren = Array.prototype.slice.call(header.children);
        var titleIndex = directChildren.indexOf(title);
        var leadingAction = titleIndex > 0 ? directChildren[0] : null;
        if (leadingAction && leadingAction.matches('a, button')) {
          leadingAction.classList.add('tool-shell-back');
          leadingAction.setAttribute('data-tool-short', '←');
        }

        var actions = document.createElement('div');
        actions.className = 'tool-header-actions';
        directChildren.slice(titleIndex + 1).forEach(function(child) {
          if (child.classList.contains('search-box')) {
            actions.classList.add('tool-header-actions--search');
          }
          if (child.matches('a')) {
            var label = (child.textContent || '').trim();
            var targetIsEnglish = child.getAttribute('href') && child.getAttribute('href').indexOf('/en/') !== -1;
            var languageLink = /English|한국어/i.test(label);
            child.classList.add('tool-header-action');
            if (languageLink) child.classList.add('tool-language-link');
            child.setAttribute('data-tool-short', languageLink
              ? (targetIsEnglish ? 'EN' : '한')
              : (label.split(/\s+/)[0] || '↗'));
          }
          actions.appendChild(child);
        });
        title.insertAdjacentElement('afterend', actions);

        btn.classList.add('theme-toggle-inline');
        actions.appendChild(btn);
        updateButton(theme);
        return;
      }
    }

    if (slot) {
      btn.classList.add('theme-toggle-inline');
      slot.appendChild(btn);
      updateButton(theme);
      return;
    }
    document.body.appendChild(btn);
    updateButton(theme);
    if (toolPage && !portalPage) return;

    var blogBtn = document.createElement('button');
    blogBtn.type = 'button';
    blogBtn.className = 'theme-toggle-portal blog-toggle-portal';
    blogBtn.textContent = '📰';
    blogBtn.setAttribute('aria-label', '티모집사 업무 가이드');
    blogBtn.title = '업무 가이드';
    blogBtn.onclick = function() { window.location.href = '/blog/'; };
    document.body.appendChild(blogBtn);

    // 배너가 숨겨져 있으면 버튼 위치를 위로 올림
    function adjustPosition() {
      var banner = document.getElementById('updateBanner');
      if (!banner || banner.style.display === 'none' || banner.offsetHeight === 0) {
        btn.style.top = '16px';
        blogBtn.style.top = '16px';
      } else {
        btn.style.top = '56px';
        blogBtn.style.top = '56px';
      }
    }
    adjustPosition();
    // 배너 닫힘을 감지하기 위한 관찰
    var observer = new MutationObserver(adjustPosition);
    var banner = document.getElementById('updateBanner');
    if (banner) observer.observe(banner, { attributes: true, attributeFilter: ['style'] });
  }

  // 시스템 테마 변경 감지 (수동 설정 없을 때만)
  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        try {
          if (!localStorage.getItem(STORAGE_KEY)) {
            applyTheme(e.matches ? DARK : LIGHT);
            updateButton(e.matches ? DARK : LIGHT);
          }
        } catch(ex) {
          applyTheme(e.matches ? DARK : LIGHT);
        }
      });
    } catch(e) {}
  }

  // 즉시 테마 적용
  applyTheme(getPreferred());

  // DOM 로드 후 포털 페이지에서만 버튼 생성
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createToggleButton);
  } else {
    createToggleButton();
  }
})();
