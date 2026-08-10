/**
 * 미니게임 ①  훈음 짝맞추기 — 출제 유형 「훈음」
 * 한자 카드와 훈음 카드를 뒤집어 짝을 찾는다. 8급 출제 60문항 중 24문항이 훈음이다.
 */
import type { GradeId } from '../data/types'
import { cumulative, hunEumOf } from '../data/words'
import * as srs from '../srs'
import * as progress from '../progress'
import * as tts from '../tts'
import * as cardStore from '../cards'
import { pickRewards } from '../reward'
import { el, prizeModal, resultCard, toast, type Screen } from '../ui'
import { topBar } from '../ui'

const GAME_ID = 'hunmum'
const PAIRS = 6

interface Card {
  id: number
  char: string
  face: 'hanja' | 'hunEum'
  matched: boolean
}

export const hunmumGame =
  (grade: GradeId, home: Screen): Screen =>
  (root, nav) => {
    const chars = srs.pickSession(
      cumulative(grade).map((h) => h.char),
      PAIRS,
    )

    const cards: Card[] = srs.shuffle(
      chars.flatMap((char, i) => [
        { id: i * 2, char, face: 'hanja' as const, matched: false },
        { id: i * 2 + 1, char, face: 'hunEum' as const, matched: false },
      ]),
    )

    let flipped: { card: Card; node: HTMLElement }[] = []
    let matches = 0
    let misses = 0
    let locked = false
    const startedAt = Date.now()

    const status = el('span', { class: 'hm-status', text: `0 / ${PAIRS}` })
    const board = el('div', { class: 'hm-board' })

    function finish() {
      const seconds = Math.round((Date.now() - startedAt) / 1000)
      // 짝을 한 번에 맞힐수록 높은 점수. 실수는 감점하되 0 밑으로는 안 간다.
      const score = Math.max(0, PAIRS * 100 - misses * 20 - Math.max(0, seconds - 30) * 2)
      const isBest = progress.recordBest(GAME_ID, score)

      // 한 판을 끝내면 카드 한 장 — 블록 굴리기만으로는 카드가 너무 안 모인다
      const prize = pickRewards(grade, 1)
      cardStore.addMany(prize)

      const showResult = () =>
        root.replaceChildren(
          topBar('훈음 짝맞추기', () => nav(home)),
          resultCard({
            emoji: misses <= 2 ? '🌟' : '🌱',
            title: `${score}점`,
            lines: [
              `${PAIRS}쌍을 ${seconds}초에 맞혔어요`,
              `헛짚은 횟수 ${misses}번`,
              `한자 카드 1장을 받았어요`,
              isBest ? '새 최고 기록!' : `최고 기록 ${progress.bestOf(GAME_ID)}점`,
            ],
            actions: [
              { label: '한 판 더', primary: true, onClick: () => nav(hunmumGame(grade, home)) },
              { label: '정원으로', onClick: () => nav(home) },
            ],
          }),
        )

      root.append(
        prizeModal({
          char: prize[0],
          title: `${hunEumOf(prize[0])} 카드`,
          lines: [`${prize[0]} 카드를 받았어요`, `모두 ${cardStore.count(prize[0])}장`],
          onConfirm: showResult,
        }),
      )
    }

    function onFlip(card: Card, node: HTMLElement) {
      if (locked || card.matched || flipped.some((f) => f.card.id === card.id)) return

      node.classList.add('hm-card--open')
      flipped.push({ card, node })
      if (flipped.length < 2) return

      const [a, b] = flipped
      if (a.card.char === b.card.char) {
        matches++
        a.card.matched = b.card.matched = true
        a.node.classList.add('hm-card--matched')
        b.node.classList.add('hm-card--matched')
        // 한 번에 맞히면 '척척', 헤맨 뒤 맞히면 '맞음'
        srs.review(a.card.char, misses === 0 ? 'easy' : 'right')
        // 짝을 맞히는 순간 소리로 한 번 더 — 아이는 귀로 외운다
        tts.speak(hunEumOf(a.card.char))
        toast(root, '짝!', 'good')
        flipped = []
        status.textContent = `${matches} / ${PAIRS}`
        if (matches === PAIRS) setTimeout(finish, 500)
      } else {
        misses++
        srs.review(a.card.char, 'wrong')
        locked = true
        a.node.classList.add('hm-card--miss')
        b.node.classList.add('hm-card--miss')
        setTimeout(() => {
          for (const f of flipped) f.node.classList.remove('hm-card--open', 'hm-card--miss')
          flipped = []
          locked = false
        }, 650)
      }
    }

    for (const card of cards) {
      const label = card.face === 'hanja' ? card.char : hunEumOf(card.char)
      const node = el('button', { class: `hm-card hm-card--${card.face}`, type: 'button' }, [
        el('span', { class: 'hm-card__back', text: '?' }),
        el('span', { class: 'hm-card__front', text: label }),
      ])
      node.addEventListener('click', () => onFlip(card, node))
      board.append(node)
    }

    root.append(
      topBar('훈음 짝맞추기', () => nav(home)),
      el('div', { class: 'hm-wrap' }, [
        el('p', { class: 'hm-hint', text: '한자와 뜻·소리를 짝지어 주세요' }),
        status,
        board,
      ]),
    )
  }
