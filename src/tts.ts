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
const RATE_KEY = 'hanja-nori.voice.rate'

/**
 * 말 빠르기 배수. 부르는 쪽이 정한 rate에 **곱한다** —
 * 훈음처럼 원래 천천히 읽던 것은 여전히 상대적으로 천천히 읽혀야 한다.
 */
let rateScale = 1
try {
  const saved = Number(localStorage.getItem(RATE_KEY))
  if (Number.isFinite(saved) && saved > 0) rateScale = saved
} catch {
  /* 저장소가 막혀도 기본 속도로 읽는다 */
}

/** 고를 수 있는 빠르기 */
export const RATES: { label: string; value: number }[] = [
  { label: '느리게 (0.8배)', value: 0.8 },
  { label: '보통 (1배)', value: 1 },
  { label: '빠르게 (1.2배)', value: 1.2 },
]

export function rate(): number {
  return rateScale
}

export function setRate(v: number): void {
  rateScale = v
  try {
    localStorage.setItem(RATE_KEY, String(v))
  } catch {
    /* 무시 */
  }
}

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
export function speak(text: string, opts: { rate?: number; onEnd?: () => void } = {}): void {
  if (!isSupported()) {
    // 음성이 없는 기기에서도 뒷일(축하 모달 등)은 이어져야 한다
    if (opts.onEnd) setTimeout(opts.onEnd, 300)
    return
  }
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ko-KR'
  if (koVoice) u.voice = koVoice
  // 브라우저가 받아 주는 범위(0.1~10)를 벗어나면 조용히 무시되거나 튄다
  u.rate = Math.max(0.1, Math.min(10, (opts.rate ?? 0.9) * rateScale))
  // 피치를 올리면 구형 음성은 더 기계처럼 들린다 — 있는 그대로 둔다
  u.pitch = 1

  if (opts.onEnd) {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      opts.onEnd!()
    }
    u.addEventListener('end', finish)
    u.addEventListener('error', finish)
    // 음성이 아예 안 울리는 경우(권한·버그)에도 멈추지 않게 안전장치.
    // 한글 한 글자에 대략 0.25초 + 여유. 느리게 읽도록 해 두면 그만큼 더 기다려야 한다 —
    // 안 그러면 말이 끝나기도 전에 다음 소리(빠밤)가 겹친다.
    setTimeout(finish, (900 + text.length * 260) / rateScale)
  }

  speechSynthesis.speak(u)
}

export function stop(): void {
  if (isSupported()) speechSynthesis.cancel()
}
