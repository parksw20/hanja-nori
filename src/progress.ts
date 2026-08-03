/** 급수증·최고기록 같은 "모으는 것"들. SRS와 달리 한 번 얻으면 안 사라진다. */

const KEY = 'hanja-nori.progress.v1'

export interface ExamRecord {
  /** 맞힌 문항 수 */
  score: number
  /** 총 문항 수 */
  total: number
  /** 합격 여부 */
  passed: boolean
  /** 걸린 시간(초) */
  seconds: number
  /** 언제 (epoch ms) */
  at: number
}

export interface Progress {
  /** 미니게임별 최고 점수 */
  best: Record<string, number>
  /** 모의고사 기록 (최신이 앞) */
  exams: ExamRecord[]
  /** 획득한 급수증 */
  certificates: string[]
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { best: {}, exams: [], certificates: [], ...JSON.parse(raw) }
  } catch {
    /* 무시 */
  }
  return { best: {}, exams: [], certificates: [] }
}

let p: Progress = load()

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* 무시 */
  }
}

export function get(): Progress {
  return p
}

/** 최고 점수 갱신. 새 기록이면 true */
export function recordBest(gameId: string, score: number): boolean {
  if (score > (p.best[gameId] ?? -1)) {
    p.best[gameId] = score
    save()
    return true
  }
  return false
}

export function bestOf(gameId: string): number {
  return p.best[gameId] ?? 0
}

export function recordExam(r: ExamRecord, certificate: string): void {
  p.exams.unshift(r)
  p.exams = p.exams.slice(0, 20)
  if (r.passed && !p.certificates.includes(certificate)) p.certificates.push(certificate)
  save()
}

export function hasCertificate(id: string): boolean {
  return p.certificates.includes(id)
}

export function resetAll(): void {
  p = { best: {}, exams: [], certificates: [] }
  save()
}
