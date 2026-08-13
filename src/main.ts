import './style.css'
import type { GradeId } from './data/types'
import { LADDER, NEW_BY_GRADE, cumulative, hunEumOf } from './data/words'
import * as srs from './srs'
import * as progress from './progress'
import * as tts from './tts'
import * as cards from './cards'
import * as sfx from './sfx'
import { EXAMS, examScreen } from './exam'
import { wordbookScreen } from './wordbook'
import { manualScreen } from './manual'
import { settingsScreen } from './settings'
import { hunmumGame } from './games/hunmum'
import { dokeumGame } from './games/dokeum'
import { pilsunGame } from './games/pilsun'
import { bloxorzGame } from './games/bloxorz'
import { createNav, el, type Screen } from './ui'

const GROWTH_ICON: Record<ReturnType<typeof srs.growthOf>, string> = {
  seed: '·',
  sprout: '🌱',
  sapling: '🌿',
  tree: '🌳',
  bloom: '🌸',
}

/** 그 급수를 열려면 바로 아래 급수의 급수증이 있어야 한다. 8급은 처음부터 열려 있다. */
const isUnlocked = progress.isUnlocked

/** 지금 도전 중인 급수 = 아직 급수증이 없는 가장 낮은 급수 */
function currentGrade(): GradeId {
  return LADDER.find((g) => !progress.hasCertificate(g)) ?? LADDER[LADDER.length - 1]
}

/**
 * 화면에서 고른 칸. `'all'`이면 해금된 한자를 전부 모아 보고,
 * 급수를 고르면 **그 급수에 새로 나온 한자만** 본다.
 * 급수마다 같은 글자가 반복해 보이면 "이번 급수에서 뭘 새로 배우는지"가 묻힌다.
 */
let viewing: GradeId | 'all' | null = null

/** 지금까지 열린 가장 높은 급수 (전체보기·놀이의 기준) */
function topUnlocked(): GradeId {
  let top = LADDER[0]
  for (const g of LADDER) if (isUnlocked(g)) top = g
  return top
}

