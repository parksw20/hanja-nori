/**
 * 미니게임 ④  블록 굴리기 (Bloxorz)
 *
 * 1×1×2 블록을 굴려 목표 구멍에 **세워서** 빠뜨리면 통과. 통과하면 한자 카드를 한 장 준다.
 * 한자와 직접 관계없는 순수 퍼즐인 이유: 아이가 "문제 푸는 시간" 없이도 놀다가 보상을 얻고,
 * 그 보상(카드)이 단어장으로 이어져 다시 한자로 돌아오게 하려는 것.
 *
 * 좌표는 (r, c) = (행, 열). 블록 자세는 셋뿐이다:
 *   stand — (r,c) 한 칸에 서 있음
 *   x     — (r,c)와 (r,c+1)에 가로로 누움
 *   y     — (r,c)와 (r+1,c)에 세로로 누움
 */
import type { GradeId } from '../data/types'
import { wordsUpTo } from '../data/words'
import * as cards from '../cards'
import * as progress from '../progress'
import * as srs from '../srs'
import { el, resultCard, toast, topBar, type Screen } from '../ui'

const GAME_ID = 'bloxorz'

/**
 * '.' 빈칸 · '#' 바닥 · 'O' 목표 구멍 · 'S' 시작(바닥)
 *
 * 손으로 그리면 **풀 수 없는 판**이 반드시 섞인다 (실제로 처음 5단계가 그랬다).
 * test/data.test.ts가 BFS로 전수 검사하고, 최소 수가 뒤로 갈수록 늘어나는지도 확인한다.
 * 뒤 숫자는 최소 굴림 수.
 */
export const LEVELS: readonly string[][] = [
  ['S##O'], // 2수 — 굴리는 법 익히기
  ['S###', '####', '###O'], // 4수
  ['.S##..', '.####.', '######', '.####.', '..##O.'], // 5수 — 판이 커진다
  ['S###..', '.####.', '..####', '...##O'], // 13수 — 계단
  ['S##..', '####.', '.####', '..##O'], // 20수 — 좁은 길
]

export type Orient = 'stand' | 'x' | 'y'
export interface Block {
  r: number
  c: number
  o: Orient
}
export type Dir = 'up' | 'down' | 'left' | 'right'

export interface Level {
  rows: number
  cols: number
  /** grid[r][c] — 0 빈칸, 1 바닥, 2 목표 */
  grid: number[][]
  start: Block
}

export function parseLevel(map: readonly string[]): Level {
  const rows = map.length
  const cols = map[0].length
  if (map.some((r) => r.length !== cols)) throw new Error('레벨의 줄 길이가 서로 다르다')

  const grid: number[][] = []
  let start: Block | null = null
  for (let r = 0; r < rows; r++) {
    const line: number[] = []
    for (let c = 0; c < cols; c++) {
      const ch = map[r][c]
      if (ch === '.') line.push(0)
      else if (ch === 'O') line.push(2)
      else line.push(1)
      if (ch === 'S') start = { r, c, o: 'stand' }
    }
    grid.push(line)
  }
  if (!start) throw new Error('레벨에 시작 지점(S)이 없다')
  return { rows, cols, grid, start }
}

/** 블록이 깔고 있는 칸들 */
export function cells(b: Block): [number, number][] {
  if (b.o === 'stand') return [[b.r, b.c]]
  if (b.o === 'x') return [
    [b.r, b.c],
    [b.r, b.c + 1],
  ]
  return [
    [b.r, b.c],
    [b.r + 1, b.c],
  ]
}

