/**
 * 단어장 — 모은 한자 카드로 낱말을 만든다.
 *
 * 화면 순서는 아이가 할 일 순서대로:
 *   ① 지금 만들 수 있는 낱말   ② 조금만 더 모으면 되는 낱말   ③ 가진 카드   ④ 카드 바꾸기   ⑤ 만든 낱말
 */
import type { GradeId, Word } from './data/types'
import { cumulative, wordsUpTo, hunEumOf } from './data/words'
import * as cards from './cards'
import * as tts from './tts'
import * as sfx from './sfx'
import { el, prizeModal, toast, topAction, topBar, type Screen } from './ui'

/**
 * 카드 바꾸기 — 안 쓰는 카드 5장을 원하는 한자 한 장으로.
 * 단어장 본문에 두면 자리를 많이 먹는데 자주 쓰지는 않아서 상단 버튼에서 들어오는 별도 화면으로 뺐다.
 */
export const exchangeScreen =
  (grade: GradeId, home: Screen): Screen =>
  (root, nav) => {
    let picked: string[] = []

    const pool = cumulative(grade)
    const wantSelect = el('select', { class: 'wb-swap__select' })
    for (const h of pool) wantSelect.append(el('option', { value: h.char, text: `${h.char} ${h.hun} ${h.eum}` }))

    const hand = el('div', { class: 'wb-hand' })
    const bar = el('div', { class: 'wb-swap' })

    function render() {
      const held = cards.held()
      hand.replaceChildren(
        ...(held.length
          ? held.map(({ char, n }) => {
              const chosen = picked.filter((p) => p === char).length
              const card = el(
                'button',
                { class: `wb-card ${chosen ? 'wb-card--picked' : ''}`, type: 'button', title: `${char} ${n}장` },
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
            })
          : [el('p', { class: 'wb-empty', text: '카드가 없어요.' })]),
      )

      const ready = picked.length === cards.EXCHANGE_COST
      bar.replaceChildren(
        el('span', { class: 'wb-swap__picked', text: picked.length ? picked.join(' ') : '고른 카드 없음' }),
        wantSelect,
        el('button', {
          class: `hn-btn ${ready ? 'hn-btn--primary' : ''}`,
          type: 'button',
          text: ready ? '바꾸기' : `${cards.EXCHANGE_COST - picked.length}장 더 고르세요`,
          disabled: !ready,
          onclick: () => {
            const want = wantSelect.value
            if (cards.exchange(picked, want)) {
              picked = []
              tts.speak(hunEumOf(want))
              root.append(
                prizeModal({
                  char: want,
                  title: `${hunEumOf(want)} 카드`,
                  lines: [`${want} 카드로 바꿨어요`, `모두 ${cards.count(want)}장`],
                  onConfirm: render,
                }),
              )
            }
          },
        }),
      )
    }

    root.append(
      topBar('카드 바꾸기', () => nav(wordbookScreen(grade, home))),
      el('div', { class: 'wb-wrap' }, [
        el('section', { class: 'wb-sec' }, [
          el('h2', { class: 'wb-sec__title', text: `${cards.EXCHANGE_COST}장 → 1장` }),
          el('p', {
            class: 'wb-swap__help',
            text: `안 쓰는 카드를 ${cards.EXCHANGE_COST}장 골라 원하는 한자 한 장으로 바꿔요. 같은 글자든 다른 글자든 괜찮아요.`,
          }),
          hand,
          bar,
        ]),
      ]),
    )
    render()
  }

/**
 * 낱말 만들기 — 카드를 한 글자씩 끼워 완성한다.
 *
 * "만들기" 버튼 하나로 끝내면 아이는 자기가 무엇을 했는지 모른다.
 * 빈 칸을 앞에서부터 채우게 해서 **글자 순서**까지 손으로 익히게 하고, 다 채우면 빠밤 하고 축하한다.
 */
export const buildScreen =
  (grade: GradeId, w: Word, home: Screen): Screen =>
  (root, nav) => {
    const want = [...w.word]
    const filled: (string | null)[] = want.map(() => null)
    /** 이 화면에서 이미 끼워 넣은 카드 (아직 소모는 안 했다 — 완성해야 소모된다) */
    const usedNow = new Map<string, number>()

    const availableOf = (c: string) => cards.count(c) - (usedNow.get(c) ?? 0)
    const nextSlot = () => filled.findIndex((f) => f === null)

    const slots = el('div', { class: 'wbb-slots' })
    const hand = el('div', { class: 'wbb-hand' })
    const guide = el('p', { class: 'wbb-guide' })

    let finished = false
    function finish() {
      if (finished) return
      finished = true
      if (!cards.completeWord(w.word)) {
        toast(root, '카드가 모자라요', 'bad')
        return
      }
      sfx.fanfare()
      tts.speak(w.reading)
      root.append(
        prizeModal({
          tada: '빠밤!',
          char: w.word,
          title: w.reading,
          lines: [w.meaning, '단어장에 넣었어요'],
          onConfirm: () => nav(wordbookScreen(grade, home)),
        }),
      )
    }

    function render() {
      const next = nextSlot()

      slots.replaceChildren(
        ...want.map((_, i) => {
          const got = filled[i]
          const node = el(
            'button',
            {
              class: `wbb-slot ${got ? 'wbb-slot--filled' : ''} ${i === next ? 'wbb-slot--next' : ''}`,
              type: 'button',
              title: got ? `${got} ${hunEumOf(got)}` : `${i + 1}번째 글자`,
            },
            [el('span', { class: 'wbb-slot__char', text: got ?? '' })],
          )
          // 마지막에 넣은 것만 되돌릴 수 있다 (앞에서부터 채우는 규칙을 지키려고)
          const last = next === -1 ? want.length - 1 : next - 1
          if (got && i === last) {
            node.classList.add('wbb-slot--undo')
            node.addEventListener('click', () => {
              usedNow.set(got, (usedNow.get(got) ?? 1) - 1)
              filled[i] = null
              render()
            })
          }
          return node
        }),
      )

      const held = cards.held().filter(({ char }) => availableOf(char) > 0)
      hand.replaceChildren(
        ...(held.length
          ? held.map(({ char }) => {
              const n = availableOf(char)
              const card = el('button', { class: 'wbb-card', type: 'button', title: `${char} ${hunEumOf(char)}` }, [
                el('span', { class: 'wbb-card__char', text: char }),
                el('span', { class: 'wbb-card__n', text: `×${n}` }),
              ])
              card.addEventListener('click', () => {
                const slot = nextSlot()
                if (slot === -1) return
                if (want[slot] !== char) {
                  card.classList.add('wbb-card--wrong')
                  setTimeout(() => card.classList.remove('wbb-card--wrong'), 400)
                  toast(root, `${slot + 1}번째 글자가 아니에요`, 'bad')
                  return
                }
                filled[slot] = char
                usedNow.set(char, (usedNow.get(char) ?? 0) + 1)
                render()
                const last = nextSlot() === -1
                // 마지막 글자면 그 글자를 **끝까지 말한 뒤** 빠밤 + 낱말 읽기로 넘어간다.
                // 예전에는 450ms 뒤에 잘라서 "사람 인"을 말하다 말고 "대인"으로 바뀌었다.
                tts.speak(hunEumOf(char), last ? { onEnd: () => setTimeout(finish, 220) } : {})
              })
              return card
            })
          : [el('p', { class: 'wbb-empty', text: '쓸 수 있는 카드가 없어요' })]),
      )

      guide.textContent =
        next === -1 ? '다 채웠어요!' : `${next + 1}번째 칸에 넣을 카드를 고르세요 — 「${hunEumOf(want[next])}」`
    }

    root.append(
      topBar('낱말 만들기', () => nav(wordbookScreen(grade, home))),
      el('div', { class: 'wbb-wrap' }, [
        el('p', { class: 'wbb-target', text: `${w.reading} — ${w.meaning}` }),
        slots,
        guide,
        el('h3', { class: 'wbb-handtitle', text: '내 카드' }),
        hand,
      ]),
    )
    render()
  }

export const wordbookScreen =
  (grade: GradeId, home: Screen): Screen =>
  (root, nav) => {
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
                // 바로 완성시키지 않는다 — 카드를 한 글자씩 끼워 넣는 화면으로 간다
                const btn = el('button', { class: 'wb-make', type: 'button' }, [
                  el('span', { class: 'wb-make__word', text: '□'.repeat([...w.word].length) }),
                  el('span', { class: 'wb-make__reading', text: w.reading }),
                  el('span', { class: 'wb-make__meaning', text: w.meaning }),
                  el('span', { class: 'wb-make__go', text: '만들러 가기' }),
                ])
                btn.addEventListener('click', () => nav(buildScreen(grade, w, home)))
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
              // 낱말을 카드로 늘어놓는다 — 가진 글자와 없는 글자가 한눈에 보이고,
              // 누르면 "사람 인, 사이 간"처럼 **구성 훈음**을 읽어 준다.
              // 낱말이 어떤 글자로 이루어지는지가 곧 한자 공부다.
              nearly.map((n) => {
                const chars = [...n.word.word]
                // 부족한 장수를 글자별로 센다 (國이 2장 필요한데 1장뿐인 경우까지)
                const lack = new Map<string, number>()
                for (const c of n.missing) lack.set(c, (lack.get(c) ?? 0) + 1)

                const row = el('button', { class: 'wb-near__row', type: 'button' }, [
                  el(
                    'span',
                    { class: 'wb-near__cards' },
                    chars.map((c) => {
                      const missing = (lack.get(c) ?? 0) > 0
                      if (missing) lack.set(c, (lack.get(c) ?? 1) - 1)
                      return el('span', { class: `wb-mini ${missing ? 'wb-mini--lack' : 'wb-mini--have'}` }, [
                        el('span', { class: 'wb-mini__char', text: c }),
                        el('span', { class: 'wb-mini__he', text: hunEumOf(c) }),
                      ])
                    }),
                  ),
                  el('span', { class: 'wb-near__info' }, [
                    el('span', { class: 'wb-near__reading', text: n.word.reading }),
                    el('span', { class: 'wb-near__meaning', text: n.word.meaning }),
                    el('span', { class: 'wb-near__need', text: `${n.missing.join(' ')} 더 필요해요` }),
                  ]),
                  el('span', { class: 'wb-near__speak', text: '🔊' }),
                ])

                row.addEventListener('click', () => {
                  sfx.tap()
                  tts.speak(chars.map(hunEumOf).join(', '))
                })
                return row
              }),
            ),
          ])
        : null

      // ── ③ 가진 카드 (보기 전용 — 바꾸기는 상단 버튼에서 따로) ──
      const heldSection = el('section', { class: 'wb-sec' }, [
        el('h2', { class: 'wb-sec__title', text: `가진 카드 ${totalCards}장` }),
        held.length
          ? el(
              'div',
              { class: 'wb-hand' },
              // 누르면 훈음을 읽어 준다 (아직 글씨를 못 읽는 아이도 무슨 카드인지 알 수 있게)
              held.map(({ char, n }) => {
                const card = el(
                  'button',
                  { class: 'wb-card', type: 'button', title: `${char} ${hunEumOf(char)} ${n}장` },
                  [
                    el('span', { class: 'wb-card__char', text: char }),
                    el('span', { class: 'wb-card__n', text: `×${n}` }),
                  ],
                )
                card.addEventListener('click', () => {
                  sfx.tap()
                  tts.speak(hunEumOf(char))
                })
                return card
              }),
            )
          : el('p', { class: 'wb-empty', text: '카드가 없어요.' }),
      ])

      // ── ④ 만든 낱말 ─────────────────────────────────────
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
        // 카드 바꾸기는 자리를 많이 먹는데 자주 쓰지는 않는다 → 상단 오른쪽 버튼으로 뺐다
        topBar(
          '단어장',
          () => nav(home),
          topAction(`🔄 카드 바꾸기 (${totalCards})`, () => nav(exchangeScreen(grade, home))),
        ),
        el(
          'div',
          { class: 'wb-wrap' },
          [makeSection, nearlySection, heldSection, madeSection].filter(Boolean) as HTMLElement[],
        ),
      )
    }

    render()
  }
