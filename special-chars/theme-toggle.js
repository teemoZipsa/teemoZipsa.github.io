/**
 * 티모집사 통합 테마 시스템
 * theme-toggle.js
 * 
 * - 메인 포털(teemoZipsa.github.io)에만 토글 버튼 표시
 * - 개별 도구 페이지는 저장된 설정 / 시스템 설정 자동 적용 (버튼 없음)
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
    var btn = document.querySelector('.theme-toggle-portal');
    if (!btn) return;
    btn.textContent = theme === DARK ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === DARK ? '라이트 모드로 전환' : '다크 모드로 전환');
    btn.title = theme === DARK ? '라이트 모드' : '다크 모드';
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || LIGHT;
    var next = current === DARK ? LIGHT : DARK;
    applyTheme(next);
    updateButton(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch(e) {}
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
    if (!isPortalPage()) return;
    if (document.querySelector('.theme-toggle-portal')) return;

    var theme = document.documentElement.getAttribute('data-theme') || LIGHT;
    var btn = document.createElement('button');
    btn.className = 'theme-toggle-portal';
    btn.textContent = theme === DARK ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === DARK ? '라이트 모드로 전환' : '다크 모드로 전환');
    btn.title = theme === DARK ? '라이트 모드' : '다크 모드';
    btn.onclick = toggleTheme;
    document.body.appendChild(btn);

    var blogBtn = document.createElement('button');
    blogBtn.className = 'theme-toggle-portal blog-toggle-portal';
    blogBtn.textContent = '📰';
    blogBtn.setAttribute('aria-label', '티모 매거진 블로그');
    blogBtn.title = '티모 매거진 (블로그)';
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
