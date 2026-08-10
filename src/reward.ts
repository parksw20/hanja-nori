/**
 * 한자 카드 보상 고르기.
 *
 * 배정한자에서 균등하게 뽑으면 카드가 흩어져 낱말이 영영 안 모인다.
 * **낱말을 먼저 고르고 그 안의 한 글자**를 주면 카드가 저절로 낱말 주위에 뭉친다.
 * 여러 장을 줄 때는 서로 다른 글자로 준다 — 같은 글자만 잔뜩 나오면 받은 느낌이 안 난다.
 */
import type { GradeId } from './data/types'
import { cumulative, wordsUpTo } from './data/words'
import * as srs from './srs'

/** 한 장 뽑기 */
export function pickReward(grade: GradeId): string {
  const pool = wordsUpTo(grade)
  const word = pool[Math.floor(Math.random() * pool.length)]
  const chars = [...word.word]
  return chars[Math.floor(Math.random() * chars.length)]
}

/**
 * n장을 **서로 다른 글자로** 뽑는다.
 * 낱말에서 뽑다가 더 못 채우면 그 급수까지의 배정한자에서 채운다.
 */
export function pickRewards(grade: GradeId, n: number): string[] {
  const picked: string[] = []
  const seen = new Set<string>()

  // 낱말에서 (카드가 낱말 주위에 뭉치도록)
  const words = srs.shuffle(wordsUpTo(grade))
  for (const w of words) {
    for (const c of srs.shuffle([...w.word])) {
      if (seen.has(c)) continue
      seen.add(c)
      picked.push(c)
      if (picked.length >= n) return picked
    }
  }

  // 그래도 모자라면 배정한자에서
  for (const h of srs.shuffle(cumulative(grade))) {
    if (seen.has(h.char)) continue
    seen.add(h.char)
    picked.push(h.char)
    if (picked.length >= n) break
  }
  return picked
}
