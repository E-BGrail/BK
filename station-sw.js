// 역 안내 화면(station.html) 서비스 워커: 화면 파일은 인터넷 먼저(안 되면 저장본), 이미지는 저장본 먼저 → 인터넷이 끊겨도 안내 이미지 계속 보임
// 역 파일(s/….json)은 저장하지 않음 (늘 최신을 읽음)
var SHELL = 'bgl-st-shell-v1', IMG = 'bgl-st-img-v1';
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(['station.html', 'station.webmanifest', 'station-192.png']); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (/\/img\/[^/]+$/.test(u.pathname)) {
    e.respondWith(caches.open(IMG).then(function (c) {
      return c.match(e.request).then(function (hit) {
        return hit || fetch(e.request).then(function (r) { if (r.ok) c.put(e.request, r.clone()); return r; });
      });
    }));
    return;
  }
  if (u.origin === location.origin && /\/station(\.html|\.webmanifest|-192\.png)$/.test(u.pathname)) {
    e.respondWith(fetch(e.request).then(function (r) {
      if (r.ok) { var cp = r.clone(); caches.open(SHELL).then(function (c) { c.put(e.request, cp); }); }
      return r;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
  }
});
