/**
 * 티모집사 Service Worker
 * 필수 앱 셸, 방문 페이지, 일반 런타임, 버전 고정 vendor/model을 분리해
 * 오프라인 재사용성과 대용량 AI 자산의 수명을 독립적으로 관리한다.
 */
const OWNED_CACHE_PREFIX = 'teemozipsa-';
const SHELL_CACHE_NAME = 'teemozipsa-shell-v1.8';
const PAGE_CACHE_NAME = 'teemozipsa-pages-v1';
const RUNTIME_CACHE_NAME = 'teemozipsa-runtime-v1';
// Vendor responses are immutable cache-first. Bump this generation whenever
// bytes change under an existing vendor URL, otherwise existing clients keep
// the previous artifact indefinitely. v2 invalidates the CSP-patched IMG.LY
// bundle that retained its upstream 1.5.5 URL.
const VENDOR_CACHE_NAME = 'teemozipsa-vendor-v2';
const CURRENT_CACHE_NAMES = new Set([
  SHELL_CACHE_NAME,
  PAGE_CACHE_NAME,
  RUNTIME_CACHE_NAME,
  VENDOR_CACHE_NAME
]);
const LEGACY_CACHE_NAMES = new Set(['teemozipsa-v1.2']);
const MAX_PAGE_ENTRIES = 96;
const MAX_RUNTIME_ENTRIES = 128;
const MAX_VENDOR_ENTRIES = 64;

const PRECACHE_URLS = [
  '/special-chars/',
  '/special-chars/theme.css',
  '/special-chars/theme-toggle.js',
  '/special-chars/metronome-worklet.js',
  '/special-chars/favicon.png',
  '/special-chars/icon-192.png',
  '/special-chars/icon-maskable-512.png',
  '/special-chars/manifest.json',
  '/special-chars/vendor/qrcode-generator/1.4.4/qrcode.js'
];
const PRECACHE_PATHS = new Set(PRECACHE_URLS.map(url => new URL(url, self.location.origin).pathname));

function isCacheable(response) {
  return response && response.ok && response.status === 200 && response.type === 'basic';
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  if (excess > 0) await Promise.all(keys.slice(0, excess).map(request => cache.delete(request)));
}

async function storeResponse(cacheName, request, response, maxEntries) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  if (maxEntries) await trimCache(cacheName, maxEntries);
}

function pageCacheKey(url) {
  return new Request(`${url.origin}${url.pathname}`);
}

function cacheTargetFor(url) {
  if (PRECACHE_PATHS.has(url.pathname)) {
    return { name: SHELL_CACHE_NAME, maxEntries: 0, immutable: false };
  }
  if (url.pathname.startsWith('/special-chars/vendor/')) {
    return { name: VENDOR_CACHE_NAME, maxEntries: MAX_VENDOR_ENTRIES, immutable: true };
  }
  return { name: RUNTIME_CACHE_NAME, maxEntries: MAX_RUNTIME_ENTRIES, immutable: false };
}

// 필수 셸은 하나라도 실패하면 설치 전체를 실패시킨다. 이전 워커와 캐시는
// 그대로 유지되므로 빈 셸 캐시가 활성화되는 부분 설치가 발생하지 않는다.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => (
        (name.startsWith(OWNED_CACHE_PREFIX) || LEGACY_CACHE_NAMES.has(name)) &&
        !CURRENT_CACHE_NAMES.has(name)
      ))
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirstPage(request, url) {
  const cacheKey = pageCacheKey(url);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      try {
        await storeResponse(PAGE_CACHE_NAME, cacheKey, response, MAX_PAGE_ENTRIES);
      } catch (error) {
        console.warn('페이지 오프라인 캐시 저장 실패:', error);
      }
    }
    return response;
  } catch (_error) {
    const pageCache = await caches.open(PAGE_CACHE_NAME);
    const shellCache = await caches.open(SHELL_CACHE_NAME);
    const cached = await pageCache.match(cacheKey) || await shellCache.match(cacheKey);
    if (cached) return cached;
    return new Response(
      '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인</title>' +
      '<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a2e;color:#e0e0e0;text-align:center}' +
      '.box{padding:40px;max-width:400px}h1{font-size:48px;margin-bottom:16px}p{color:#aaaadd;line-height:1.6}</style></head>' +
      '<body><main class="box"><h1>📡</h1><h2>오프라인 상태입니다</h2><p>인터넷 연결을 확인해 주세요.<br>이전에 방문한 페이지는 오프라인에서도 사용 가능합니다.</p>' +
      '<p><a href="/special-chars/" style="color:#c4b5fd;text-decoration:underline">도구 모음으로 돌아가기</a></p></main></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

function cacheFirstStatic(request, url) {
  const target = cacheTargetFor(url);
  const cachedPromise = caches.open(target.name).then(cache => cache.match(request));
  const refreshPromise = target.immutable ? Promise.resolve() : cachedPromise.then(cached => {
    if (!cached) return undefined;
    return fetch(request).then(async response => {
      if (isCacheable(response)) {
        try {
          await storeResponse(target.name, request, response, target.maxEntries);
        } catch (error) {
          console.warn('정적 리소스 캐시 갱신 실패:', error);
        }
      }
    }).catch(() => {});
  });

  const responsePromise = cachedPromise.then(async cached => {
    if (cached) return cached;
    const response = await fetch(request);
    if (isCacheable(response)) {
      try {
        // cache.put이 끝날 때까지 응답 수명에 포함한다. 특히 모델 청크와 WASM이
        // 저장 도중 중단되어 다음 오프라인 사용에 빠지는 일을 방지한다.
        await storeResponse(target.name, request, response, target.maxEntries);
      } catch (error) {
        console.warn('정적 리소스 오프라인 캐시 저장 실패:', error);
      }
    }
    return response;
  });

  return { responsePromise, refreshPromise };
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/special-chars/')) return;

  const acceptsHtml = request.mode === 'navigate' || (request.headers.get('Accept') || '').includes('text/html');
  if (acceptsHtml) {
    event.respondWith(networkFirstPage(request, url));
    return;
  }

  const strategy = cacheFirstStatic(request, url);
  event.respondWith(strategy.responsePromise);
  event.waitUntil(strategy.refreshPromise);
});
