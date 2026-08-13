/**
 * 효과음 — 파일 없이 Web Audio로 직접 만든다.
 *
 * mp3를 넣으면 용량도 늘고 오프라인 캐시도 커진다. 짧은 삑 소리 몇 개면 충분하고,
 * 소리 파일이 없으니 서비스 워커가 받을 것도 없다.
 *
 * AudioContext는 **사용자가 처음 무언가를 누른 뒤에야** 만들 수 있다(브라우저 자동재생 정책).
 * 그래서 첫 소리를 낼 때 만든다.
 */

const KEY = 'hanja-nori.sound'
const VOL_KEY = 'hanja-nori.sound.volume'

let ctx: AudioContext | null = null
let on = true
/** 소리 크기 배수. 1이 원래 크기 */
let vol = 1

/** 저장소에서 다시 읽어 온다 — 기록을 불러온 직후처럼 밖에서 값이 바뀐 경우 */
export function reload(): void {
  try {
    on = localStorage.getItem(KEY) !== 'off'
    const saved = Number(localStorage.getItem(VOL_KEY))
    vol = Number.isFinite(saved) && saved > 0 ? saved : 1
  } catch {
    /* 저장소가 막혀도 소리는 켜 둔다 */
  }
}

reload()

export function isOn(): boolean {
  return on
}

/** 고를 수 있는 크기 — 아이가 슬라이더를 미세 조정하지는 않는다 */
export const VOLUMES: { label: string; value: number }[] = [
  { label: '작게', value: 0.45 },
  { label: '보통', value: 1 },
  { label: '크게', value: 1.8 },
]

export function volume(): number {
  return vol
}

/** 크기를 바꾸고 그 자리에서 한 번 들려준다 — 귀로 확인하지 않으면 고른 의미가 없다 */
export function setVolume(v: number): void {
  vol = v
  try {
    localStorage.setItem(VOL_KEY, String(v))
  } catch {
    /* 무시 */
  }
  if (on) tap()
}

export function toggle(): boolean {
  on = !on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* 무시 */
  }
  if (on) tap()
  return on
}

function audio(): AudioContext | null {
  if (!on) return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
    } catch {
      return null
    }
  }
  // 탭을 다녀오면 멈춰 있을 수 있다
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** 짧은 음 하나. delay를 주면 이어서 울린다(작은 멜로디용). */
function tone(freq: number, dur: number, opts: { delay?: number; gain?: number; type?: OscillatorType } = {}): void {
  const ac = audio()
  if (!ac) return
  const t0 = ac.currentTime + (opts.delay ?? 0)
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  // 뚝 끊기면 "틱" 하는 잡음이 난다 — 짧게 올렸다 부드럽게 내린다
  // (0.07로 시작했는데 굽어 들어 보니 너무 작았다 — 태블릿 스피커에서도 들리게 올렸다)
  // 0으로 곱해지면 exponentialRamp가 던진다 — 크기는 늘 양수로 유지한다
  const peak = (opts.gain ?? 0.13) * vol
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** 보기를 고를 때 */
export function tap(): void {
  tone(720, 0.08)
}

/** 이전·다음처럼 이동할 때 (조금 낮게) */
export function move(): void {
  tone(480, 0.07, { gain: 0.09 })
}

/** 제출처럼 확정하는 순간 */
export function submit(): void {
  tone(560, 0.1)
  tone(840, 0.14, { delay: 0.09 })
}

/**
 * 박수 — 짧은 잡음 조각을 수십 번 흩뿌려 만든다.
 *
 * 손뼉 하나는 "넓은 주파수의 아주 짧은 잡음"이라, 화이트노이즈를 밴드패스로 걸러
 * 4ms 만에 튀었다가 50ms 안에 사라지게 하면 그럴듯한 박수가 된다.
 * 시작 시각·세기·음색을 조금씩 흩어 놓아야 한 사람이 아니라 여럿이 치는 소리로 들린다.
 */
export function applause(delay = 0): void {
  const ac = audio()
  if (!ac) return

  // 손뼉 한 번 분량의 잡음. 조각 하나를 여러 번 재사용한다.
  const len = Math.floor(ac.sampleRate * 0.06)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  const t0 = ac.currentTime + delay
  const span = 1.9
  for (let i = 0; i < 48; i++) {
    // 앞쪽에 몰렸다가 뒤로 갈수록 뜸해지게 (박수는 우르르 시작해 잦아든다)
    const t = t0 + Math.pow(Math.random(), 0.65) * span
    const src = ac.createBufferSource()
    src.buffer = buf
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1100 + Math.random() * 1900
    bp.Q.value = 0.7
    const g = ac.createGain()
    const peak = (0.07 + Math.random() * 0.08) * vol
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.06)
    src.connect(bp).connect(g).connect(ac.destination)
    src.start(t)
    src.stop(t + 0.14)
  }
}

/**
 * 한자 카드를 받을 때 — 반짝이며 쏟아지는 소리.
 *
 * 합격 팡파르(fanfare)와는 다르게 들려야 한다. 팡파르는 "해냈다", 이건 "받았다"다.
 * 짧게 올라가는 세 음 뒤에 높은 반짝임을 장수만큼 흩뿌린다 — 많이 받을수록 오래 반짝인다.
 */
export function card(n = 1): void {
  tone(784, 0.1, { gain: 0.1 }) // 솔
  tone(1047, 0.12, { delay: 0.07 }) // 높은 도
  tone(1319, 0.2, { delay: 0.15 }) // 높은 미
  // 30장을 받아도 반짝임이 30번 울리면 시끄럽다 — 여섯 번에서 끊는다
  const sparkles = Math.min(Math.max(n, 1), 6)
  for (let i = 0; i < sparkles; i++) {
    tone(1568 + i * 120, 0.09, { delay: 0.24 + i * 0.07, gain: 0.05, type: 'triangle' })
  }
}

/** 합격 */
export function fanfare(): void {
  tone(523, 0.14) // 도
  tone(659, 0.14, { delay: 0.13 }) // 미
  tone(784, 0.14, { delay: 0.26 }) // 솔
  tone(1047, 0.26, { delay: 0.39 }) // 높은 도
}

/** 불합격 — 야단치는 소리가 되지 않게 낮고 짧게 */
export function soft(): void {
  tone(392, 0.16, { gain: 0.09 })
  tone(294, 0.22, { delay: 0.14, gain: 0.05 })
}