/** 굴린 뒤의 자세. 판 밖으로 나가는지는 여기서 따지지 않는다 */
export function roll(b: Block, d: Dir): Block {
  if (b.o === 'stand') {
    if (d === 'left') return { r: b.r, c: b.c - 2, o: 'x' }
    if (d === 'right') return { r: b.r, c: b.c + 1, o: 'x' }
    if (d === 'up') return { r: b.r - 2, c: b.c, o: 'y' }
    return { r: b.r + 1, c: b.c, o: 'y' }
  }
  if (b.o === 'x') {
    if (d === 'left') return { r: b.r, c: b.c - 1, o: 'stand' }
    if (d === 'right') return { r: b.r, c: b.c + 2, o: 'stand' }
    if (d === 'up') return { r: b.r - 1, c: b.c, o: 'x' }
    return { r: b.r + 1, c: b.c, o: 'x' }
  }
  if (d === 'up') return { r: b.r - 1, c: b.c, o: 'stand' }
  if (d === 'down') return { r: b.r + 2, c: b.c, o: 'stand' }
  if (d === 'left') return { r: b.r, c: b.c - 1, o: 'y' }
  return { r: b.r, c: b.c + 1, o: 'y' }
}

/** 블록이 서 있을 수 있는 자리인가 (판 안 + 바닥이 있는가) */
export function isSupported(lv: Level, b: Block): boolean {
  return cells(b).every(([r, c]) => r >= 0 && r < lv.rows && c >= 0 && c < lv.cols && lv.grid[r][c] !== 0)
}

/** 통과 조건: 목표 칸에 **세워서** 서 있을 것 */
export function isWin(lv: Level, b: Block): boolean {
  return b.o === 'stand' && lv.grid[b.r][b.c] === 2
}

const DIRS: Dir[] = ['up', 'down', 'left', 'right']
const keyOf = (b: Block) => `${b.r},${b.c},${b.o}`

/**
 * 최소 몇 번 굴리면 깨는지 (못 깨면 null).
 * 레벨을 손으로 그리면 풀 수 없는 판이 섞이기 마련이라, 테스트가 이걸로 전수 검사한다.
 */
export function solve(lv: Level): number | null {
  const seen = new Set<string>([keyOf(lv.start)])
  let frontier: Block[] = [lv.start]
  let moves = 0
  while (frontier.length) {
    const next: Block[] = []
    for (const b of frontier) {
      if (isWin(lv, b)) return moves
      for (const d of DIRS) {
        const nb = roll(b, d)
        if (!isSupported(lv, nb)) continue
        const k = keyOf(nb)
        if (seen.has(k)) continue
        seen.add(k)
        next.push(nb)
      }
    }
    frontier = next
    moves++
    if (moves > 200) return null
  }
  return null
}

/**
 * 상으로 줄 한자를 고른다.
 * 300자에서 아무거나 뽑으면 카드가 흩어져 낱말이 영영 안 모인다 →
 * **낱말을 먼저 고르고 그 안의 한 글자**를 준다. 그러면 카드가 저절로 낱말 주위에 뭉친다.
 */
export function rewardChar(grade: GradeId): string {
  const pool = wordsUpTo(grade)
  const word = pool[Math.floor(Math.random() * pool.length)]
  const chars = [...word.word]
  return chars[Math.floor(Math.random() * chars.length)]
}

