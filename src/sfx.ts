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

let ctx: AudioContext | null = null
let on = true

try {
  on = localStorage.getItem(KEY) !== 'off'
} catch {
  /* 저장소가 막혀도 소리는 켜 둔다 */
}

export function isOn(): boolean {
  return on
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
  const peak = opts.gain ?? 0.07
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
  tone(480, 0.07, { gain: 0.05 })
}

/** 제출처럼 확정하는 순간 */
export function submit(): void {
  tone(560, 0.1)
  tone(840, 0.14, { delay: 0.09 })
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
  tone(392, 0.16, { gain: 0.05 })
  tone(294, 0.22, { delay: 0.14, gain: 0.05 })
}
