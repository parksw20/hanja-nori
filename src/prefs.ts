/**
 * 놀이 방식에 대한 **취향** 설정.
 *
 * progress(급수증·최고기록)와 일부러 분리했다. 저것은 아이가 쌓은 것이라 백업·복원 대상이고,
 * 이것은 기기마다 다를 수 있는 취향이다 — 기록을 되돌려도 이 값은 그 기기 것을 그대로 둔다.
 */

const KEY = 'hanja-nori.prefs.v1'

export interface Prefs {
  /**
   * 독음 요격에서 맞힐수록 낙하가 빨라지는가.
   *
   * 기본은 빨라진다(가중). 다만 아직 읽기가 느린 아이에게는 몇 판 못 가서
   * 따라잡을 수 없는 속도가 되어 재미보다 부담이 커진다 — 그럴 때 끈다.
   */
  dokeumRamp: boolean
}

const DEFAULTS: Prefs = { dokeumRamp: true }

let p: Prefs = load()

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    // 저장된 값에 없는 항목은 기본값으로 채운다 — 설정이 늘어나도 예전 저장본이 안 깨진다
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) }
  } catch {
    return { ...DEFAULTS }
  }
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* 저장소가 막혀도 이번 판은 그대로 굴러가야 한다 */
  }
}

export function get(): Prefs {
  return p
}

export function setDokeumRamp(on: boolean): void {
  p = { ...p, dokeumRamp: on }
  save()
}
