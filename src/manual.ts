/**
 * 놀이 방법 (매뉴얼).
 *
 * 아이 혼자 열어도 읽히도록 짧은 문장으로, 어른이 훑어도 규칙을 알 수 있도록 숫자를 함께 적는다.
 * 급수·문항 수 같은 숫자는 손으로 적지 않고 EXAMS·LADDER에서 가져온다 — 데이터가 바뀌면 여기도 따라간다.
 */
import { EXAMS, EXAM_PRIZE_BASE, EXAM_PRIZE_BONUS } from './exam'
import { LADDER, NEW_BY_GRADE, cumulative } from './data/words'
import { EXAM_COOLDOWN_MS } from './progress'
import { EXCHANGE_COST } from './cards'
import * as prefs from './prefs'
import { LEVELS } from './games/bloxorz'
import { el, topBar, type Screen } from './ui'

interface Section {
  icon: string
  title: string
  lines: string[]
}

function sections(): Section[] {
  const top = LADDER[LADDER.length - 1]
  return [
    {
      icon: '🌱',
      title: '한자 정원',
      lines: [
        '메인 화면의 네모 하나가 한자 한 글자예요.',
        '누르면 뜻과 소리를 읽어 줘요.',
        '많이 맞히고 오래 기억할수록 자라요: · 씨앗 → 🌱 새싹 → 🌿 풀 → 🌳 나무 → 🌸 꽃.',
        '한 번 자라면 내려가지 않아요. 복습할 때가 지나면 테두리가 빨개져요(시듦).',
        '위쪽 「전체」를 누르면 지금까지 연 한자를 모두, 급수를 누르면 그 급수에 새로 나온 한자만 봐요.',
      ],
    },
    {
      icon: '🎮',
      title: '놀이 네 가지',
      lines: [
        '🃏 훈음 짝맞추기 — 한자와 뜻·소리를 짝지어요.',
        '☄️ 독음 요격 — 낱말이 바닥에 닿기 전에 바른 소리를 골라요. 맞힐수록 빨라지는데, 「⚙️ 설정」에서 「변화 없음」으로 둘 수 있어요.',
        '🖌️ 필순 따라쓰기 — 회색 획 위를 순서대로 그어요. 막히면 「살짝 보여줘」를 누르면 다음 획부터 노랗게 알려 줘요(보는 중에도 그릴 수 있어요).',
        `🧊 블록 굴리기 — 블록을 굴려 노란 구멍에 세워서 빠뜨려요. 전부 ${LEVELS.length}단계이고, 한 단계를 깨야 다음이 열려요. 깨면 한자 카드를 한 장 받아요.`,
      ],
    },
    {
      icon: '🎴',
      title: '한자 카드 받는 법',
      lines: [
        '🃏 훈음 짝맞추기 — 한 판을 끝내면 1장',
        '🖌️ 필순 따라쓰기 — 한 판을 끝내면 1장',
        '☄️ 독음 요격 — 200점마다 1장',
        `🧊 블록 굴리기 — 그 단계를 **처음** 깨면 단계 수만큼 (15단계면 서로 다른 15장). 이미 깬 단계는 안 줘요.`,
        `📝 모의고사 — 처음 합격하면 ${EXAM_PRIZE_BASE}장. 합격선에서 만점으로 갈수록 최대 ${EXAM_PRIZE_BONUS}장을 더 줘요 (만점이면 ${
          EXAM_PRIZE_BASE + EXAM_PRIZE_BONUS
        }장)`,
        `📝 이미 딴 급수를 다시 보면 기본 ${EXAM_PRIZE_BASE}장은 빼고, 합격선보다 더 맞힌 만큼만 줘요 (만점이면 ${EXAM_PRIZE_BONUS}장)`,
      ],
    },
    {
      icon: '📒',
      title: '카드와 단어장',
      lines: [
        '받은 카드는 메인 화면 글자 왼쪽 아래에 몇 장인지 표시돼요.',
        '단어장에서 카드를 한 글자씩 끼워 낱말을 만들어요. 앞에서부터 순서대로 넣어야 해요.',
        '國 2장 · 外 1장 · 民 1장이 있으면 外國과 國民을 만들 수 있어요.',
        '낱말을 만들면 카드는 없어지고 단어장에 쌓여요.',
        `안 쓰는 카드는 「🔄 카드 바꾸기」에서 ${EXCHANGE_COST}장을 내고 원하는 한자 1장으로 바꿔요.`,
        '「조금만 더 모으면」을 누르면 그 낱말을 이루는 훈음을 읽어 줘요.',
      ],
    },
    {
      icon: '🎖️',
      title: '급수와 모의고사',
      lines: [
        `${EXAMS[LADDER[0]].name}부터 시작해요. 그 급수 모의고사에 합격해야 다음 급수가 열려요.`,
        `지금 ${EXAMS[top].name}(누계 ${cumulative(top).length}자)까지 있어요.`,
        '합격 기준은 전 급수 70%예요.',
        '문제는 사단법인 한국어문회 출제기준표 그대로 나와요 — 문항 수도 시간도 줄이지 않았어요.',
        `한 번 보면 ${EXAM_COOLDOWN_MS / 60000}분 뒤에 다시 볼 수 있어요. 그 사이에 틀린 문제를 보고 오면 좋아요.`,
      ],
    },
    {
      icon: '📝',
      title: '문제 유형',
      lines: [
        '독음 — 낱말을 어떻게 읽는지',
        '훈음 — 한자의 뜻과 소리',
        '필순 — 빨간 획이 몇 번째인지',
        '반의어·유의어 — 뜻이 반대이거나 비슷한 한자',
        '완성형 — 사자성어의 빈칸',
        '뜻풀이 — 설명을 보고 낱말 고르기',
        '한자쓰기 — 한글을 한자로',
        '동음이의어 — 소리가 같은 다른 한자',
        '약자 — 줄여 쓴 꼴 (5급II부터)',
        '부수 — 한자의 부수 (4급II부터)',
        '장단음 — 길게 읽는지 짧게 읽는지 (4급부터)',
      ],
    },
    {
      icon: '💾',
      title: '기록',
      lines: [
        '기록은 이 브라우저에만 저장돼요. 앱을 새로 올려도 지워지지 않아요.',
        '브라우저 데이터를 지우거나 기기를 바꾸면 사라져요.',
        '「⚙️ 설정」의 「💾 저장」으로 파일에 담아 두고, 「📂 불러오기」로 되돌릴 수 있어요.',
        `「기록 처음부터」는 비밀번호를 물어봐요. 처음 값은 ${prefs.DEFAULT_RESET_PASSWORD}이고 설정에서 바꿀 수 있어요.`,
        '소리가 거슬리면 「🔔 효과음」을 눌러 끄거나, 설정에서 크기를 줄일 수 있어요.',
      ],
    },
  ]
}