const home: Screen = (root, nav) => {
  const showAll = viewing === 'all'
  // 놀이·시험은 언제나 누계 기준. 전체보기일 때는 열린 가장 높은 급수로 논다.
  let grade: GradeId
  if (showAll) grade = topUnlocked()
  else if (viewing !== null && viewing !== 'all' && isUnlocked(viewing)) grade = viewing
  else grade = currentGrade()
  if (!showAll) viewing = grade
  const spec = EXAMS[grade]
  // 정원에 깔 글자: 전체보기면 누계, 급수를 고르면 그 급수 신규만
  const chars = (showAll ? cumulative(grade) : NEW_BY_GRADE[grade]).map((h) => h.char)
  const s = srs.summary(chars)
  const p = progress.get()

  // ── 급수 고르기 (맨 왼쪽이 전체보기) ────────────────────────
  const allBtn = el(
    'button',
    {
      class: `gd-grade gd-grade--all ${showAll ? 'gd-grade--on' : ''}`,
      type: 'button',
      title: `열린 한자 ${cumulative(topUnlocked()).length}자를 모두 봅니다`,
    },
    [
      el('span', { class: 'gd-grade__name', text: '전체' }),
      el('span', { class: 'gd-grade__mark', text: `${cumulative(topUnlocked()).length}자` }),
    ],
  )
  allBtn.addEventListener('click', () => {
    sfx.tap()
    viewing = 'all'
    nav(home)
  })

  const picker = el('div', { class: 'gd-picker' }, [
    allBtn,
    ...LADDER.map((g) => {
      const unlocked = isUnlocked(g)
      const done = progress.hasCertificate(g)
      const btn = el(
        'button',
        {
          class: `gd-grade ${!showAll && g === grade ? 'gd-grade--on' : ''} ${unlocked ? '' : 'gd-grade--locked'}`,
          type: 'button',
          title: unlocked
            ? `${EXAMS[g].name} 신규 ${NEW_BY_GRADE[g].length}자 (누계 ${EXAMS[g].chars}자)`
            : `${EXAMS[LADDER[LADDER.indexOf(g) - 1]].name}에 합격하면 열려요`,
        },
        [
          el('span', { class: 'gd-grade__name', text: EXAMS[g].name }),
          // 급수 칸에는 그 급수에서 **새로 나오는** 자 수를 적는다
          el('span', {
            class: 'gd-grade__mark',
            text: done ? '🎖️' : unlocked ? `+${NEW_BY_GRADE[g].length}자` : '🔒',
          }),
        ],
      )
      btn.addEventListener('click', () => {
        if (!unlocked) {
          const prev = EXAMS[LADDER[LADDER.indexOf(g) - 1]]
          alert(`${prev.name} 모의고사에 합격하면 열려요!`)
          return
        }
        sfx.tap()
        viewing = g
        nav(home)
      })
      return btn
    }),
  ])

  // ── 정원 ──────────────────────────────────────────────────
  const garden = el(
    'div',
    { class: 'gd-garden' },
    chars.map((c) => {
      const growth = srs.growthOf(c)
      const wilted = srs.isWilted(c)
      const nCards = cards.count(c)
      const tile = el(
        'button',
        {
          class: `gd-tile gd-tile--${growth} ${wilted ? 'gd-tile--wilted' : ''}`,
          type: 'button',
          title: nCards ? `${c} ${hunEumOf(c)} · 카드 ${nCards}장` : `${c} ${hunEumOf(c)}`,
        },
        [
          el('span', { class: 'gd-tile__char', text: c }),
          el('span', { class: 'gd-tile__growth', text: GROWTH_ICON[growth] }),
          // 가진 카드는 글자 왼쪽 아래에 (성장 아이콘은 오른쪽 아래)
          ...(nCards
            ? [
                el('span', { class: 'gd-tile__card', title: `${c} 카드 ${nCards}장` }, [
                  el('span', { class: 'gd-tile__cardicon', text: '🂠' }),
                  el('span', { class: 'gd-tile__cardn', text: String(nCards) }),
                ]),
              ]
            : []),
        ],
      )
      // 누르면 훈음을 보여 주고 **소리로 읽어 준다** (아직 글씨를 못 읽는 아이를 위해)
      tile.addEventListener('click', () => {
        tile.classList.add('gd-tile--peek')
        const label = el('span', { class: 'gd-tile__peek', text: hunEumOf(c) })
        tile.append(label)
        tts.speak(hunEumOf(c))
        setTimeout(() => {
          label.remove()
          tile.classList.remove('gd-tile--peek')
        }, 1600)
      })
      return tile
    }),
  )

  const examBest = p.exams.filter((e) => (e.grade ? e.grade === grade : e.total === spec.total))
  const cooldown = progress.examCooldownLeft(grade)
  const cooldownText = cooldown > 0 ? `${Math.ceil(cooldown / 60000)}분 뒤에 다시 볼 수 있어요` : ''
  const menu = el('div', { class: 'gd-menu' }, [
    menuButton('🃏', '훈음 짝맞추기', '뜻과 소리를 짝지어요', 'hunmum', () => nav(hunmumGame(grade, home))),
    menuButton('☄️', '독음 요격', '낱말을 소리내어 읽어요', 'dokeum', () => nav(dokeumGame(grade, home))),
    menuButton('🖌️', '필순 따라쓰기', '획을 순서대로 그어요', 'pilsun', () => nav(pilsunGame(grade, home))),
    menuButton('🧊', '블록 굴리기', '깨면 한자 카드를 줘요', 'bloxorz', () => nav(bloxorzGame(grade, home))),
    el(
      'button',
      {
        class: 'gd-item gd-item--exam',
        type: 'button',
        onclick: () => {
          sfx.submit()
          nav(examScreen(grade, home))
        },
      },
      [
      el('span', { class: 'gd-item__emoji', text: cooldown > 0 ? '⏳' : progress.hasCertificate(grade) ? '🎖️' : '📝' }),
      el('span', { class: 'gd-item__body' }, [
        el('span', { class: 'gd-item__name', text: `${spec.name} 모의고사` }),
        el('span', {
          class: 'gd-item__desc',
          text: cooldownText || `${spec.total}문항 · ${spec.minutes}분 · ${spec.pass}문항 합격`,
        }),
      ]),
      el('span', {
        class: 'gd-item__best',
        text: examBest.length ? `최고 ${Math.max(...examBest.map((e) => e.score))}` : '',
      }),
    ]),
  ])

  // 넓은 화면에서는 왼쪽에 놀이 메뉴, 오른쪽에 정원. 좁으면 CSS가 한 줄로 쌓는다.
  root.append(
    el('div', { class: 'gd-layout' }, [
      el('aside', { class: 'gd-side' }, [
        el('header', { class: 'gd-head' }, [
          el('h1', { class: 'gd-head__title', text: '한자놀이' }),
          el('span', {
        class: 'gd-head__grade',
        text: showAll ? `전체 · ${chars.length}자` : `${spec.name} 새 한자 ${chars.length}자`,
      }),
        ]),
        menu,
        // 단어장은 메뉴 패널 맨 아래 — 놀이가 아니라 "모은 것을 보는 곳"이라 따로 둔다
        wordbookButton(grade, nav),
        el('button', {
          class: 'gd-manual',
          type: 'button',
          text: '❓ 놀이 방법',
          onclick: () => {
            sfx.tap()
            nav(manualScreen(home))
          },
        }),
        // 목소리·기록 백업·초기화는 설정으로 옮겼다 — 아이가 놀려고 여는 화면에
        // 「기록 불러오기」 같은 위험한 버튼이 늘 보일 이유가 없다
        el('button', {
          class: 'gd-manual',
          type: 'button',
          text: '⚙️ 설정',
          onclick: () => {
            sfx.tap()
            nav(settingsScreen(home))
          },
        }),
        soundToggle(),
      ]),
      el('main', { class: 'gd-main' }, [
        picker,
        el('div', { class: 'gd-stats' }, [
          stat('배운 한자', `${s.learned} / ${s.total}`),
          stat('오늘 물 줄 것', `${s.due}`),
          stat('잘 익은 한자', `${s.mastered}`),
          stat('급수증', p.certificates.length ? `${p.certificates.length}개` : '—'),
        ]),
        garden,
        // 풀·꽃이 무슨 뜻인지 화면에 없으면 아무도 모른다
        el('div', { class: 'gd-legend' }, [
          el('span', { class: 'gd-legend__title', text: '한자를 익힐수록 자라요' }),
          el('span', { class: 'gd-legend__items' }, [
            legendItem('·', '씨앗'),
            legendItem('🌱', '새싹'),
            legendItem('🌿', '풀'),
            legendItem('🌳', '나무'),
            legendItem('🌸', '꽃'),
          ]),
          el('span', { class: 'gd-legend__hint', text: '한자를 누르면 읽어 줘요 🔊' }),
        ]),
      ]),
    ]),
  )
}

