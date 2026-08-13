/**
 * 기록 백업·복원.
 *
 * 진행 기록은 브라우저의 localStorage에만 있다. 앱을 새로 배포해도 지워지지 않지만,
 * **브라우저 데이터를 지우거나 · 다른 기기로 옮기거나 · 시크릿 모드로 열면** 사라진다.
 * 그래서 파일로 빼 두고 되돌릴 수 있게 한다.
 */

import * as srs from './srs'
import * as progress from './progress'
import * as cards from './cards'
import * as prefs from './prefs'
import * as sfx from './sfx'
import * as tts from './tts'

/** 우리가 쓰는 저장소 키는 전부 이 접두어로 시작한다 */
const PREFIX = 'hanja-nori.'

export interface Backup {
  app: 'hanja-nori'
  version: 1
  savedAt: string
  data: Record<string, string>
}

export function collect(): Backup {
  const data: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(PREFIX)) continue
    const v = localStorage.getItem(k)
    if (v !== null) data[k] = v
  }
  return { app: 'hanja-nori', version: 1, savedAt: new Date().toISOString(), data }
}

/** 파일로 내려받기 */
export function download(): void {
  const backup = collect()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `한자놀이-기록-${backup.savedAt.slice(0, 10)}.json`
  a.click()
  // 즉시 지우면 다운로드가 취소되는 브라우저가 있다
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 파일에서 되돌리기. 성공하면 복원한 키 수를 준다 */
export function restore(text: string): number {
  const parsed: unknown = JSON.parse(text)
  const b = parsed as Partial<Backup>
  if (!b || b.app !== 'hanja-nori' || typeof b.data !== 'object' || b.data === null) {
    throw new Error('한자놀이 백업 파일이 아니에요')
  }
  let n = 0
  for (const [k, v] of Object.entries(b.data)) {
    // 남의 키를 덮어쓰지 않는다
    if (!k.startsWith(PREFIX) || typeof v !== 'string') continue
    localStorage.setItem(k, v)
    n++
  }
  if (n === 0) throw new Error('백업 파일에 기록이 없어요')

  /*
    각 모듈은 불러올 때 저장소를 한 번 읽고 그 값을 들고 있다. 저장소만 덮어써 두면
    화면을 다시 그려도 **모듈이 든 옛 값**이 나온다 — 실제로 새로고침해야 반영됐다.
    되돌린 자리에서 전부 다시 읽게 한다.
  */
  for (const m of [srs, progress, cards, prefs, sfx, tts]) m.reload()
  return n
}

/** 파일 고르기 창을 열고 복원한다 */
export function pickAndRestore(onDone: (n: number) => void, onError: (msg: string) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return
    file
      .text()
      .then((t) => onDone(restore(t)))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : '파일을 읽지 못했어요'))
  })
  input.click()
}
