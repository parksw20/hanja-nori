/**
 * 획순 데이터 — **급수별로 나눠 받는다.**
 *
 * 전에는 300자 전부를 첫 화면에서 통째로 받았다(283KB gzip). 8급만 하는 아이도
 * 6급 한자 획순까지 다 받는 셈이라, 급수를 늘릴수록 첫 로딩이 그대로 무거워진다.
 * 획순을 쓰는 곳은 **필순 게임과 필순 문제뿐**이므로, 그 급수에 들어갈 때 받으면 된다.
 *
 * Vite의 import.meta.glob으로 급수별 청크를 만든다. 한 번 받은 급수는 캐시한다.
 */
import type { GradeId, StrokeData } from './data/types'
import { LADDER } from './data/words'

type Loader = () => Promise<{ default: Record<string, StrokeData> }>

let loaders: Record<string, Loader> | null = null
function getLoaders(): Record<string, Loader> {
  if (loaders) return loaders
  try {
    // Vite가 빌드 때 실제 목록으로 바꿔치기한다. node(테스트)에는 glob이 없어 예외가 난다.
    loaders = import.meta.glob<{ default: Record<string, StrokeData> }>('./data/strokes-*.json')
  } catch {
    loaders = {}
  }
  return loaders
}

const cache = new Map<string, StrokeData>()
const loaded = new Set<GradeId>()
/** 같은 급수를 동시에 두 번 받지 않게 */
const inflight = new Map<GradeId, Promise<void>>()

function loadGrade(grade: GradeId): Promise<void> {
  if (loaded.has(grade)) return Promise.resolve()
  const existing = inflight.get(grade)
  if (existing) return existing

  const key = `./data/strokes-${grade}.json`
  const load = getLoaders()[key]
  if (!load) {
    // 그 급수 파일이 아직 없으면(배정한자 0자) 조용히 넘어간다
    loaded.add(grade)
    return Promise.resolve()
  }

  const p = load()
    .then((mod) => {
      for (const [char, data] of Object.entries(mod.default)) cache.set(char, data)
      loaded.add(grade)
    })
    .finally(() => inflight.delete(grade))
  inflight.set(grade, p)
  return p
}

/** 그 급수까지의 **누계** 획순을 받아 둔다. 화면에 들어가기 전에 한 번 부르면 된다. */
export async function loadUpTo(grade: GradeId): Promise<void> {
  const upto = LADDER.slice(0, LADDER.indexOf(grade) + 1)
  await Promise.all(upto.map(loadGrade))
}

/** 아직 안 받았으면 undefined. loadUpTo를 먼저 부를 것. */
export function get(char: string): StrokeData | undefined {
  return cache.get(char)
}

export function strokeCount(char: string): number {
  return cache.get(char)?.strokes.length ?? 0
}

export function isLoaded(char: string): boolean {
  return cache.has(char)
}

/**
 * 테스트(node)에서 쓰는 주입구. 브라우저가 아니면 import.meta.glob이 없어 파일을 못 받으므로,
 * 테스트가 파일을 직접 읽어 여기에 넣어 준다.
 */
export function preload(data: Record<string, StrokeData>): void {
  for (const [char, d] of Object.entries(data)) cache.set(char, d)
}
