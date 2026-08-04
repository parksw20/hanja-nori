import './style.css'
import type { GradeId } from './data/types'
import { LADDER, cumulative, hunEumOf } from './data/words'
import * as srs from './srs'
import * as progress from './progress'
import * as tts from './tts'
import * as cards from './cards'
import * as sfx from './sfx'
import * as backup from './backup'
import { EXAMS, examScreen } from './exam'
import { wordbookScreen } from './wordbook'
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
function isUnlocked(grade: GradeId): boolean {
  const i = LADDER.indexOf(grade)
  if (i <= 0) return true
  return progress.hasCertificate(LADDER[i - 1])
}

/** 지금 도전 중인 급수 = 아직 급수증이 없는 가장 낮은 급수 */
function currentGrade(): GradeId {
  return LADDER.find((g) => !progress.hasCertificate(g)) ?? LADDER[LADDER.length - 1]
}

/** 사용자가 화면에서 고른 급수 (기본은 도전 중인 급수) */
let viewing: GradeId | null = null

const home: Screen = (root, nav) => {
  const grade = viewing && isUnlocked(viewing) ? viewing : currentGrade()
  viewing = grade
  const spec = EXAMS[grade]
  const chars = cumulative(grade).map((h) => h.char)
  const s = srs.summary(chars)
  const p = progress.get()

  // ── 급수 고르기 ────────────────────────────────────────────
  const picker = el(
    'div',
    { class: 'gd-picker' },
    LADDER.map((g) => {
      const unlocked = isUnlocked(g)
      const done = progress.hasCertificate(g)
      const btn = el(
        'button',
        {
          class: `gd-grade ${g === grade ? 'gd-grade--on' : ''} ${unlocked ? '' : 'gd-grade--locked'}`,
          type: 'button',
          title: unlocked ? `${EXAMS[g].name} (${EXAMS[g].chars}자)` : `${EXAMS[LADDER[LADDER.indexOf(g) - 1]].name}에 합격하면 열려요`,
        },
        [
          el('span', { class: 'gd-grade__name', text: EXAMS[g].name }),
          el('span', { class: 'gd-grade__mark', text: done ? '🎖️' : unlocked ? `${EXAMS[g].chars}자` : '🔒' }),
        ],
      )
      btn.addEventListener('click', () => {
        if (!unlocked) {
          const prev = EXAMS[LADDER[LADDER.indexOf(g) - 1]]
          alert(`${prev.name} 모의고사에 합격하면 열려요!`)
          return
        }
        viewing = g
        nav(home)
      })
      return btn
    }),
  )

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

  const examBest = p.exams.filter((e) => e.total === spec.total)
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
      el('span', { class: 'gd-item__emoji', text: progress.hasCertificate(grade) ? '🎖️' : '📝' }),
      el('span', { class: 'gd-item__body' }, [
        el('span', { class: 'gd-item__name', text: `${spec.name} 모의고사` }),
        el('span', {
          class: 'gd-item__desc',
          text: `${spec.total}문항 · ${spec.minutes}분 · ${spec.pass}문항 합격`,
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
          el('span', { class: 'gd-head__grade', text: `${spec.name} · ${spec.chars}자` }),
        ]),
        menu,
        // 단어장은 메뉴 패널 맨 아래 — 놀이가 아니라 "모은 것을 보는 곳"이라 따로 둔다
        wordbookButton(grade, nav),
        soundToggle(),
        voicePicker(),
        el('footer', { class: 'gd-foot' }, [
          // 기록은 이 브라우저에만 있다 — 기기를 바꾸거나 브라우저 데이터를 지우면 사라진다.
          // 파일로 빼 둘 수 있게 해 둔다.
          el('div', { class: 'gd-backup' }, [
            el('button', {
              class: 'gd-backup__btn',
              type: 'button',
              text: '💾 기록 백업',
              onclick: () => backup.download(),
            }),
            el('button', {
              class: 'gd-backup__btn',
              type: 'button',
              text: '📂 기록 불러오기',
              onclick: () =>
                backup.pickAndRestore(
                  (n) => {
                    alert(`기록 ${n}개를 되돌렸어요.`)
                    viewing = null
                    nav(home)
                  },
                  (msg) => alert(msg),
                ),
            }),
          ]),
          el('button', {
            class: 'gd-reset',
            type: 'button',
            text: '기록 처음부터',
            onclick: () => {
              // 아이가 잘못 눌러 통째로 날리는 일이 없게 두 번 묻는다
              if (!confirm('배운 기록·급수증·한자 카드가 모두 지워집니다. 계속할까요?')) return
              if (!confirm('정말 지울까요? 되돌릴 수 없어요. (먼저 「기록 백업」을 받아 두면 안전해요)')) return
              srs.resetAll()
              progress.resetAll()
              cards.resetAll()
              viewing = null
              nav(home)
            },
          }),
        ]),
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

/**
 * 목소리 고르기. 기기에 한국어 음성이 둘 이상 있을 때만 보인다.
 * 윈도우 크롬의 기본 음성(Heami)은 딱딱한데, Edge에는 사람 같은 신경망 음성이 있다.
 */
function voicePicker(): HTMLElement {
  const voices = tts.koreanVoices()
  if (voices.length <= 1) {
    return el('p', {
      class: 'gd-voice gd-voice--single',
      text: voices.length ? `🔊 ${voices[0].name}` : '🔇 이 기기에 한국어 음성이 없어요',
    })
  }

  const select = el('select', { class: 'gd-voice__select' })
  for (const v of voices) {
    const opt = el('option', { value: v.name, text: v.name })
    if (v.name === tts.voiceName()) opt.selected = true
    select.append(opt)
  }
  select.addEventListener('change', () => {
    tts.useVoice(select.value)
    tts.speak('가르칠 교')
  })

  return el('label', { class: 'gd-voice' }, [el('span', { class: 'gd-voice__label', text: '🔊 목소리' }), select])
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
