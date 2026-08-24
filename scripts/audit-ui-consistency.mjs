import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const toolsRoot = path.join(rootDir, 'special-chars');
const validLayouts = new Set(['mini', 'compact', 'standard', 'wide']);
const mobileWidths = [320, 390];
const failures = [];

function walkToolPages(directory, pages = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walkToolPages(target, pages);
    else if (entry.name.toLowerCase() === 'index.html') {
      const html = fs.readFileSync(target, 'utf8');
      if (html.includes('/special-chars/theme-toggle.js')) pages.push(target);
    }
  }
  return pages;
}

function relative(file) {
  return path.relative(rootDir, file).replace(/\\/g, '/');
}

function routeForFile(file) {
  return `/${relative(file).replace(/index\.html$/i, '')}`;
}

function attributes(node) {
  return new Map((node.attrs || []).map(attribute => [attribute.name, attribute.value]));
}

function classList(node) {
  return new Set((attributes(node).get('class') || '').split(/\s+/).filter(Boolean));
}

function textContent(node) {
  if (node.nodeName === '#text') return node.value || '';
  return (node.childNodes || []).map(textContent).join('');
}

function findAll(node, predicate, output = []) {
  if (predicate(node)) output.push(node);
  for (const child of node.childNodes || []) findAll(child, predicate, output);
  return output;
}

function hasNoindex(html) {
  return /<meta\s+[^>]*(?:name|property)=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
}

function isDirectKoreanPage(file, document) {
  const htmlNode = findAll(document, node => node.tagName === 'html')[0];
  if (attributes(htmlNode || {}).get('lang') !== 'ko') return false;
  const directory = path.dirname(file);
  return directory === toolsRoot || path.dirname(directory) === toolsRoot;
}

function countExact(html, value) {
  return html.split(value).length - 1;
}