export const manualScreen =
  (home: Screen): Screen =>
  (root, nav) => {
    const gradeRows = LADDER.map((g) =>
      el('tr', { class: 'mn-row' }, [
        el('td', { class: 'mn-cell mn-cell--name', text: EXAMS[g].name }),
        el('td', { class: 'mn-cell', text: `+${NEW_BY_GRADE[g].length}자` }),
        el('td', { class: 'mn-cell', text: `${EXAMS[g].chars}자` }),
        el('td', { class: 'mn-cell', text: `${EXAMS[g].total}문항` }),
        el('td', { class: 'mn-cell', text: `${EXAMS[g].pass}문항` }),
      ]),
    )

    root.append(
      topBar('놀이 방법', () => nav(home)),
      el('div', { class: 'mn-wrap' }, [
        ...sections().map((s) =>
          el('section', { class: 'mn-sec' }, [
            el('h2', { class: 'mn-sec__title' }, [
              el('span', { class: 'mn-sec__icon', text: s.icon }),
              el('span', { text: s.title }),
            ]),
            el(
              'ul',
              { class: 'mn-list' },
              s.lines.map((t) => el('li', { class: 'mn-item', text: t })),
            ),
          ]),
        ),
        el('section', { class: 'mn-sec' }, [
          el('h2', { class: 'mn-sec__title' }, [
            el('span', { class: 'mn-sec__icon', text: '📊' }),
            el('span', { text: '급수 한눈에' }),
          ]),
          el('div', { class: 'mn-tablewrap' }, [
            el('table', { class: 'mn-table' }, [
              el('thead', {}, [
                el('tr', {}, [
                  el('th', { class: 'mn-cell', text: '급수' }),
                  el('th', { class: 'mn-cell', text: '새 한자' }),
                  el('th', { class: 'mn-cell', text: '누계' }),
                  el('th', { class: 'mn-cell', text: '출제' }),
                  el('th', { class: 'mn-cell', text: '합격' }),
                ]),
              ]),
              el('tbody', {}, gradeRows),
            ]),
          ]),
        ]),
        el('p', {
          class: 'mn-foot',
          text: '급수 기준은 사단법인 한국어문회 전국한자능력검정시험을 따릅니다. 이 놀이는 비공식 학습 도구예요.',
        }),
      ]),
    )
  }
