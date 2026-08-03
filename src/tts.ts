/**
 * 한국어 음성 읽기.
 *
 * 아이가 글씨를 아직 못 읽어도 훈음을 귀로 들을 수 있어야 한다.
 * 브라우저 내장 SpeechSynthesis만 쓴다 — 네트워크·키·비용이 없고 오프라인에서도 된다.
 */

let koVoice: SpeechSynthesisVoice | null = null
let ready = false

/**
 * 한국어 목소리 고르기 — **좋은 것부터**.
 *
 * 윈도우 크롬의 기본값은 `Microsoft Heami`인데 옛날 방식(concatenative)이라 딱딱하다.
 * 요즘 브라우저에는 훨씬 사람 같은 신경망 음성이 있는데 이름이 제각각이라 우선순위로 고른다:
 *   - Edge: "Microsoft SunHi Online (Natural) - Korean" 등 (Natural/Online)
 *   - Chrome·안드로이드: "Google 한국의"
 *   - 아이폰·맥: "Yuna"
 * 그래도 없으면 아무 한국어 음성이나 쓴다.
 */
const VOICE_PREFERENCE: ((v: SpeechSynthesisVoice) => boolean)[] = [
  (v) => /natural/i.test(v.name),
  (v) => /online/i.test(v.name),
  (v) => /google/i.test(v.name),
  (v) => /yuna|sora|siri/i.test(v.name),
  // 네트워크 음성은 대체로 신경망이다
  (v) => v.localService === false,
  () => true,
]

const PREF_KEY = 'hanja-nori.voice'

function pickVoice(): void {
  const all = speechSynthesis.getVoices()
  if (all.length === 0) return
  const ko = all.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ko'))

  // 사용자가 고른 목소리가 있으면 그것이 먼저다
  const saved = localStorage.getItem(PREF_KEY)
  const chosen = saved ? ko.find((v) => v.name === saved) : null
  if (chosen) {
    koVoice = chosen
    ready = true
    return
  }

  koVoice = null
  for (const prefers of VOICE_PREFERENCE) {
    const hit = ko.find(prefers)
    if (hit) {
      koVoice = hit
      break
    }
  }
  ready = true
}

/** 고른 목소리 이름 (설정 화면·문제 확인용) */
export function voiceName(): string | null {
  return koVoice?.name ?? null
}

/** 쓸 수 있는 한국어 목소리 전부 */
export function koreanVoices(): SpeechSynthesisVoice[] {
  return speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ko'))
}

/** 사용자가 고른 목소리로 바꾸고 기억한다 */
export function useVoice(name: string): void {
  const hit = koreanVoices().find((v) => v.name === name)
  if (!hit) return
  koVoice = hit
  try {
    localStorage.setItem(PREF_KEY, name)
  } catch {
    /* 저장이 막혀도 이번 세션에서는 적용된다 */
  }
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
  u.rate = opts.rate ?? 0.9
  // 피치를 올리면 구형 음성은 더 기계처럼 들린다 — 있는 그대로 둔다
  u.pitch = 1
  speechSynthesis.speak(u)
}

export function stop(): void {
  if (isSupported()) speechSynthesis.cancel()
}
