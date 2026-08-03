/**
 * 단어장 — 모은 한자 카드로 낱말을 만든다.
 *
 * 화면 순서는 아이가 할 일 순서대로:
 *   ① 지금 만들 수 있는 낱말   ② 조금만 더 모으면 되는 낱말   ③ 가진 카드   ④ 카드 바꾸기   ⑤ 만든 낱말
 */
import type { GradeId } from './data/types'
import { cumulative, wordsUpTo } from './data/words'
import * as cards from './cards'
import * as tts from './tts'
import { el, toast, topBar, type Screen } from './ui'

export const wordbookScreen =
  (grade: GradeId, home: Screen): Screen =>
  (root, nav) => {
    /** 교환에 내려고 고른 카드들 (같은 글자를 여러 장 고를 수 있어 배열) */
    let picked: string[] = []

    function render() {
      const makeable = cards.completableWords(grade)
      const nearly = cards.nearlyWords(grade).slice(0, 6)
      const held = cards.held()
      const madeWords = cards.completedWords()
      const totalCards = cards.total()

      // ── ① 만들 수 있는 낱말 ──────────────────────────────
      const makeSection = el('section', { class: 'wb-sec' }, [
        el('h2', { class: 'wb-sec__title', text: `지금 만들 수 있는 낱말 ${makeable.length}개` }),
        makeable.length
          ? el(
              'div',
              { class: 'wb-cards' },
              makeable.map((w) => {
                const btn = el('button', { class: 'wb-make', type: 'button' }, [
                  el('span', { class: 'wb-make__word', text: w.word }),
                  el('span', { class: 'wb-make__reading', text: w.reading }),
                  el('span', { class: 'wb-make__meaning', text: w.meaning }),
                  el('span', { class: 'wb-make__go', text: '만들기' }),
                ])
                btn.addEventListener('click', () => {
                  if (cards.completeWord(w.word)) {
                    tts.speak(w.reading)
                    toast(root, `${w.word} 완성!`, 'good')
                    picked = []
                    render()
                  }
                })
                return btn
              }),
            )
          : el('p', { class: 'wb-empty', text: '아직 없어요. 블록 굴리기로 카드를 모아 보세요!' }),
      ])

      // ── ② 조금만 더 모으면 ───────────────────────────────
      const nearlySection = nearly.length
        ? el('section', { class: 'wb-sec' }, [
            el('h2', { class: 'wb-sec__title', text: '조금만 더 모으면' }),
            el(
              'div',
              { class: 'wb-near' },
              nearly.map((n) =>
                el('div', { class: 'wb-near__row' }, [
                  el('span', { class: 'wb-near__word', text: n.word.word }),
                  el('span', { class: 'wb-near__reading', text: n.word.reading }),
                  el('span', { class: 'wb-near__need', text: `${n.missing.join(' ')} 필요` }),
                ]),
              ),
            ),
          ])
        : null

      // ── ③ 가진 카드 (누르면 교환용으로 고른다) ─────────────
      const heldSection = el('section', { class: 'wb-sec' }, [
        el('h2', { class: 'wb-sec__title', text: `가진 카드 ${totalCards}장` }),
        held.length
          ? el(
              'div',
              { class: 'wb-hand' },
              held.map(({ char, n }) => {
                const chosen = picked.filter((p) => p === char).length
                const card = el(
                  'button',
                  {
                    class: `wb-card ${chosen ? 'wb-card--picked' : ''}`,
                    type: 'button',
                    title: `${char} ${n}장`,
                  },
                  [
                    el('span', { class: 'wb-card__char', text: char }),
                    el('span', { class: 'wb-card__n', text: `×${n}` }),
                    chosen ? el('span', { class: 'wb-card__pick', text: `고름 ${chosen}` }) : el('span', {}),
                  ],
                )
                card.addEventListener('click', () => {
                  const already = picked.filter((p) => p === char).length
                  if (already < n && picked.length < cards.EXCHANGE_COST) picked.push(char)
                  else picked = picked.filter((p) => p !== char) // 다시 누르면 이 글자는 다 뺀다
                  render()
                })
                return card
              }),
            )
          : el('p', { class: 'wb-empty', text: '카드가 없어요.' }),
      ])

      // ── ④ 카드 바꾸기 ────────────────────────────────────
      const pool = cumulative(grade)
      const swapSelect = el('select', { class: 'wb-swap__select' })
      for (const h of pool) swapSelect.append(el('option', { value: h.char, text: `${h.char} ${h.hun} ${h.eum}` }))

      const ready = picked.length === cards.EXCHANGE_COST
      const swapBtn = el('button', {
        class: `hn-btn ${ready ? 'hn-btn--primary' : ''}`,
        type: 'button',
        text: ready ? '바꾸기' : `${cards.EXCHANGE_COST - picked.length}장 더 고르세요`,
        disabled: !ready,
        onclick: () => {
          if (cards.exchange(picked, swapSelect.value)) {
            toast(root, `${swapSelect.value} 카드로 바꿨어요!`, 'good')
            picked = []
            render()
          }
        },
      })

      const swapSection = el('section', { class: 'wb-sec' }, [
        el('h2', { class: 'wb-sec__title', text: `카드 바꾸기 (${cards.EXCHANGE_COST}장 → 1장)` }),
        el('p', {
          class: 'wb-swap__help',
          text: `안 쓰는 카드를 ${cards.EXCHANGE_COST}장 골라 원하는 한자 한 장으로 바꿔요. 위에서 카드를 눌러 고르세요.`,
        }),
        el('div', { class: 'wb-swap' }, [
          el('span', { class: 'wb-swap__picked', text: picked.length ? picked.join(' ') : '고른 카드 없음' }),
          swapSelect,
          swapBtn,
        ]),
      ])

      // ── ⑤ 만든 낱말 ─────────────────────────────────────
      const totalWords = wordsUpTo(grade).length
      const madeSection = el('section', { class: 'wb-sec' }, [
        el('h2', { class: 'wb-sec__title', text: `만든 낱말 ${madeWords.length} / ${totalWords}` }),
        madeWords.length
          ? el(
              'div',
              { class: 'wb-made' },
              madeWords.map((w) => {
                const info = wordsUpTo(grade).find((x) => x.word === w)
                const chip = el('button', { class: 'wb-made__chip', type: 'button', title: info?.meaning ?? '' }, [
                  el('span', { class: 'wb-made__word', text: w }),
                  el('span', { class: 'wb-made__reading', text: info?.reading ?? '' }),
                ])
                chip.addEventListener('click', () => info && tts.speak(info.reading))
                return chip
              }),
            )
          : el('p', { class: 'wb-empty', text: '아직 만든 낱말이 없어요.' }),
      ])

      root.replaceChildren(
        topBar('단어장', () => nav(home), `카드 ${totalCards}장`),
        el(
          'div',
          { class: 'wb-wrap' },
          [makeSection, nearlySection, heldSection, swapSection, madeSection].filter(Boolean) as HTMLElement[],
        ),
      )
    }

    render()
  }