function auditStaticPage(file) {
  const rel = relative(file);
  const html = fs.readFileSync(file, 'utf8');
  const document = parse(html);
  const htmlNode = findAll(document, node => node.tagName === 'html')[0];
  const layout = attributes(htmlNode || {}).get('data-tool-layout');
  const shellLink = '<link rel="stylesheet" href="/special-chars/tool-shell.css">';

  if (!validLayouts.has(layout)) failures.push(`${rel}: data-tool-layout 값이 없거나 올바르지 않습니다.`);
  if (countExact(html, shellLink) !== 1) failures.push(`${rel}: tool-shell.css 링크가 정확히 하나여야 합니다.`);

  const headEnd = html.indexOf('</head>');
  const shellIndex = html.indexOf(shellLink);
  const lastInlineStyle = html.lastIndexOf('</style>', headEnd);
  if (shellIndex < lastInlineStyle || shellIndex > headEnd) {
    failures.push(`${rel}: tool-shell.css는 페이지 인라인 스타일 뒤, </head> 앞에 있어야 합니다.`);
  }

  if (html.includes('class="work-context"') && countExact(html, '/special-chars/site-links.css') !== 1) {
    failures.push(`${rel}: work-context가 있지만 site-links.css가 정확히 하나 연결되지 않았습니다.`);
  }
  if (/\b(?:alert|confirm|prompt)\s*\(/.test(html)) {
    failures.push(`${rel}: 브라우저 기본 alert/confirm/prompt 대신 페이지 안 피드백 UI를 사용해야 합니다.`);
  }
  if (/\.scroll-top-btn(?:\.visible|:hover)?\s*\{/.test(html)) {
    failures.push(`${rel}: 맨 위 버튼 CSS는 tool-shell.css에서만 관리해야 합니다.`);
  }

  const toasts = findAll(document, node => node.tagName === 'div' && classList(node).has('toast'));
  for (const toast of toasts) {
    const toastAttributes = attributes(toast);
    if (toastAttributes.get('role') !== 'status' || toastAttributes.get('aria-live') !== 'polite') {
      failures.push(`${rel}: 토스트 피드백에는 role="status"와 aria-live="polite"가 필요합니다.`);
    }
  }

  if (isDirectKoreanPage(file, document) && !hasNoindex(html)) {
    if (countExact(html, '/special-chars/site-links.css') !== 1) {
      failures.push(`${rel}: 공개 한국어 도구에 site-links.css가 정확히 하나 필요합니다.`);
    }

    const footers = findAll(document, node => node.tagName === 'footer' && classList(node).has('footer'));
    const policies = findAll(document, node => node.tagName === 'nav' && classList(node).has('site-policy-links'));
    if (policies.length !== 1) {
      failures.push(`${rel}: 사이트 정책 내비게이션이 정확히 하나여야 하지만 ${policies.length}개입니다.`);
      return;
    }

    const policy = policies[0];
    if (attributes(policy).get('aria-label') !== '사이트 정책') {
      failures.push(`${rel}: 정책 내비게이션의 aria-label이 올바르지 않습니다.`);
    }
    const actualLinks = findAll(policy, node => node.tagName === 'a').map(node => ({
      href: attributes(node).get('href'),
      label: textContent(node).replace(/\s+/g, ' ').trim()
    }));
    const expectedLinks = [
      { href: '/about.html', label: '사이트 소개' },
      { href: '/editorial-policy.html', label: '편집정책' },
      { href: '/contact.html', label: '문의' },
      { href: '/privacy.html', label: '개인정보처리방침' }
    ];
    if (JSON.stringify(actualLinks) !== JSON.stringify(expectedLinks)) {
      failures.push(`${rel}: 정책 링크의 주소·문구·순서가 공통 규격과 다릅니다.`);
    }

    const footer = footers[0];
    if (!footer || footer.parentNode !== policy.parentNode) {
      failures.push(`${rel}: footer와 정책 내비게이션이 같은 앱 컨테이너에 있어야 합니다.`);
    } else {
      const siblings = policy.parentNode.childNodes || [];
      if (siblings.indexOf(footer) > siblings.indexOf(policy)) {
        failures.push(`${rel}: 정책 내비게이션은 footer 뒤에 있어야 합니다.`);
      }
    }
  }
}

function contentType(file) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      let relativePath = pathname.replace(/^\/+/, '') || 'index.html';
      let target = path.resolve(rootDir, relativePath);
      if (!target.startsWith(`${rootDir}${path.sep}`) && target !== rootDir) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': contentType(target) });
      fs.createReadStream(target).pipe(response);
    } catch (error) {
      response.writeHead(500).end(String(error.message || error));
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function probePage(context, base, file, width) {
  const rel = relative(file);
  const route = routeForFile(file);
  const page = await context.newPage();
  const runtimeProblems = [];
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => runtimeProblems.push(`pageerror: ${error.message}`));
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 400) {
      runtimeProblems.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  try {
    await page.setViewportSize({ width, height: 844 });
    if (rel === 'special-chars/quick-reply/index.html') {
      await page.addInitScript(() => {
        localStorage.setItem('qr_customs', JSON.stringify(['모바일 카드 조작부 겹침 검사 문구']));
      });
    }
    const response = await page.goto(`${base}${route}?ui-audit=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    if (!response?.ok()) throw new Error(`HTTP ${response?.status() || 'no response'}`);
    await page.waitForSelector('.theme-toggle-tool.theme-toggle-inline');
    await page.waitForTimeout(30);

    const state = await page.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const label = element => (element.getAttribute('aria-label') || element.textContent || element.tagName)
        .trim().replace(/\s+/g, ' ').slice(0, 36);
      const dimensions = element => {
        const rect = element.getBoundingClientRect();
        return `${label(element)} (${rect.width.toFixed(1)}x${rect.height.toFixed(1)})`;
      };
      const intersects = (a, b) => a && b &&
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;

      const viewportWidth = document.documentElement.clientWidth;
      const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const shell = document.querySelector('.app, .calc-app');
      const shellRect = shell?.getBoundingClientRect();
      const header = document.querySelector('.tool-shell-header');
      const title = header?.querySelector(':scope > h1');
      const leading = header?.querySelector(':scope > .tool-shell-back');
      const actions = header?.querySelector(':scope > .tool-header-actions');
      const theme = document.querySelector('.theme-toggle-tool');
      const scrollTop = document.querySelector('.scroll-top-btn');
      const fields = [...document.querySelectorAll(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="hidden"]), select, textarea'
      )].filter(visible);
      const headerLinks = header ? [...header.querySelectorAll('a')].filter(visible) : [];
      const policyLinks = [...document.querySelectorAll('.site-policy-links a')].filter(visible);
      const actionControls = [...document.querySelectorAll('button, [role="button"], [role="tab"]')]
        .filter(visible)
        .filter(element => !header?.contains(element) && element !== scrollTop);
      const responsiveContainers = [...document.querySelectorAll(
        '.code-row, .speed-row, .condition-grid, .taxi-toggle-grid, .sub-item, .date-row, .size-row, .input-row, .input-group, .emoji-grid, .num-grid, .bcs-selector'
      )].filter(visible);
      const bottomBar = document.querySelector('.bottom-bar');
      let bottomBarProblem = null;
      if (bottomBar && visible(bottomBar)) {
        const info = bottomBar.querySelector(':scope > .info');
        const barActions = [...bottomBar.querySelectorAll('.action-btn')].filter(visible);
        const actionTop = barActions.length
          ? Math.min(...barActions.map(element => element.getBoundingClientRect().top))
          : null;
        const narrowActions = barActions.filter(element => element.getBoundingClientRect().width < 79.5);
        if ((info && actionTop !== null && actionTop < info.getBoundingClientRect().bottom - 1) || narrowActions.length) {
          bottomBarProblem = narrowActions.length
            ? `폭이 좁은 버튼: ${narrowActions.map(dimensions).join(', ')}`
            : '상태 문구와 액션 버튼이 같은 좁은 행에 배치됩니다.';
        }
      }

      const quickReplyDelete = document.querySelector('.msg-delete');
      const quickReplyCard = quickReplyDelete?.closest('.msg-card');
      const quickReplyFavorite = quickReplyCard?.querySelector('.msg-favorite');
      const quickReplyCopy = quickReplyCard?.querySelector('.msg-copy');
      const quickReplyOverlap = Boolean(quickReplyDelete && quickReplyFavorite && quickReplyCopy && (
        intersects(quickReplyDelete.getBoundingClientRect(), quickReplyFavorite.getBoundingClientRect()) ||
        intersects(quickReplyDelete.getBoundingClientRect(), quickReplyCopy.getBoundingClientRect()) ||
        intersects(quickReplyFavorite.getBoundingClientRect(), quickReplyCopy.getBoundingClientRect())
      ));
      const toast = document.querySelector('.toast');
      let toastState = null;
      if (toast) {
        toast.style.transition = 'none';
        toast.textContent = location.pathname.includes('/en/')
          ? 'Saved. This deliberately long feedback message must wrap inside the screen without covering the page width.'
          : '저장했습니다. 긴 피드백 문구도 화면 너비 안에서 자연스럽게 줄바꿈되어야 합니다.';
        toast.classList.add('show');
        const toastRect = toast.getBoundingClientRect();
        const toastStyle = getComputedStyle(toast);
        toastState = {
          role: toast.getAttribute('role'),
          live: toast.getAttribute('aria-live'),
          visible: Number.parseFloat(toastStyle.opacity) > 0.9,
          whiteSpace: toastStyle.whiteSpace,
          outsideViewport: toastRect.left < -1 || toastRect.right > viewportWidth + 1 || toastRect.bottom > innerHeight + 1
        };
      }

      return {
        overflow: Math.max(0, scrollWidth - viewportWidth),
        shellOutsideViewport: Boolean(shellRect && (shellRect.left < -1 || shellRect.right > viewportWidth + 1)),
        missingHeader: !header,
        missingActions: !actions,
        themeOutsideHeader: !theme || !actions?.contains(theme),
        themePosition: theme ? getComputedStyle(theme).position : 'missing',
        themeSize: theme && visible(theme) ? dimensions(theme) : 'missing',
        themeTooSmall: !theme || !visible(theme) || theme.getBoundingClientRect().width < 43.5 || theme.getBoundingClientRect().height < 43.5,
        scrollTopDisplay: scrollTop ? getComputedStyle(scrollTop).display : null,
        scrollTopLabel: scrollTop?.getAttribute('aria-label') || null,
        expectedScrollTopLabel: location.pathname.includes('/en/') ? 'Back to top' : '맨 위로',
        headerOverlap: Boolean(title && (
          (leading && intersects(title.getBoundingClientRect(), leading.getBoundingClientRect())) ||
          (actions && intersects(title.getBoundingClientRect(), actions.getBoundingClientRect()))
        )),
        smallFields: fields
          .filter(element => element.getBoundingClientRect().height < 43.5)
          .slice(0, 6)
          .map(dimensions),
        smallHeaderLinks: headerLinks
          .filter(element => {
            const rect = element.getBoundingClientRect();
            return rect.width < 43.5 || rect.height < 43.5;
          })
          .slice(0, 6)
          .map(dimensions),
        smallPolicyLinks: policyLinks
          .filter(element => element.getBoundingClientRect().height < 43.5)
          .slice(0, 6)
          .map(dimensions),
        smallActions: actionControls
          .filter(element => {
            const rect = element.getBoundingClientRect();
            return rect.width < 43.5 || rect.height < 43.5;
          })
          .slice(0, 8)
          .map(dimensions),
        clippedContainers: responsiveContainers
          .filter(element => element.scrollWidth - element.clientWidth > 2)
          .slice(0, 8)
          .map(element => `${element.className || element.tagName} (+${element.scrollWidth - element.clientWidth}px)`),
        bottomBarProblem,
        quickReplyOverlap,
        toastState
      };
    });

    const prefix = `${rel} @ ${width}px`;
    if (state.overflow > 1) failures.push(`${prefix}: ${state.overflow}px 가로 오버플로가 있습니다.`);
    if (state.shellOutsideViewport) failures.push(`${prefix}: 앱 셸이 뷰포트 밖으로 벗어납니다.`);
    if (state.missingHeader || state.missingActions) failures.push(`${prefix}: 공통 헤더 구조가 만들어지지 않았습니다.`);
    if (state.themeOutsideHeader || state.themePosition !== 'static') failures.push(`${prefix}: 테마 버튼이 헤더의 정상 흐름 안에 있지 않습니다.`);
    if (state.themeTooSmall) failures.push(`${prefix}: 테마 버튼 터치 크기가 부족합니다 (${state.themeSize}).`);
    if (state.scrollTopDisplay && state.scrollTopDisplay !== 'none') failures.push(`${prefix}: 맨 위 버튼은 900px 이하에서 콘텐츠와 겹치지 않도록 숨겨야 합니다.`);
    if (state.scrollTopLabel && state.scrollTopLabel !== state.expectedScrollTopLabel) failures.push(`${prefix}: 맨 위 버튼의 언어별 접근성 문구가 올바르지 않습니다.`);
    if (state.headerOverlap) failures.push(`${prefix}: 제목과 헤더 조작부가 겹칩니다.`);
    if (state.smallFields.length) failures.push(`${prefix}: 높이 44px 미만 입력 필드 — ${state.smallFields.join(', ')}`);
    if (state.smallHeaderLinks.length) failures.push(`${prefix}: 44px 미만 헤더 링크 — ${state.smallHeaderLinks.join(', ')}`);
    if (state.smallPolicyLinks.length) failures.push(`${prefix}: 44px 미만 정책 링크 — ${state.smallPolicyLinks.join(', ')}`);
    if (state.smallActions.length) failures.push(`${prefix}: 44px 미만 조작 버튼 — ${state.smallActions.join(', ')}`);
    if (state.clippedContainers.length) failures.push(`${prefix}: 내부에서 잘리는 반응형 컨테이너 — ${state.clippedContainers.join(', ')}`);
    if (state.bottomBarProblem) failures.push(`${prefix}: 하단 액션 바가 모바일 행 규격을 벗어납니다 (${state.bottomBarProblem}).`);
    if (state.quickReplyOverlap) failures.push(`${prefix}: 빠른 답장 커스텀 카드의 복사·삭제·즐겨찾기 조작부가 겹칩니다.`);
    if (state.toastState && (
      state.toastState.role !== 'status' ||
      state.toastState.live !== 'polite' ||
      !state.toastState.visible ||
      state.toastState.whiteSpace !== 'normal' ||
      state.toastState.outsideViewport
    )) {
      failures.push(`${prefix}: 토스트 피드백이 공통 의미·줄바꿈·화면 경계 규격을 충족하지 않습니다.`);
    }
    if (runtimeProblems.length) failures.push(`${prefix}: ${runtimeProblems.slice(0, 4).join(' | ')}`);

  } catch (error) {
    failures.push(`${rel} @ ${width}px: ${error.message || error}`);
  } finally {
    await page.close();
  }
}

async function probeDesktopScroll(context, base, file) {
  const rel = relative(file);
  const page = await context.newPage();
  try {
    const response = await page.goto(`${base}${routeForFile(file)}?ui-scroll-audit=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    if (!response?.ok()) throw new Error(`HTTP ${response?.status() || 'no response'}`);
    await page.waitForSelector('.scroll-top-btn[data-scroll-top-ready="true"]', { state: 'attached' });
    const state = await page.evaluate(async () => {
      const button = document.querySelector('.scroll-top-btn');
      const maxScroll = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo(0, Math.min(250, maxScroll));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      const visible = button.classList.contains('visible') && style.display !== 'none' && style.visibility !== 'hidden';
      const inViewport = rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0;
      const position = style.position;
      const originalScrollTo = window.scrollTo;
      let call = null;
      window.scrollTo = function(...args) {
        call = args[0];
        return originalScrollTo.apply(window, args);
      };
      button.click();
      window.scrollTo = originalScrollTo;
      await new Promise(resolve => requestAnimationFrame(resolve));
      return {
        maxScroll,
        visible,
        inViewport,
        position,
        width: rect.width,
        height: rect.height,
        label: button.getAttribute('aria-label'),
        expectedLabel: location.pathname.includes('/en/') ? 'Back to top' : '맨 위로',
        behavior: call && typeof call === 'object' ? call.behavior : null,
        returnedToTop: window.scrollY === 0
      };
    });
    if (state.maxScroll <= 200) failures.push(`${rel} @ 1280px: 맨 위 버튼 상호작용을 검사할 스크롤 길이가 부족합니다.`);
    if (!state.visible || !state.inViewport) failures.push(`${rel} @ 1280px: 맨 위 버튼이 실제 뷰포트 안에 표시되지 않습니다.`);
    if (state.position !== 'fixed') failures.push(`${rel} @ 1280px: 데스크톱 맨 위 버튼은 외곽 여백에 고정되어야 합니다.`);
    if (state.width < 43.5 || state.height < 43.5) failures.push(`${rel} @ 1280px: 맨 위 버튼이 44px보다 작습니다.`);
    if (state.label !== state.expectedLabel) failures.push(`${rel} @ 1280px: 맨 위 버튼의 언어별 접근성 문구가 올바르지 않습니다.`);
    if (state.behavior !== 'auto') failures.push(`${rel} @ 1280px: 동작 감소 설정에서 맨 위 이동이 즉시 실행되지 않습니다.`);
    if (!state.returnedToTop) failures.push(`${rel} @ 1280px: 맨 위 버튼 클릭 후 페이지 상단으로 이동하지 않았습니다.`);
  } catch (error) {
    failures.push(`${rel} @ 1280px: ${error.message || error}`);
  } finally {
    await page.close();
  }
}

async function runMobileAudit(files) {
  const server = await startServer();
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of mobileWidths) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        colorScheme: 'light',
        reducedMotion: 'reduce',
        serviceWorkers: 'block'
      });
      await context.route('**/*', route => {
        if (route.request().url().startsWith(`${base}/`)) return route.continue();
        return route.abort('blockedbyclient');
      });
      for (let index = 0; index < files.length; index += 6) {
        await Promise.all(files.slice(index, index + 6).map(file => probePage(context, base, file, width)));
      }
      await context.close();
    }

    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
      serviceWorkers: 'block'
    });
    await desktopContext.route('**/*', route => {
      if (route.request().url().startsWith(`${base}/`)) return route.continue();
      return route.abort('blockedbyclient');
    });
    const desktopCases = new Set([
      'special-chars/bmi-calc/index.html',
      'special-chars/en/bmi-calc/index.html',
      'special-chars/lotto-gen/index.html',
      'special-chars/en/lotto-gen/index.html'
    ]);
    for (const file of files.filter(candidate => desktopCases.has(relative(candidate)))) {
      await probeDesktopScroll(desktopContext, base, file);
    }
    await desktopContext.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

const files = walkToolPages(toolsRoot).sort();
if (!files.length) throw new Error('도구 페이지를 찾지 못했습니다.');
for (const file of files) auditStaticPage(file);

const shellCss = path.join(toolsRoot, 'tool-shell.css');
if (!fs.existsSync(shellCss)) failures.push('special-chars/tool-shell.css가 없습니다.');
const serviceWorker = fs.readFileSync(path.join(toolsRoot, 'sw.js'), 'utf8');
if (!serviceWorker.includes("'/special-chars/tool-shell.css'")) {
  failures.push('service worker 필수 셸 캐시에 tool-shell.css가 없습니다.');
}

await runMobileAudit(files);

if (failures.length) {
  console.error(`UI consistency audit failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`UI consistency audit passed: ${files.length} tools × ${mobileWidths.length} mobile widths plus desktop scroll controls, shared headers, touch actions, wrapped feedback, policy links, and overflow checks.`);
