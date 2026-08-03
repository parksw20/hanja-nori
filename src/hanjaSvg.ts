/**
 * 획순 데이터로 한자 SVG를 직접 그린다.
 * 필순 문제("이 획은 몇 번째로 쓸까요?")는 특정 획 하나만 강조해야 하는데,
 * hanzi-writer의 강조는 애니메이션이라 정지 화면으로 남지 않는다 → 여기서 직접 그린다.
 *
 * 좌표계는 Make Me a Hanzi 규약: 1024×1024, y축이 뒤집혀 있어 translate(0,900) scale(1,-1).
 */
import strokesJson from './data/strokes.json'
import type { StrokeData } from './data/types'

const STROKES = strokesJson as Record<string, StrokeData>
const NS = 'http://www.w3.org/2000/svg'

export function strokeCount(char: string): number {
  return STROKES[char]?.strokes.length ?? 0
}

export function renderCharSvg(char: string, opts: { size?: number; highlight?: number } = {}): SVGSVGElement {
  const size = opts.size ?? 200
  const data = STROKES[char]
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 1024 1024')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('class', 'hn-charsvg')

  const g = document.createElementNS(NS, 'g')
  g.setAttribute('transform', 'translate(0, 900) scale(1, -1)')
  svg.append(g)

  if (!data) return svg

  data.strokes.forEach((d, i) => {
    const path = document.createElementNS(NS, 'path')
    path.setAttribute('d', d)
    const isTarget = opts.highlight === i
    path.setAttribute('fill', isTarget ? '#ff5d73' : '#e8ecff')
    if (isTarget) path.setAttribute('class', 'hn-charsvg__hit')
    g.append(path)
  })

  return svg
}
