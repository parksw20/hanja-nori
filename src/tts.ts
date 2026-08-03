/**
 * 한국어 음성 읽기.
 *
 * 아이가 글씨를 아직 못 읽어도 훈음을 귀로 들을 수 있어야 한다.
 * 브라우저 내장 SpeechSynthesis만 쓴다 — 네트워크·키·비용이 없고 오프라인에서도 된다.
 */

let koVoice: SpeechSynthesisVoice | null = null
let ready = false

/** 목소리 목록은 비동기로 채워진다 — 한 번 잡아 두고 재사용한다. */
function pickVoice(): void {
  const voices = speechSynthesis.getVoices()
  if (voices.length === 0) return
  koVoice =
    voices.find((v) => v.lang === 'ko-KR') ??
    voices.find((v) => v.lang.startsWith('ko')) ??
    null
  ready = true
}

export function initTts(): void {
  if (!('speechSynthesis' in window)) return
  pickVoice()
  // 크롬은 목록이 늦게 온다
  speechSynthesis.addEventListener('voiceschanged', pickVoice)
}

/** 한국어 목소리가 있는지 (없으면 UI에서 스피커 아이콘을 숨긴다) */
export function hasKoreanVoice(): boolean {
  return ready && koVoice !== null
}

export function isSupported(): boolean {
  return 'speechSynthesis' in window
}

/**
 * 읽어 준다. 이전에 읽던 것은 끊는다 — 아이가 타일을 연타하면 소리가 겹쳐 알아들을 수 없다.
 * rate를 조금 낮춘 것은 훈음이 짧아서 빠르면 뭉개지기 때문.
 */
export function speak(text: string, opts: { rate?: number } = {}): void {
  if (!isSupported()) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ko-KR'
  if (koVoice) u.voice = koVoice
  u.rate = opts.rate ?? 0.85
  u.pitch = 1.1
  speechSynthesis.speak(u)
}

export function stop(): void {
  if (isSupported()) speechSynthesis.cancel()
}
