/** 급수증·최고기록 같은 "모으는 것"들. SRS와 달리 한 번 얻으면 안 사라진다. */
import type { GradeId } from './data/types'
import { LADDER } from './data/words'

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
  /** 어느 급수 (예전 기록에는 없다) */
  grade?: string
}

/**
 * 한 번 보고 나면 다시 볼 때까지 기다리는 시간.
 *
 * 시험이 곧 게임의 보상 구간이라, 떨어지면 바로 다시 눌러 반복하게 된다.
 * 그러면 문제를 외워서 찍게 되고 복습은 건너뛴다. 사이에 쉬는 시간을 두어
 * "틀린 것부터 다시 보고 오라"는 뜻을 준다.
 */
export const EXAM_COOLDOWN_MS = 10 * 60 * 1000

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

/** 저장소를 다시 읽어 온다 — 기록을 불러온 직후처럼 밖에서 값이 바뀐 경우 */
export function reload(): void {
  p = load()
}

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

/** 앞 급수에 합격했으면 열린다. 첫 급수는 늘 열려 있다. */
export function isUnlocked(grade: GradeId): boolean {
  const i = LADDER.indexOf(grade)
  if (i <= 0) return true
  return hasCertificate(LADDER[i - 1])
}

/**
 * 지금까지 연 가장 높은 급수.
 *
 * 화면에서 **보고 있는** 급수와는 다르다. 8급 탭을 눌러 쉬운 한자를 구경하는 중에도
 * 이미 만든 낱말·모은 카드는 6급 것일 수 있다 — 그런 것들을 다룰 때 쓴다.
 */
export function topUnlockedGrade(): GradeId {
  let top: GradeId = LADDER[0]
  for (const g of LADDER) if (isUnlocked(g)) top = g
  return top
}

/** 그 급수 시험을 다시 볼 수 있을 때까지 남은 시간(ms). 0이면 지금 볼 수 있다. */
export function examCooldownLeft(grade: string, now = Date.now()): number {
  // grade가 없는 예전 기록은 어느 급수인지 몰라 제한에 쓰지 않는다
  const last = p.exams.find((e) => e.grade === grade)
  if (!last) return 0
  return Math.max(0, last.at + EXAM_COOLDOWN_MS - now)
}

export function resetAll(): void {
  p = { best: {}, exams: [], certificates: [] }
  save()
}
