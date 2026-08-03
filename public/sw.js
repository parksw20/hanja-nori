/**
 * 서비스 워커 — 한 번 받은 뒤에는 인터넷 없이도 놀 수 있게 한다.
 *
 * 획순 데이터가 커서(300자) 매번 받으면 태블릿에서 답답하다.
 * 전략: 같은 출처의 GET은 캐시 우선, 없으면 네트워크 → 캐시에 저장.
 * 배포할 때마다 CACHE 이름을 바꾸면 낡은 캐시가 정리된다.
 */
const CACHE = 'hanja-nori-v1'

self.addEventListener('install', (e) => {
  // 새 워커를 바로 활성화 — 아이가 앱을 두 번 껐다 켜야 하는 일이 없게
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest'])))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  if (new URL(req.url).origin !== self.location.origin) return

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req)
          .then((res) => {
            // 실패 응답을 캐시에 넣으면 그 뒤로 계속 실패한다
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          })
          // 오프라인인데 캐시에도 없으면 최소한 첫 화면은 돌려준다
          .catch(() => caches.match('./index.html')),
    ),
  )
})
