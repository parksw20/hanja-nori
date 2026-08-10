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
import { pickRewards } from '../reward'
import * as cards from '../cards'
import * as progress from '../progress'
import * as srs from '../srs'
import * as sfx from '../sfx'
import { wordbookScreen } from '../wordbook'
import { cardsModal, el, resultModal, toast, topAction, topBar, type Screen } from '../ui'

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

export const bloxorzGame =
  (grade: GradeId, home: Screen): Screen =>
  (root, nav) => {
    const cleared = progress.bestOf(`${GAME_ID}.level`)
    /**
     * 열린 단계 수 = 깬 단계 + 1. **앞 단계를 깨야 다음 단계가 열린다.**
     * 깬 단계는 다시 골라 놀 수 있지만(쉬운 판으로 돌아가 카드를 더 모을 수 있게),
     * 아직 못 깬 단계로는 건너뛸 수 없다.
     */
    const unlocked = Math.min(cleared + 1, LEVELS.length)
    let levelNo = Math.min(cleared, LEVELS.length - 1)
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
    /** 블록 다섯 면을 묶어 두는 그룹 — 굴릴 때 이 묶음만 모서리를 축으로 돌린다 */
    const blockGroup = el('div', { class: 'bx-block' })
    view.append(scene)
    /** 한 번 굴리는 데 걸리는 시간(ms) */
    const ROLL_MS = 180
    /** 판 밖으로 떨어지는 데 걸리는 시간(ms) — 넘어가고 + 떨어지고 */
    const FALL_MS = 520
    /** 굴러가는 중에는 다음 입력을 받지 않는다 (겹치면 자세가 꼬인다) */
    let rolling = false
    /** 지금 도는 굴림 애니메이션 (화면을 떠날 때 정리한다) */
    let rollAnim: Animation | null = null
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

    /**
     * 판을 뷰에 맞추는 변환. **판마다 한 번만** 정한다.
     *
     * 예전에는 굴릴 때마다 다시 쟀는데, 블록이 움직이면 차지하는 영역이 달라져서
     * 판 전체가 조금씩 움직이고 커졌다 작아졌다 했다 — 굴리는 것보다 그게 더 눈에 띄었다.
     * 이제 블록이 어디에 서 있어도 다 담기는 크기로 한 번 잡고 그대로 쓴다.
     */
    let fit = ''
    let S = 60
    let T = 10

    function layoutFit() {
      /*
        뷰 높이는 CSS가 고정한다 — 판 크기에 따라 높이가 바뀌면 아래 방향키가 매번
        다른 자리로 옮겨 다닌다(실제로 1단계와 3단계에서 버튼 위치가 달랐다).
        대신 **칸 크기를 가로·세로 양쪽에 맞춰** 잡아 작은 판은 크게, 큰 판은 작게 그린다.
      */
      const availW = view.clientWidth || 360
      const availH = view.clientHeight || 320
      const tiltRad = (TILT * Math.PI) / 180
      const byWidth = (availW - 20) / lv.cols
      // 기울인 바닥의 세로 투영 + 서 있는 블록(2칸)이 위로 뻗는 높이
      const byHeight = (availH - 24) / (lv.rows * Math.cos(tiltRad) + 2 * Math.sin(tiltRad))
      S = Math.max(26, Math.min(120, Math.floor(Math.min(byWidth, byHeight))))
      T = Math.round(S * SLAB)
      scene.style.width = `${lv.cols * S}px`
      scene.style.height = `${lv.rows * S}px`

      // 바닥 + 네 귀퉁이에 세워 둔 유령 블록 = 어떤 자세·위치에서도 넘지 않는 최대 영역
      const probe: HTMLElement[] = []
      for (let r = 0; r < lv.rows; r++) {
        for (let c = 0; c < lv.cols; c++) {
          if (lv.grid[r][c] === 0) continue
          probe.push(face('bx-face--floor', S, S, `translate3d(${c * S}px, ${r * S}px, 0px)`))
          probe.push(face('bx-face--slab', S, T, `translate3d(${c * S}px, ${(r + 1) * S}px, 0px) rotateX(-90deg)`))
        }
      }
      const corners: [number, number][] = [
        [0, 0],
        [0, lv.cols - 1],
        [lv.rows - 1, 0],
        [lv.rows - 1, lv.cols - 1],
      ]
      for (const [r, c] of corners) {
        const x = c * S
        const y = r * S
        probe.push(face('bx-face--btop', S, S, `translate3d(${x}px, ${y}px, ${2 * S}px)`))
        probe.push(face('bx-face--bfront', S, 2 * S, `translate3d(${x}px, ${y + S}px, ${2 * S}px) rotateX(-90deg)`))
      }
      scene.replaceChildren(...probe)

      const vb = view.getBoundingClientRect()
      const bbox = () => {
        const rs = [...scene.children].map((c) => (c as HTMLElement).getBoundingClientRect())
        return {
          l: Math.min(...rs.map((r) => r.left)),
          r: Math.max(...rs.map((r) => r.right)),
          t: Math.min(...rs.map((r) => r.top)),
          b: Math.max(...rs.map((r) => r.bottom)),
        }
      }
      const pad = 16
      const cx = vb.left + vb.width / 2
      const cy = vb.top + vb.height / 2
      let k = 1
      let dx = 0
      let dy = 0
      for (let i = 0; i < 5; i++) {
        scene.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${k.toFixed(4)}) rotateX(${TILT}deg)`
        const bb = bbox()
        const kk = Math.min(1, (vb.width - pad) / (bb.r - bb.l), (vb.height - pad) / (bb.b - bb.t))
        const ex = cx - (bb.l + bb.r) / 2
        const ey = cy - (bb.t + bb.b) / 2
        if (kk > 0.999 && Math.abs(ex) < 0.5 && Math.abs(ey) < 0.5) break
        k *= kk
        dx += ex
        dy += ey
      }
      fit = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${k.toFixed(4)}) rotateX(${TILT}deg)`
      scene.style.transform = fit
      // 재던 유령 블록을 치우고 진짜 바닥을 깐다
      drawFloor()
    }

    /** 블록의 치수와 위치 (px) */
    function geo(b: Block) {
      return {
        w: b.o === 'x' ? 2 * S : S,
        d: b.o === 'y' ? 2 * S : S,
        h: b.o === 'stand' ? 2 * S : S,
        x: b.c * S,
        y: b.r * S,
      }
    }

    /** 바닥은 판이 바뀔 때만 다시 그린다 */
    function drawFloor() {
      const parts: HTMLElement[] = []
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
      // 블록은 따로 묶어 둔다 — 굴릴 때 이 묶음만 모서리를 축으로 돌린다
      scene.replaceChildren(...parts, blockGroup)
      scene.style.transform = fit
    }

    /** 블록 상자를 그 자세·위치에 맞게 그린다 */
    function drawBlock(b: Block) {
      const { w, d, h, x, y } = geo(b)
      blockGroup.replaceChildren(
        // 바닥에 드리운 그림자 — 블록이 어느 칸 위에 있는지 바로 읽힌다
        face('bx-face--shadow', w, d, `translate3d(${x}px, ${y}px, 1px)`),
        // 상자 다섯 면. 원근(perspective) 덕분에 블록이 가운데를 벗어나면 옆면도 실제로 보인다.
        face('bx-face--btop', w, d, `translate3d(${x}px, ${y}px, ${h}px)`),
        face('bx-face--bfront', w, h, `translate3d(${x}px, ${y + d}px, ${h}px) rotateX(-90deg)`),
        face('bx-face--bback', w, h, `translate3d(${x}px, ${y}px, ${h}px) rotateX(-90deg)`),
        face('bx-face--bright', h, d, `translate3d(${x + w}px, ${y}px, ${h}px) rotateY(90deg)`),
        face('bx-face--bleft', h, d, `translate3d(${x}px, ${y}px, ${h}px) rotateY(90deg)`),
      )
    }

    function draw() {
      drawBlock(block)
      blockGroup.style.transform = 'none'
      // 전체 단계 수를 같이 보여 준다 — 안 그러면 "여기서 안 넘어가나?" 싶어진다
      const 새단계 = levelNo + 1 === unlocked && cleared < LEVELS.length
      status.textContent = `${levelNo + 1} / ${LEVELS.length}단계${새단계 ? ' 🔓' : ''} · ${moves}번 굴림 · ${
        block.o === 'stand' ? '서 있음' : '누움'
      }`
    }

    /**
     * 굴리는 모션.
     *
     * 블록이 순간이동하면 어느 쪽으로 굴렀는지, 눕는지 서는지가 안 보인다.
     * 실제로 굴러가는 것처럼 **넘어가는 모서리를 축으로 90도 돌린다.**
     * 다 돌면 새 자세로 다시 그리고 회전을 0으로 되돌린다(그림은 같은 자리에서 이어진다).
     *
     * 축과 방향 (카메라가 rotateX만 걸려 있어 X=열, Y=행, Z=위):
     *   오른쪽 → 오른쪽 아래 모서리에서 rotateY(+90)   왼쪽 → 왼쪽 아래 모서리에서 rotateY(-90)
     *   아래   → 앞쪽 아래 모서리에서 rotateX(-90)     위   → 뒤쪽 아래 모서리에서 rotateX(+90)
     */
    /** 도는 축(모서리)과 90도 돌았을 때의 회전, 그리고 더 넘어갔을 때(자빠질 때)의 회전 */
    interface Pivot {
      o: string
      t: string
      t2: string
    }

    /** 넘어가는 모서리와 그때의 회전 */
    function pivotOf(from: Block, dir: Dir): Pivot {
      const { w, d, x, y } = geo(from)
      return dir === 'right'
        ? { o: `${x + w}px ${y}px 0px`, t: 'rotateY(90deg)', t2: 'rotateY(165deg)' }
        : dir === 'left'
          ? { o: `${x}px ${y}px 0px`, t: 'rotateY(-90deg)', t2: 'rotateY(-165deg)' }
          : dir === 'down'
            ? { o: `${x}px ${y + d}px 0px`, t: 'rotateX(-90deg)', t2: 'rotateX(-165deg)' }
            : { o: `${x}px ${y}px 0px`, t: 'rotateX(90deg)', t2: 'rotateX(165deg)' }
    }

    /** 그 칸에 밟고 설 바닥이 있는가 */
    function hasFloor(r: number, c: number): boolean {
      return r >= 0 && r < lv.rows && c >= 0 && c < lv.cols && lv.grid[r][c] !== 0
    }

    /**
     * 누운 블록의 **한쪽만** 바닥에 걸쳤을 때 자빠지는 축.
     *
     * 예전에는 이런 경우에도 블록이 누운 채 그대로 아래로 내려가서 **바닥을 뚫고 지나갔다.**
     * 실제로는 받쳐 주는 칸의 모서리에 걸려 빈 쪽으로 기울어지며 넘어간다. 그 모서리를 돌려준다.
     * 두 칸 다 허공이면(설 데가 아예 없으면) null — 그냥 떨어진다.
     */
    function tipPivotOf(b: Block): Pivot | null {
      const cs = cells(b)
      if (cs.length !== 2) return null
      const [first, second] = cs
      const a = hasFloor(first[0], first[1])
      const z = hasFloor(second[0], second[1])
      if (a === z) return null // 둘 다 있거나 둘 다 없다
      if (b.o === 'x') {
        // 두 칸의 경계선(세로)에 걸린다. 빈 쪽이 아래로 처진다.
        const o = `${(b.c + 1) * S}px ${b.r * S}px 0px`
        return a
          ? { o, t: 'rotateY(90deg)', t2: 'rotateY(165deg)' }
          : { o, t: 'rotateY(-90deg)', t2: 'rotateY(-165deg)' }
      }
      const o = `${b.c * S}px ${(b.r + 1) * S}px 0px`
      return a
        ? { o, t: 'rotateX(-90deg)', t2: 'rotateX(-165deg)' }
        : { o, t: 'rotateX(90deg)', t2: 'rotateX(165deg)' }
    }

    /**
     * 판 밖으로 넘어가 떨어지는 모션.
     * 모서리에서 넘어간 다음 **아래로 가속하며** 사라진다.
     * translate를 회전보다 **왼쪽**에 두어야 판 좌표계(위가 +Z)에서 아래로 내려간다 —
     * 오른쪽에 두면 회전된 블록의 축을 따라가서 엉뚱한 방향으로 날아간다.
     *
     * 흐려지게 하는 건 **각 면에** 건다. 묶음(.bx-block)에 opacity를 주면 브라우저가
     * 그 안을 한 장으로 눌러 버려서(preserve-3d가 깨진다) 상자가 납작한 조각이 된다 —
     * 실제로 150px 높이가 36px로 찌그러졌다.
     */
    function animateFall(pivot: Pivot, onEnd: () => void) {
      blockGroup.style.transformOrigin = pivot.o
      blockGroup.style.transform = 'none'

      const anim = blockGroup.animate(
        [
          { transform: 'none', offset: 0, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
          { transform: pivot.t, offset: 0.36, easing: 'cubic-bezier(0.5, 0, 1, 1)' },
          // 90도에서 멈추지 않고 더 자빠지며 내려간다 — 판을 뚫는 게 아니라 넘어가는 것으로 보이게
          { transform: `translate3d(0px, 0px, -900px) ${pivot.t2}`, offset: 1 },
        ],
        { duration: FALL_MS, fill: 'forwards' },
      )
      for (const f of blockGroup.children) {
        ;(f as HTMLElement).animate([{ opacity: 1, offset: 0.55 }, { opacity: 0 }], {
          duration: FALL_MS,
          easing: 'ease-in',
        })
      }
      rollAnim = anim
      const finish = () => {
        anim.cancel()
        if (rollAnim === anim) rollAnim = null
        onEnd()
      }
      anim.addEventListener('finish', finish)
      setTimeout(() => {
        if (rollAnim === anim) finish()
      }, FALL_MS + 120)
    }

    function animateRoll(from: Block, dir: Dir, onEnd: () => void) {
      const pivot = pivotOf(from, dir)

      drawBlock(from)
      blockGroup.style.transformOrigin = pivot.o
      blockGroup.style.transform = 'none'

      /*
        CSS transition 대신 Web Animations API를 쓴다.
        transition은 "none을 넣고 → 리플로를 강제하고 → 다시 넣는" 순서에 기대는데,
        그 순서가 한 프레임에 합쳐지면 전환이 통째로 사라져 순간이동처럼 보인다(실제로 그랬다).
        animate()는 그런 타이밍 의존이 없고, currentTime으로 중간 상태를 직접 확인할 수도 있다.
      */
      const anim = blockGroup.animate([{ transform: 'none' }, { transform: pivot.t }], {
        duration: ROLL_MS,
        easing: 'cubic-bezier(0.33, 0, 0.3, 1)',
        fill: 'forwards',
      })
      rollAnim = anim
      const finish = () => {
        anim.cancel()
        if (rollAnim === anim) rollAnim = null
        onEnd()
      }
      anim.addEventListener('finish', finish)
      // 탭이 뒤에 있으면 애니메이션이 멈춰 finish가 안 온다 — 게임은 그래도 이어져야 한다
      setTimeout(() => {
        if (rollAnim === anim) finish()
      }, ROLL_MS + 120)
    }

    /** 열린 단계 안에서만 돌린다 */
    function cycleLevel() {
      // 굴리는 중에 판을 갈아치우면 끝난 애니메이션이 옛 판 좌표로 블록을 되돌린다
      if (rolling) return
      rollAnim?.cancel()
      rollAnim = null
      levelNo = (levelNo + 1) % unlocked
      lv = parseLevel(LEVELS[levelNo])
      block = { ...lv.start }
      moves = 0
      done = false
      layoutFit()
      draw()
    }

    function win() {
      done = true
      /**
       * 카드는 **처음 깨는 단계에만** 준다. 쉬운 단계를 반복해 카드를 찍어내면
       * 단어장이 의미를 잃는다. 대신 단계가 올라갈수록 단계 수만큼 준다
       * (15단계를 처음 깨면 서로 다른 한자 15장).
       */
      const firstTime = levelNo + 1 > cleared
      const prize = firstTime ? pickRewards(grade, levelNo + 1) : []
      if (prize.length) {
        cards.addMany(prize)
        // 카드로 받은 글자도 배운 것으로 친다 — 정원에 싹이 튼다
        for (const c of prize) if (srs.isNew(c)) srs.review(c, 'right')
      }
      progress.recordBest(`${GAME_ID}.level`, levelNo + 1)
      progress.recordBest(GAME_ID, Math.max(0, 100 - moves * 2 - falls * 10))

      const makeable = cards.completableWords(grade)

      // 화면을 갈아치우지 않고 판 위에 덮는다 — 하던 놀이가 그대로 뒤에 남아 흐름이 안 끊긴다
      function showResult() {
        root.append(
          resultModal({
            emoji: '🎉',
            title: `${levelNo + 1}단계 통과!`,
            lines: [
              `${moves}번 만에 깼어요`,
              falls ? `${falls}번 떨어졌어요` : '한 번도 안 떨어졌어요!',
              prize.length ? `한자 카드 ${prize.length}장을 받았어요` : '이미 깬 단계라 카드는 없어요',
              makeable.length ? `단어장에서 ${makeable.length}개 낱말을 만들 수 있어요` : '',
            ].filter(Boolean),
            primary: { label: '다음 단계 ▶', onClick: () => nav(bloxorzGame(grade, home)) },
            secondary: [
              { label: '단어장 보기', onClick: () => nav(wordbookScreen(grade, home)) },
              { label: '정원으로', onClick: () => nav(home) },
            ],
          }),
        )
      }

      if (!prize.length) {
        sfx.submit()
        showResult()
        return
      }

      // 결과 화면에 슬쩍 끼워 넣으면 카드를 받은 줄 모른다 — 짜잔 하고 덮어서 보여 준다
      sfx.fanfare()
      root.append(
        cardsModal({
          chars: prize,
          title: `한자 카드 ${prize.length}장`,
          lines: [`${levelNo + 1}단계를 처음 깼어요!`],
          onConfirm: showResult,
        }),
      )
    }

    function move(d: Dir) {
      if (done || rolling) return
      const from = block
      const nb = roll(from, d)
      sfx.move()

      if (!isSupported(lv, nb)) {
        // 판 밖으로 떨어졌다 — 굴러서 떨어지는 것까지 보여 주고 처음으로
        falls++
        rolling = true
        sfx.soft()
        const reset = () => {
          block = { ...lv.start }
          moves = 0
          rolling = false
          toast(root, '앗, 떨어졌어요!', 'bad')
          draw()
        }
        const tip = tipPivotOf(nb)
        if (tip) {
          // 한쪽은 바닥에 걸쳤다 — 일단 굴러서 눕고, 그 다음 빈 쪽으로 기울어져 넘어간다
          animateRoll(from, d, () => {
            drawBlock(nb)
            animateFall(tip, reset)
          })
        } else {
          drawBlock(from)
          animateFall(pivotOf(from, d), reset)
        }
        return
      }

      rolling = true
      animateRoll(from, d, () => {
        block = nb
        moves++
        rolling = false
        draw()
        if (isWin(lv, block)) setTimeout(win, 200)
      })
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
    const onResize = () => {
      layoutFit()
      draw()
    }
    window.addEventListener('resize', onResize)

    /*
      단계 바꾸기는 **상단 바 오른쪽**에 둔다. 아래에 두면 방향키 바로 밑이라
      굴리다가 잘못 눌러 판이 바뀌고, 판마다 자리도 달라 보였다.
      열린 단계가 하나뿐이면 고를 것이 없으니 버튼도 없다.
    */
    root.append(
      topBar(
        '블록 굴리기',
        () => nav(home),
        unlocked > 1
          ? topAction('🔁 다시하기', () => {
              sfx.tap()
              cycleLevel()
              toast(root, `${levelNo + 1}단계`, 'good')
            })
          : '',
      ),
      el('div', { class: 'bx-wrap' }, [
        status,
        view,
        hint,
        pad,
        unlocked > 1
          ? el('p', { class: 'bx-locked', text: `깬 단계는 위 🔁로 다시 할 수 있어요 (1~${unlocked}단계)` })
          : el('p', { class: 'bx-locked', text: '이 단계를 깨야 다음 단계가 열려요' }),
      ]),
    )
    layoutFit()
    draw()

    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      rollAnim?.cancel()
      rollAnim = null
    }
  }
