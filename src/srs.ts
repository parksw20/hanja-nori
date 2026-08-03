/**
 * 간격 반복(SRS) — 한자 한 글자가 정원의 나무 한 그루.
 *
 * 급수 시험은 누적형이라(3급 = 1,817자 전부) 새로 외우는 것보다 안 잊는 것이 어렵다.
 * SM-2를 아이용으로 줄였다: 등급은 3단계(틀림/맞음/척척)뿐이고 간격 상한을 둔다.
 */

const KEY = 'hanja-nori.srs.v1'
const DAY = 24 * 60 * 60 * 1000

/** 한 글자의 학습 상태 */
export interface CardState {
  /** 연속 정답 횟수 (틀리면 0으로) */
  reps: number
  /** 난이도 계수 (1.3 ~ 2.8). 낮을수록 자주 나온다 */
  ease: number
  /** 다음 복습까지 며칠 */
  interval: number
  /** 다음 복습 예정 시각 (epoch ms) */
  due: number
  /** 누적 정답/오답 */
  right: number
  wrong: number
}

export type Answer = 'wrong' | 'right' | 'easy'

/** 정원 성장 단계 — 화면에 보여주는 값 */
export type Growth = 'seed' | 'sprout' | 'sapling' | 'tree' | 'bloom'

type Store = Record<string, CardState>

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function save(s: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* 사생활 모드 등에서 저장이 막혀도 게임은 돌아가야 한다 */
  }
}

let store: Store = load()

function fresh(): CardState {
  return { reps: 0, ease: 2.5, interval: 0, due: 0, right: 0, wrong: 0 }
}

export function stateOf(char: string): CardState {
  return store[char] ?? fresh()
}

/** 아직 한 번도 본 적 없는 글자인가 */
export function isNew(char: string): boolean {
  return !store[char]
}

/**
 * 답을 채점해 다음 복습일을 정한다.
 * 아이가 지루해하지 않도록 간격 상한은 60일.
 */
export function review(char: string, answer: Answer, now = Date.now()): CardState {
  const c = { ...stateOf(char) }

  if (answer === 'wrong') {
    c.reps = 0
    c.interval = 0 // 오늘 안에 다시 나온다
    c.ease = Math.max(1.3, c.ease - 0.2)
    c.wrong++
  } else {
    c.reps++
    c.right++
    if (answer === 'easy') c.ease = Math.min(2.8, c.ease + 0.1)
    if (c.reps === 1) c.interval = 1
    else if (c.reps === 2) c.interval = 3
    else c.interval = Math.min(60, Math.round(c.interval * c.ease))
  }

  c.due = now + c.interval * DAY
  store[char] = c
  save(store)
  return c
}

/** 오늘 물 줄 나무들 (복습 기한이 지난 글자) */
export function dueChars(all: string[], now = Date.now()): string[] {
  return all.filter((c) => {
    const s = store[c]
    return s !== undefined && s.due <= now
  })
}

/** 아직 안 배운 글자들 */
export function newChars(all: string[]): string[] {
  return all.filter((c) => !store[c])
}

/** 정원 성장 단계 */
export function growthOf(char: string): Growth {
  const s = store[char]
  if (!s) return 'seed'
  if (s.reps === 0) return 'sprout'
  if (s.interval < 3) return 'sprout'
  if (s.interval < 10) return 'sapling'
  if (s.interval < 30) return 'tree'
  return 'bloom'
}

/** 시들었나 — 기한이 이틀 넘게 지났으면 */
export function isWilted(char: string, now = Date.now()): boolean {
  const s = store[char]
  return !!s && s.due > 0 && now - s.due > 2 * DAY
}

export interface Summary {
  total: number
  learned: number
  due: number
  mastered: number
}

export function summary(all: string[], now = Date.now()): Summary {
  return {
    total: all.length,
    learned: all.filter((c) => store[c] !== undefined).length,
    due: dueChars(all, now).length,
    mastered: all.filter((c) => (store[c]?.interval ?? 0) >= 10).length,
  }
}

/**
 * 이번 판에 낼 글자를 고른다.
 * 복습 기한이 지난 것 우선 → 모자라면 새 글자 → 그래도 모자라면 아무거나.
 * 새 글자를 한 판에 몰아 넣으면 아이가 지친다 → maxNew로 제한.
 */
export function pickSession(all: string[], count: number, maxNew = 4, now = Date.now()): string[] {
  const due = dueChars(all, now)
  const fresh_ = newChars(all).slice(0, maxNew)
  const picked = [...due, ...fresh_].slice(0, count)

  if (picked.length < count) {
    const rest = all.filter((c) => !picked.includes(c))
    // 복습 기한이 먼 순서로 채운다 (덜 익은 것부터)
    rest.sort((a, b) => (store[a]?.interval ?? 0) - (store[b]?.interval ?? 0))
    picked.push(...rest.slice(0, count - picked.length))
  }
  return shuffle(picked)
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 전체 초기화 (설정 화면용) */
export function resetAll(): void {
  store = {}
  save(store)
}