export const bloxorzGame =
  (grade: GradeId, home: Screen): Screen =>
  (root, nav) => {
    const cleared = progress.bestOf(`${GAME_ID}.level`)
    // 깬 데까지는 건너뛰고, 다 깼으면 무작위로 한 판
    let levelNo = cleared >= LEVELS.length ? Math.floor(Math.random() * LEVELS.length) : cleared
    let lv = parseLevel(LEVELS[levelNo])
    let block: Block = { ...lv.start }
    let moves = 0
    let falls = 0
    let done = false

    const board = el('div', { class: 'bx-board' })
    const status = el('span', { class: 'bx-status' })
    const hint = el('p', { class: 'bx-hint', text: '블록을 굴려 노란 구멍에 세워서 빠뜨려요' })

    function draw() {
      board.style.gridTemplateColumns = `repeat(${lv.cols}, 1fr)`
      board.style.setProperty('--bx-cols', String(lv.cols))
      const occupied = new Set(cells(block).map(([r, c]) => `${r},${c}`))
      const kids: HTMLElement[] = []
      for (let r = 0; r < lv.rows; r++) {
        for (let c = 0; c < lv.cols; c++) {
          const t = lv.grid[r][c]
          const on = occupied.has(`${r},${c}`)
          const cls = [
            'bx-cell',
            t === 0 ? 'bx-cell--void' : t === 2 ? 'bx-cell--goal' : 'bx-cell--floor',
            on ? 'bx-cell--block' : '',
            on && block.o === 'stand' ? 'bx-cell--stand' : '',
          ]
            .filter(Boolean)
            .join(' ')
          kids.push(el('div', { class: cls }))
        }
      }
      board.replaceChildren(...kids)
      status.textContent = `${levelNo + 1}단계 · ${moves}번 굴림`
    }

    function nextLevel() {
      levelNo = (levelNo + 1) % LEVELS.length
      lv = parseLevel(LEVELS[levelNo])
      block = { ...lv.start }
      moves = 0
      done = false
      draw()
    }

    function win() {
      done = true
      const char = rewardChar(grade)
      cards.add(char)
      // 카드로 받은 글자도 배운 것으로 친다 — 정원에 싹이 튼다
      if (srs.isNew(char)) srs.review(char, 'right')
      progress.recordBest(`${GAME_ID}.level`, levelNo + 1)
      progress.recordBest(GAME_ID, Math.max(0, 100 - moves * 2 - falls * 10))

      const makeable = cards.completableWords(grade)
      root.replaceChildren(
        topBar('블록 굴리기', () => nav(home)),
        resultCard({
          emoji: '🎉',
          title: `한자 카드 획득!`,
          lines: [
            `${levelNo + 1}단계를 ${moves}번 만에 깼어요`,
            falls ? `${falls}번 떨어졌어요` : '한 번도 안 떨어졌어요!',
            makeable.length ? `단어장에서 ${makeable.length}개 낱말을 만들 수 있어요` : '',
          ].filter(Boolean),
          actions: [
            { label: '다음 단계', primary: true, onClick: () => nav(bloxorzGame(grade, home)) },
            { label: '정원으로', onClick: () => nav(home) },
          ],
        }),
        el('div', { class: 'bx-prize' }, [
          el('span', { class: 'bx-prize__card', text: char }),
          el('span', { class: 'bx-prize__label', text: `${char} 카드를 받았어요 (모두 ${cards.count(char)}장)` }),
        ]),
      )
    }

    function move(d: Dir) {
      if (done) return
      const nb = roll(block, d)
      if (!isSupported(lv, nb)) {
        // 판 밖으로 떨어졌다 — 처음부터
        falls++
        block = { ...lv.start }
        moves = 0
        toast(root, '앗, 떨어졌어요!', 'bad')
        board.classList.add('bx-board--fall')
        setTimeout(() => board.classList.remove('bx-board--fall'), 400)
        draw()
        return
      }
      block = nb
      moves++
      draw()
      if (isWin(lv, block)) setTimeout(win, 250)
    }

    const pad = el('div', { class: 'bx-pad' }, [
      el('button', { class: 'bx-key bx-key--up', type: 'button', text: '▲', onclick: () => move('up') }),
      el('button', { class: 'bx-key bx-key--left', type: 'button', text: '◀', onclick: () => move('left') }),
      el('button', { class: 'bx-key bx-key--right', type: 'button', text: '▶', onclick: () => move('right') }),
      el('button', { class: 'bx-key bx-key--down', type: 'button', text: '▼', onclick: () => move('down') }),
    ])

    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      }
      const d = map[e.key]
      if (!d) return
      e.preventDefault()
      move(d)
    }
    window.addEventListener('keydown', onKey)

    root.append(
      topBar('블록 굴리기', () => nav(home)),
      el('div', { class: 'bx-wrap' }, [
        status,
        board,
        hint,
        pad,
        el('button', {
          class: 'hn-btn bx-skip',
          type: 'button',
          text: '다른 단계',
          onclick: nextLevel,
        }),
      ]),
    )
    draw()

    return () => window.removeEventListener('keydown', onKey)
  }
