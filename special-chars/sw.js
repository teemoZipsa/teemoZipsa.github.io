/**
 * 티모집사 Service Worker
 * sw.js — 오프라인 지원 + 캐싱
 */
const CACHE_NAME = 'teemozipsa-v1.2';

// 프리캐싱할 핵심 리소스
const PRECACHE_URLS = [
  '/special-chars/',
  '/special-chars/theme.css',
  '/special-chars/theme-toggle.js',
  '/special-chars/favicon.png',
  '/special-chars/manifest.json'
];

// install: 핵심 리소스 프리캐싱
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function() {
        // 일부 실패해도 설치 진행
        return Promise.resolve();
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// activate: 오래된 캐시 정리
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// fetch: Network First for HTML, Cache First for static assets
self.addEventListener('fetch', function(event) {
  var request = event.request;

  // POST 등 비-GET 요청은 무시
  if (request.method !== 'GET') return;

  // 외부 도메인 요청은 무시 (AdSense, CDN 등)
  var url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // HTML 페이지: Network First (최신 콘텐츠 우선)
  if (request.headers.get('Accept') && request.headers.get('Accept').includes('text/html')) {
    event.respondWith(
      fetch(request).then(function(response) {
        // 성공하면 캐시에 저장
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(request, responseClone);
        });
        return response;
      }).catch(function() {
        // 오프라인이면 캐시에서 제공
        return caches.match(request).then(function(cached) {
          return cached || new Response(
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인</title>' +
            '<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a2e;color:#e0e0e0;text-align:center}' +
            '.box{padding:40px;max-width:400px}h1{font-size:48px;margin-bottom:16px}p{color:#8888bb;line-height:1.6}</style></head>' +
            '<body><div class="box"><h1>📡</h1><h2>오프라인 상태입니다</h2><p>인터넷 연결을 확인해 주세요.<br>이전에 방문한 페이지는 오프라인에서도 사용 가능합니다.</p>' +
            '<br><a href="/" style="color:#533483;text-decoration:underline">홈으로 돌아가기</a></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
      })
    );
    return;
  }

  // 정적 리소스: Cache First 
  event.respondWith(
    caches.match(request).then(function(cached) {
      if (cached) {
        // 백그라운드에서 네트워크로 캐시 갱신 (Stale-While-Revalidate)
        fetch(request).then(function(response) {
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, response);
          });
        }).catch(function() {});
        return cached;
      }
      // 캐시에 없으면 네트워크 요청 후 캐시
      return fetch(request).then(function(response) {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(request, responseClone);
        });
        return response;
      });
    })
  );
});
