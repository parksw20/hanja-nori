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

  /**
   * 「기록 처음부터」를 누를 때 물어보는 비밀번호.
   *
   * **막으려는 것은 아이의 손가락이지 남의 침입이 아니다.** 이 값은 이 브라우저에
   * 그냥 적혀 있고, 소스도 공개돼 있다 — 마음먹은 사람은 얼마든지 지울 수 있다.
   * 확인 창을 두 번 띄워도 아이는 그냥 두 번 누르기 때문에, "아는 사람만 통과하는"
   * 한 단계가 필요해서 넣었다.
   *
   * 백업 파일(hanja-nori.* 전부를 담는다)에도 그대로 들어간다 — 그 파일은 어른 것이니
   * 문제될 게 없지만, 남에게 줄 만한 물건은 아니라는 뜻이다.
   */
  resetPassword: string
}

export const DEFAULT_RESET_PASSWORD = '1234'

const DEFAULTS: Prefs = { dokeumRamp: true, resetPassword: DEFAULT_RESET_PASSWORD }

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

/** 앞뒤 공백은 무시한다 — 아이 것이 아니라 어른이 급히 치는 값이다 */
export function checkResetPassword(input: string): boolean {
  return input.trim() === p.resetPassword
}

export function setResetPassword(pw: string): void {
  p = { ...p, resetPassword: pw.trim() }
  save()
}