/** 효과음 켜기/끄기 — 조용해야 할 때가 있다 */
function soundToggle(): HTMLElement {
  const btn = el('button', {
    class: 'gd-sound',
    type: 'button',
    text: sfx.isOn() ? '🔔 효과음 켜짐' : '🔕 효과음 꺼짐',
  })
  btn.addEventListener('click', () => {
    const on = sfx.toggle()
    btn.textContent = on ? '🔔 효과음 켜짐' : '🔕 효과음 꺼짐'
  })
  return btn
}

/** 단어장 — 모은 카드로 낱말을 만드는 곳 */
function wordbookButton(grade: GradeId, nav: (s: Screen) => void): HTMLElement {
  const n = cards.total()
  const made = cards.completedWords().length
  return el(
    'button',
    {
      class: 'gd-item gd-item--book',
      type: 'button',
      onclick: () => {
        sfx.tap()
        nav(wordbookScreen(grade, home))
      },
    },
    [
      el('span', { class: 'gd-item__emoji', text: '📒' }),
      el('span', { class: 'gd-item__body' }, [
        el('span', { class: 'gd-item__name', text: '단어장' }),
        el('span', {
          class: 'gd-item__desc',
          text: n ? `카드 ${n}장 · 만든 낱말 ${made}개` : '카드를 모아 낱말을 만들어요',
        }),
      ]),
      el('span', { class: 'gd-item__best', text: n ? `🂠 ${n}` : '' }),
    ],
  )
}

function legendItem(icon: string, label: string): HTMLElement {
  return el('span', { class: 'gd-legend__item' }, [
    el('span', { class: 'gd-legend__icon', text: icon }),
    el('span', { class: 'gd-legend__label', text: label }),
  ])
}

function stat(label: string, value: string): HTMLElement {
  return el('div', { class: 'gd-stat' }, [
    el('span', { class: 'gd-stat__value', text: value }),
    el('span', { class: 'gd-stat__label', text: label }),
  ])
}

function menuButton(emoji: string, name: string, desc: string, gameId: string, onClick: () => void): HTMLElement {
  const best = progress.bestOf(gameId)
  return el(
    'button',
    {
      class: 'gd-item',
      type: 'button',
      onclick: () => {
        sfx.tap()
        onClick()
      },
    },
    [
    el('span', { class: 'gd-item__emoji', text: emoji }),
    el('span', { class: 'gd-item__body' }, [
      el('span', { class: 'gd-item__name', text: name }),
      el('span', { class: 'gd-item__desc', text: desc }),
    ]),
    el('span', { class: 'gd-item__best', text: best ? `최고 ${best}` : '' }),
  ])
}

const app = document.getElementById('app')
if (!app) throw new Error('#app이 없다 — index.html이 바뀌었나')
tts.initTts()
const nav = createNav(app)
nav(home)
