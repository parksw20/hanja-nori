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
import { wordsUpTo, hunEumOf } from '../data/words'
import * as cards from '../cards'
import * as progress from '../progress'
import * as srs from '../srs'
import * as tts from '../tts'
import { wordbookScreen } from '../wordbook'
import { el, prizeModal, resultCard, toast, topBar, type Screen } from '../ui'

const GAME_ID = 'bloxorz'

/**
 * '.' 빈칸 · '#' 바닥 · 'O' 목표 구멍 · 'S' 시작(바닥)
 *
 * 손으로 그리면 **풀 수 없는 판**이 반드시 섞인다 (실제로 처음 5단계가 그랬다).
 * test/data.test.ts가 BFS로 전수 검사하고, 최소 수가 뒤로 갈수록 늘어나는지도 확인한다.
 * 뒤 숫자는 최소 굴림 수.
 */
export const LEVELS: readonly string[][] = [
  // 1단계만 손으로 만든 튜토리얼. 나머지 29단계는 무작위 판을 수십만 개 만들어
  // 솔버로 최소 굴림 수를 재고, **난이도마다 가장 작고 단순한 판**을 골랐다.
  // 손으로 그려서는 30단계를 촘촘한 난이도로 배열하는 것도, 다 풀리는지 확신하기도 불가능하다.
  // 뒤 숫자는 최소 굴림 수 — 2부터 37까지 한 칸씩 올라간다.
  ['S##O'], // 2
  ['S##.', '.##O'], // 3
  ['S..', '###', '###', '..O'], // 4
  ['S#####.', '....##O'], // 5
  ['S#...', '#####', '#####', '...#O'], // 6
  ['S###.', '####.', '####O'], // 7
  ['S##', '###', '##O'], // 8
  ['S####', '..###', '..##O'], // 9
  ['S..', '###', '###', '###', '..O'], // 10
  ['S###..', '#####.', '..###O'], // 11
  ['S##.', '####', '..##', '..#O'], // 12
  ['S..#', '#.#.', '###.', '####', '#.##', '#.#O'], // 13
  ['S.###', '#####', '###.O'], // 14
  ['S.####', '######', '###..O'], // 15
  ['S###..#', '#####..', '..####O'], // 16
  ['S.####', '#.##.#', '######', '###.#O'], // 17
  ['S######', '##...##', '######O'], // 18
  ['S##...#', '#######', '#.#####', '.#...#O'], // 19
  ['S#..', '###.', '####', '.###', '..#O'], // 20
  ['S###.', '.####', '###.#', '#####', '##..O'], // 21
  ['S###', '###.', '.###', '.###', '..#O'], // 22
  ['S##....', '######.', '.####.#', '##.###O'], // 23
  ['S#.##', '###..', '####.', '..###', '.###O'], // 24
  ['S######', '##.####', '###..##', '.#####.', '######O'], // 25
  ['S.#.###', '######.', '######.', '##..###', '###..##', '..####O'], // 26
  ['S.#####', '####.##', '#######', '.##.###', '.####.O'], // 27
  ['S#.###', '####..', '####.#', '..####', '..#.##', '.####O'], // 28
  ['S#..####', '########', '##.###.#', '###..##.', '.####..#', '.######O'], // 30
  ['S#######', '#.####.#', '###.####', '.####.##', '.#######', '##.#..##', '#######O'], // 32
  ['S####.#', '#.#####', '###.###', '###...#', '.####.#', '##.####', '#####.O'], // 37
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

    // ── 3D 렌더링 ──────────────────────────────────────────
    // 2D 격자로는 블록이 **서 있는지 누웠는지**를 알 수 없다 — 그게 이 퍼즐의 전부인데.
    // 그래서 CSS 3D로 실제 입체를 세운다. 바닥은 두께가 있는 판, 블록은 면 3개(윗면·앞면·옆면)로
    // 만든 상자다. 카메라 각도에서 보이는 면만 그린다 (뒷면은 어차피 안 보인다).
    const view = el('div', { class: 'bx-view' })
    const scene = el('div', { class: 'bx-scene' })
    view.append(scene)
    const status = el('span', { class: 'bx-status' })
    const hint = el('p', { class: 'bx-hint', text: '블록을 굴려 노란 구멍에 세워서 빠뜨려요' })

    /**
     * 장면 기울기 — 이 값이 바뀌면 아래 높이 계산의 계수도 같이 바뀐다.
     *
     * **Z축(요) 회전은 넣지 않는다.** 비스듬히 돌려 놓으면 그림은 예쁘지만
     * ▲를 눌렀을 때 블록이 화면에서 대각선으로 움직여 방향키와 안 맞는다.
     * 기울이기만 하면 행 = 화면 세로, 열 = 화면 가로가 그대로 유지된다.
     */
    const TILT = 58 // rotateX(도)
    const SLAB = 0.16 // 바닥 판 두께 (칸 크기 대비)

    function face(cls: string, w: number, h: number, transform: string): HTMLElement {
      const d = el('div', { class: `bx-face ${cls}` })
      d.style.width = `${w}px`
      d.style.height = `${h}px`
      d.style.transform = transform
      return d
    }

    function draw() {
      // 기울이기만 하므로 가로 폭은 열 수에만 비례한다 (원근 때문에 뒷줄은 오히려 좁아진다)
      const avail = view.clientWidth || 360
      const S = Math.max(30, Math.min(96, Math.floor((avail - 20) / lv.cols)))
      const T = Math.round(S * SLAB)
      const W = lv.cols * S
      const H = lv.rows * S

      scene.style.width = `${W}px`
      scene.style.height = `${H}px`
      // 기울여 놓은 바닥의 세로 투영 + 서 있는 블록(2칸)이 위로 뻗는 높이
      const tiltRad = (TILT * Math.PI) / 180
      view.style.height = `${Math.round(H * Math.cos(tiltRad) + 2 * S * Math.sin(tiltRad) + 36)}px`

      const parts: HTMLElement[] = []

      // 바닥 — 윗면 + 카메라 쪽 두 옆면(두께)
      for (let r = 0; r < lv.rows; r++) {
        for (let c = 0; c < lv.cols; c++) {
          const t = lv.grid[r][c]
          if (t === 0) continue
          const x = c * S
          const y = r * S
          const top = t === 2 ? 'bx-face--goal' : 'bx-face--floor'
          parts.push(face(top, S, S, `translate3d(${x}px, ${y}px, 0px)`))
          // 옆면(x축에 수직인 면)은 정면에서 보면 두께가 0이라 안 보인다 → 앞면만 그린다
          parts.push(face('bx-face--slab', S, T, `translate3d(${x}px, ${y + S}px, 0px) rotateX(-90deg)`))
        }
      }

      // 블록 — 자세에 따라 상자의 가로·세로·높이가 바뀐다
      const w = block.o === 'x' ? 2 * S : S
      const d = block.o === 'y' ? 2 * S : S
      const h = block.o === 'stand' ? 2 * S : S
      const bx = block.c * S
      const by = block.r * S

      // 바닥에 드리운 그림자 — 블록이 어느 칸 위에 있는지 바로 읽힌다
      parts.push(face('bx-face--shadow', w, d, `translate3d(${bx}px, ${by}px, 1px)`))
      // 상자 다섯 면을 다 그린다. 원근(perspective) 덕분에 블록이 가운데를 벗어나면
      // 옆면도 실제로 보인다 — 가려지는 면은 브라우저가 깊이로 알아서 정리한다.
      parts.push(face('bx-face--btop', w, d, `translate3d(${bx}px, ${by}px, ${h}px)`))
      parts.push(face('bx-face--bfront', w, h, `translate3d(${bx}px, ${by + d}px, ${h}px) rotateX(-90deg)`))
      parts.push(face('bx-face--bback', w, h, `translate3d(${bx}px, ${by}px, ${h}px) rotateX(-90deg)`))
      parts.push(face('bx-face--bright', h, d, `translate3d(${bx + w}px, ${by}px, ${h}px) rotateY(90deg)`))
      parts.push(face('bx-face--bleft', h, d, `translate3d(${bx}px, ${by}px, ${h}px) rotateY(90deg)`))

      scene.replaceChildren(...parts)
      // 전체 단계 수를 같이 보여 준다 — 안 그러면 "여기서 안 넘어가나?" 싶어진다
      status.textContent = `${levelNo + 1} / ${LEVELS.length}단계 · ${moves}번 굴림 · ${
        block.o === 'stand' ? '서 있음' : '누움'
      }`

      // 블록이 서면 카메라를 살짝 낮춰 키가 더 드러나게 한다
      const tilt = block.o === 'stand' ? TILT - 5 : TILT

      /*
        판이 뷰에 딱 맞게 자동 보정.

        원근이 걸려 있으면 "가로 = 열수 × 칸크기"라는 계산이 안 맞는다 — 앞줄이 확대되기 때문.
        게다가 `scale()`은 원근 **안쪽**에서 걸려서 깊이까지 같이 줄인다. 즉 한 번 재서 한 번
        줄이면 딱 안 맞는다(비선형). 그래서 **줄이고 다시 재기를 몇 번 반복해** 수렴시킨다.
        마지막 이동(translate)은 원근 바깥의 순수 화면 이동이라 한 번에 정확히 가운데로 간다.
      */
      const vb = view.getBoundingClientRect()
      if (vb.width > 0 && parts.length) {
        const bbox = () => {
          const rs = [...scene.children].map((c) => (c as HTMLElement).getBoundingClientRect())
          return {
            l: Math.min(...rs.map((r) => r.left)),
            r: Math.max(...rs.map((r) => r.right)),
            t: Math.min(...rs.map((r) => r.top)),
            b: Math.max(...rs.map((r) => r.bottom)),
          }
        }
        // translate도 원근 안쪽이라 깊이에 따라 화면 이동량이 달라진다 → 크기와 위치를 같이 수렴시킨다
        const pad = 16
        const cx = vb.left + vb.width / 2
        const cy = vb.top + vb.height / 2
        let k = 1
        let dx = 0
        let dy = 0
        for (let i = 0; i < 5; i++) {
          scene.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${k.toFixed(4)}) rotateX(${tilt}deg)`
          const bb = bbox()
          const kk = Math.min(1, (vb.width - pad) / (bb.r - bb.l), (vb.height - pad) / (bb.b - bb.t))
          const ex = cx - (bb.l + bb.r) / 2
          const ey = cy - (bb.t + bb.b) / 2
          if (kk > 0.999 && Math.abs(ex) < 0.5 && Math.abs(ey) < 0.5) break
          k *= kk
          dx += ex
          dy += ey
        }
        scene.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${k.toFixed(4)}) rotateX(${tilt}deg)`
      } else {
        scene.style.transform = `rotateX(${tilt}deg)`
      }
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

      function showResult() {
        root.replaceChildren(
          topBar('블록 굴리기', () => nav(home)),
          resultCard({
            emoji: '🎉',
            title: `${levelNo + 1}단계 통과!`,
            lines: [
              `${moves}번 만에 깼어요`,
              falls ? `${falls}번 떨어졌어요` : '한 번도 안 떨어졌어요!',
              `${char} 카드를 받았어요 (모두 ${cards.count(char)}장)`,
              makeable.length ? `단어장에서 ${makeable.length}개 낱말을 만들 수 있어요` : '',
            ].filter(Boolean),
            actions: [
              { label: '다음 단계', primary: true, onClick: () => nav(bloxorzGame(grade, home)) },
              { label: '단어장 보기', onClick: () => nav(wordbookScreen(grade, home)) },
              { label: '정원으로', onClick: () => nav(home) },
            ],
          }),
        )
      }

      // 결과 화면에 슬쩍 끼워 넣으면 카드를 받은 줄 모른다 — 짜잔 하고 덮어서 보여 준다
      tts.speak(hunEumOf(char))
      root.append(
        prizeModal({
          char,
          title: `${hunEumOf(char)} 카드`,
          lines: [`${char} 카드를 받았어요`, `모두 ${cards.count(char)}장`],
          onConfirm: showResult,
        }),
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
        view.classList.add('bx-view--fall')
        setTimeout(() => view.classList.remove('bx-view--fall'), 400)
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
    // 화면을 돌리거나 창을 줄이면 칸 크기를 다시 잡아야 판이 안 잘린다
    const onResize = () => draw()
    window.addEventListener('resize', onResize)

    root.append(
      topBar('블록 굴리기', () => nav(home)),
      el('div', { class: 'bx-wrap' }, [
        status,
        view,
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

    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }
