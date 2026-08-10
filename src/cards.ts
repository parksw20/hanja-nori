/**
 * 한자 카드 — 블록 퍼즐을 깨면 한 장씩 나온다.
 *
 * 카드는 두 가지로 쓴다:
 *   1. **단어 완성** — 國 2장 · 外 1장 · 民 1장이면 外國과 國民을 만들 수 있다. 만들면 카드는 소모된다.
 *   2. **교환** — 쓸 데 없는 카드가 5장 모이면 원하는 한자 1장으로 바꾼다.
 *      (같은 글자 5장이든 서로 다른 5장이든 상관없다 — 아이가 "이건 못 쓰는 카드"에 막히지 않게)
 */
import type { GradeId } from './data/types'
import { ALL_WORDS, wordsUpTo } from './data/words'

const KEY = 'hanja-nori.cards.v1'

/** 카드 5장이면 원하는 카드 1장과 바꾼다 */
export const EXCHANGE_COST = 5

interface Store {
  /** 한자 → 가진 장수 */
  cards: Record<string, number>
  /** 완성한 낱말 (한자 표기) */
  words: string[]
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { cards: {}, words: [], ...JSON.parse(raw) }
  } catch {
    /* 무시 */
  }
  return { cards: {}, words: [] }
}

let store: Store = load()

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* 저장이 막혀도 이번 판은 돌아간다 */
  }
}

/** 가진 카드 전부 (한자 → 장수, 0장은 없음) */
export function all(): Readonly<Record<string, number>> {
  return store.cards
}

export function count(char: string): number {
  return store.cards[char] ?? 0
}

/** 가진 카드 총 장수 */
export function total(): number {
  return Object.values(store.cards).reduce((a, b) => a + b, 0)
}

/** 가진 카드 종류를 한자 순서대로 */
export function held(): { char: string; n: number }[] {
  return Object.entries(store.cards)
    .filter(([, n]) => n > 0)
    .map(([char, n]) => ({ char, n }))
    .sort((a, b) => a.char.localeCompare(b.char, 'ko'))
}

export function add(char: string, n = 1): void {
  store.cards[char] = count(char) + n
  save()
}

/** 여러 장을 한 번에 (저장은 한 번만 한다) */
export function addMany(chars: string[]): void {
  for (const c of chars) store.cards[c] = (store.cards[c] ?? 0) + 1
  save()
}

/** 낱말에 필요한 글자별 장수 */
export function need(word: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of word) m.set(c, (m.get(c) ?? 0) + 1)
  return m
}

export function canComplete(word: string): boolean {
  if (store.words.includes(word)) return false // 이미 만든 낱말은 다시 안 만든다
  for (const [c, n] of need(word)) if (count(c) < n) return false
  return true
}

/** 낱말을 만든다 — 카드를 소모하고 단어장에 넣는다 */
export function completeWord(word: string): boolean {
  if (!canComplete(word)) return false
  for (const [c, n] of need(word)) {
    store.cards[c] = count(c) - n
    if (store.cards[c] <= 0) delete store.cards[c]
  }
  store.words.push(word)
  save()
  return true
}

export function completedWords(): string[] {
  return store.words
}

export function hasWord(word: string): boolean {
  return store.words.includes(word)
}

/**
 * 카드 5장을 내고 원하는 한자 1장을 받는다.
 * `give`는 낼 카드 목록(같은 글자가 여러 번 들어올 수 있다).
 */
export function exchange(give: string[], want: string): boolean {
  if (give.length !== EXCHANGE_COST) return false

  const spend = new Map<string, number>()
  for (const c of give) spend.set(c, (spend.get(c) ?? 0) + 1)
  for (const [c, n] of spend) if (count(c) < n) return false

  for (const [c, n] of spend) {
    store.cards[c] = count(c) - n
    if (store.cards[c] <= 0) delete store.cards[c]
  }
  add(want, 1) // add가 save까지 한다
  return true
}

/** 지금 만들 수 있는 낱말들 (그 급수까지) */
export function completableWords(grade: GradeId): typeof ALL_WORDS {
  return wordsUpTo(grade).filter((w) => canComplete(w.word))
}

/** 카드가 조금 모자란 낱말들 — "무엇을 더 모으면 되는지" 보여 주려고 */
export function nearlyWords(grade: GradeId, maxMissing = 2): { word: (typeof ALL_WORDS)[number]; missing: string[] }[] {
  return wordsUpTo(grade)
    .filter((w) => !hasWord(w.word) && !canComplete(w.word))
    .map((w) => {
      const missing: string[] = []
      for (const [c, n] of need(w.word)) {
        for (let i = count(c); i < n; i++) missing.push(c)
      }
      return { word: w, missing }
    })
    .filter((x) => x.missing.length > 0 && x.missing.length <= maxMissing)
    .sort((a, b) => a.missing.length - b.missing.length)
}

export function resetAll(): void {
  store = { cards: {}, words: [] }
  save()
}
