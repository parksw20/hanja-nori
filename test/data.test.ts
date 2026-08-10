/**
 * 배정한자·한자어 데이터 무결성 테스트.
 *
 * 이 데이터는 사람이 손으로 넣는다 → 손으로 넣는 순간 오타·중복·범위이탈이 들어온다.
 * 게임 로직보다 이 테스트가 먼저다. `npm test`.
 */
import { HANJA_8, WORDS_8 } from '../src/data/hanja8'
import {
  HANJA_7II,
  HANJA_7,
  HANJA_6II,
  HANJA_6,
  HANJA_5II,
  HANJA_5,
  HANJA_4II,
  HANJA_4,
  HANJA_3II,
  HANJA_3,
  STROKE_VARIANT,
  NO_PILSUN,
} from '../src/data/grades'
import { ALL_HANJA, ALL_WORDS } from '../src/data/words'
import { EXAMS, buildQuestions } from '../src/exam'
import { LEVELS, parseLevel, solve } from '../src/games/bloxorz'
import { pickReward, pickRewards } from '../src/reward'
import * as cards from '../src/cards'
import { readFileSync } from 'node:fs'
import { LADDER as GRADE_ORDER } from '../src/data/words'
import * as strokeStore from '../src/strokes'

// 획순은 급수별 파일로 나뉘어 있다 (npm run data가 굽는다). 테스트에서는 전부 합쳐서 본다.
const strokes: Record<string, { strokes: string[]; medians: number[][][] }> = {}
for (const g of GRADE_ORDER) {
  const path = new URL(`../src/data/strokes-${g}.json`, import.meta.url)
  try {
    Object.assign(strokes, JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    // 배정한자가 없는 급수는 파일도 없다
  }
}
// 앱은 브라우저에서 급수별로 나눠 받는다 — node에는 그 통로가 없으니 직접 넣어 준다
strokeStore.preload(strokes)

let failed = 0
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    console.log(`  ok  ${name}`)
  } else {
    failed++
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── 1. 배정한자 자체 ────────────────────────────────────────────
check('8급 배정한자는 정확히 50자 (어문회 기준 읽기 50)', HANJA_8.length === 50, `실제 ${HANJA_8.length}자`)

const dupChars = HANJA_8.map((h) => h.char).filter((c, i, a) => a.indexOf(c) !== i)
check('중복된 한자 없음', dupChars.length === 0, dupChars.join(' '))

const badShape = HANJA_8.filter((h) => [...h.char].length !== 1 || !h.hun || !h.eum)
check('모든 항목이 한 글자 + 훈 + 음을 갖춤', badShape.length === 0, badShape.map((h) => h.char).join(' '))

const badEum = HANJA_8.filter((h) => [...h.eum].length !== 1)
check('음은 한 음절', badEum.length === 0, badEum.map((h) => `${h.char}:${h.eum}`).join(' '))

const notHanja = HANJA_8.filter((h) => {
  const cp = h.char.codePointAt(0)!
  return !(cp >= 0x4e00 && cp <= 0x9fff)
})
check('모두 CJK 통합한자 영역', notHanja.length === 0, notHanja.map((h) => h.char).join(' '))

// ── 1b. 급수 사다리 ────────────────────────────────────────────
// 어문회 공식 누계: 8급 50 · 7급II 100 · 7급 150 · 6급II 225 · 6급 300
const LADDER = [
  { id: '8', list: HANJA_8, fresh: 50, total: 50 },
  { id: '7II', list: HANJA_7II, fresh: 50, total: 100 },
  { id: '7', list: HANJA_7, fresh: 50, total: 150 },
  { id: '6II', list: HANJA_6II, fresh: 75, total: 225 },
  { id: '6', list: HANJA_6, fresh: 75, total: 300 },
  { id: '5II', list: HANJA_5II, fresh: 100, total: 400 },
  { id: '5', list: HANJA_5, fresh: 100, total: 500 },
  { id: '4II', list: HANJA_4II, fresh: 250, total: 750 },
  { id: '4', list: HANJA_4, fresh: 250, total: 1000 },
  { id: '3II', list: HANJA_3II, fresh: 500, total: 1500 },
  { id: '3', list: HANJA_3, fresh: 317, total: 1817 },
]

let running = 0
const seen = new Set<string>()
for (const g of LADDER) {
  check(`${g.id}급 신규 배정한자 ${g.fresh}자`, g.list.length === g.fresh, `실제 ${g.list.length}자`)
  running += g.list.length
  check(`${g.id}급 누계 ${g.total}자`, running === g.total, `실제 ${running}자`)

  const dup = g.list.map((h) => h.char).filter((c) => seen.has(c))
  check(`${g.id}급에 아래 급수와 겹치는 글자 없음`, dup.length === 0, dup.join(' '))
  for (const h of g.list) seen.add(h.char)

  const bad = g.list.filter((h) => [...h.char].length !== 1 || !h.hun || [...h.eum].length !== 1)
  check(`${g.id}급 항목 형식(한 글자 + 훈 + 한 음절 음)`, bad.length === 0, bad.map((h) => h.char).join(' '))

  const wrongGrade = g.list.filter((h) => h.grade !== g.id)
  check(`${g.id}급 항목의 grade 표기가 일치`, wrongGrade.length === 0, wrongGrade.map((h) => h.char).join(' '))
}

// ── 2. 한자어 ──────────────────────────────────────────────────
const charSet = new Set(HANJA_8.map((h) => h.char))
const outOfRange = WORDS_8.filter((w) => [...w.word].some((c) => !charSet.has(c)))
check(
  '한자어의 모든 글자가 8급 배정한자 안에 있음',
  outOfRange.length === 0,
  outOfRange.map((w) => `${w.word}(${[...w.word].filter((c) => !charSet.has(c)).join('')})`).join(' '),
)

const lenMismatch = WORDS_8.filter((w) => [...w.word].length !== [...w.reading].length)
check(
  '한자어 글자 수 = 독음 음절 수',
  lenMismatch.length === 0,
  lenMismatch.map((w) => `${w.word}/${w.reading}`).join(' '),
)

const dupWords = WORDS_8.map((w) => w.word).filter((w, i, a) => a.indexOf(w) !== i)
check('중복된 한자어 없음', dupWords.length === 0, dupWords.join(' '))

const noMeaning = WORDS_8.filter((w) => !w.meaning.trim())
check('모든 한자어에 뜻풀이가 있음', noMeaning.length === 0, noMeaning.map((w) => w.word).join(' '))

// 낱말이 너무 적으면 독음 문제 24문항을 못 채운다 (8급 독음 배점 기준)
check('독음 문제를 채울 만큼 한자어가 있음 (≥24)', WORDS_8.length >= 24, `${WORDS_8.length}개`)

// 쓰이지 않는 한자 = 그 글자는 독음 게임에 영영 안 나온다.
// 낱말은 5급까지 손으로 채웠다. 그 위 급수는 한자·부수·필순·장단음으로 배우고
// 독음/뜻풀이/한자쓰기 문제는 아래 급수 낱말에서 나온다 (README '알려진 제약' 참고).
const WORD_COVERED: readonly string[] = ['8', '7II', '7', '6II', '6', '5II', '5']
const usedInWords = new Set([...ALL_WORDS.flatMap((w) => [...w.word])])
const unused = ALL_HANJA.filter((h) => WORD_COVERED.includes(h.grade) && !usedInWords.has(h.char)).map((h) => h.char)
check(
  `5급까지 배정한자 전부가 낱말에 최소 한 번은 쓰임`,
  unused.length === 0,
  `미사용: ${unused.join(' ')}`,
)

const allWordLenBad = ALL_WORDS.filter((w) => [...w.word].length !== [...w.reading].length)
check(
  '모든 낱말의 글자 수 = 독음 음절 수',
  allWordLenBad.length === 0,
  allWordLenBad.map((w) => `${w.word}/${w.reading}`).join(' '),
)

const allDupWords = ALL_WORDS.map((w) => w.word).filter((w, i, a) => a.indexOf(w) !== i)
check('전체 낱말에 중복 없음', allDupWords.length === 0, allDupWords.join(' '))

// ── 3. 획순 데이터 (생성물) ─────────────────────────────────────
const strokeMap = strokes as Record<string, { strokes: string[]; medians: number[][][] }>
const noStroke = HANJA_8.filter((h) => !strokeMap[h.char])
check(
  '모든 한자에 획순 데이터가 있음 (scripts/build-strokes.mjs)',
  noStroke.length === 0,
  noStroke.map((h) => h.char).join(' '),
)

const brokenStroke = Object.entries(strokeMap).filter(
  ([, d]) => !d.strokes?.length || d.strokes.length !== d.medians?.length,
)
check(
  '획 경로 수 = 중앙선 수',
  brokenStroke.length === 0,
  brokenStroke.map(([c]) => c).join(' '),
)

const extra = Object.keys(strokeMap).filter((c) => !seen.has(c))
check('획순 데이터에 배정 외 글자가 섞이지 않음', extra.length === 0, extra.join(' '))

// 상위 급수에는 획순 데이터가 없는 글자가 몇 자씩 있다. 빠뜨린 게 아니라
// 알고 뺀 것임을 no-strokes.json으로 확인한다(필순 문제에서 자동 제외된다).
const noStrokeList = new Set(JSON.parse(readFileSync(new URL('../src/data/no-strokes.json', import.meta.url), 'utf8')) as string[])
const noStrokeAny = [...seen].filter((c) => !strokeMap[c])
const unexplained = noStrokeAny.filter((c) => !noStrokeList.has(c))
check(
  '획순 없는 글자는 전부 no-strokes.json에 기록되어 있음',
  unexplained.length === 0,
  unexplained.join(' '),
)
check(
  'no-strokes.json에 배정 외 글자가 없음',
  [...noStrokeList].every((c) => seen.has(c)),
  [...noStrokeList].filter((c) => !seen.has(c)).join(' '),
)

// 대체 자형을 쓴 글자는 반드시 필순에서 빠져야 한다 (자형이 정자와 다르므로)
const variantNotExcluded = Object.keys(STROKE_VARIANT).filter((c) => !NO_PILSUN.has(c))
check('대체 자형 글자는 전부 필순에서 제외됨', variantNotExcluded.length === 0, variantNotExcluded.join(' '))

const excludedNotAssigned = [...NO_PILSUN].filter((c) => !seen.has(c))
check('필순 제외 목록에 배정 외 글자가 없음', excludedNotAssigned.length === 0, excludedNotAssigned.join(' '))

// ── 4. 출제기준 (급수별 모의고사) ────────────────────────────────
// 공식 출제기준표: 8급 50/35 · 7급II 60/42 · 7급 70/49 · 6급II 80/56 · 6급 90/63, 모두 50분
const OFFICIAL = [
  { id: '8', total: 50, pass: 35 },
  { id: '7II', total: 60, pass: 42 },
  { id: '7', total: 70, pass: 49 },
  { id: '6II', total: 80, pass: 56 },
  { id: '6', total: 90, pass: 63 },
  { id: '5II', total: 100, pass: 70 },
  { id: '5', total: 100, pass: 70 },
  { id: '4II', total: 100, pass: 70 },
  { id: '4', total: 100, pass: 70 },
  { id: '3II', total: 150, pass: 105 },
  { id: '3', total: 150, pass: 105 },
] as const

for (const o of OFFICIAL) {
  const spec = EXAMS[o.id]
  check(`${spec.name} 총문항 ${o.total}`, spec.total === o.total, `실제 ${spec.total}`)
  check(`${spec.name} 합격문항 ${o.pass} (70%)`, spec.pass === o.pass, `실제 ${spec.pass}`)
  check(`${spec.name} 합격선이 70% 이상`, spec.pass / spec.total >= 0.7)
  // 3급II부터는 60분
  const wantMin = spec.total >= 150 ? 60 : 50
  check(`${spec.name} 시험시간 ${wantMin}분`, spec.minutes === wantMin, `실제 ${spec.minutes}분`)

  // 실제로 문제를 만들어 본다 — 데이터가 모자라면 문항 수가 안 채워진다
  const qs = buildQuestions(spec)
  check(`${spec.name} 문제 생성 ${o.total}문항`, qs.length === o.total, `실제 ${qs.length}문항`)

  const noAnswer = qs.filter((q) => !q.choices.includes(q.answer))
  check(`${spec.name} 모든 문제에 정답이 보기에 있음`, noAnswer.length === 0, noAnswer.map((q) => q.stem).join(' '))

  // 장단음만 2지선다(길게/짧게), 나머지는 4지선다
  const notFour = qs.filter((q) => q.choices.length !== (q.kind === '장단음' ? 2 : 4))
  check(`${spec.name} 보기 개수가 유형에 맞음`, notFour.length === 0, notFour.map((q) => `${q.stem}:${q.choices.length}`).join(' '))

  const dupChoice = qs.filter((q) => new Set(q.choices).size !== q.choices.length)
  check(`${spec.name} 보기에 같은 것이 두 번 안 나옴`, dupChoice.length === 0, dupChoice.map((q) => q.stem).join(' '))

  const pilsunBad = qs.filter((q) => q.kind === '필순' && q.chars.some((c) => NO_PILSUN.has(c)))
  check(`${spec.name} 필순 문제에 대체 자형 글자가 안 나옴`, pilsunBad.length === 0, pilsunBad.map((q) => q.stem).join(' '))
}

// ── 5. 블록 굴리기 레벨 ──────────────────────────────────────────
// 손으로 그린 판은 풀 수 없는 것이 섞인다 (실제로 처음 5단계가 그랬다). BFS로 전수 검사.
const solved: number[] = []
LEVELS.forEach((map, i) => {
  const no = i + 1
  let lv: ReturnType<typeof parseLevel> | null = null
  try {
    lv = parseLevel(map)
  } catch (e) {
    check(`${no}단계 파싱`, false, (e as Error).message)
  }
  if (!lv) return

  const goals = lv.grid.flat().filter((t) => t === 2).length
  check(`${no}단계에 목표 구멍이 하나`, goals === 1, `${goals}개`)

  const n = solve(lv)
  check(`${no}단계는 풀 수 있음`, n !== null, '어떻게 굴려도 목표에 못 선다')
  if (n !== null) solved.push(n)

  // 시작 지점이 곧 목표면 게임이 안 된다
  check(`${no}단계 시작이 목표가 아님`, lv.grid[lv.start.r][lv.start.c] !== 2)
})

const rising = solved.every((n, i) => i === 0 || n >= solved[i - 1])
check(
  '레벨이 뒤로 갈수록 어려워짐 (최소 굴림 수가 안 줄어듦)',
  rising,
  `최소 수: ${solved.join(' → ')}`,
)

// ── 6. 한자 카드 ────────────────────────────────────────────────
// localStorage가 없는 node 환경이라 cards.ts가 조용히 메모리로 동작하는지까지 확인한다
cards.resetAll()
check('처음엔 카드가 없음', cards.total() === 0)

cards.add('國', 2)
cards.add('外', 1)
cards.add('民', 1)
check('카드가 쌓임 (國2 外1 民1 = 4장)', cards.total() === 4, `${cards.total()}장`)

check('外國을 만들 수 있음', cards.canComplete('外國'))
check('國民을 만들 수 있음', cards.canComplete('國民'))
check('大韓民國은 못 만듦 (大·韓이 없다)', !cards.canComplete('大韓民國'))

check('外國 만들기 성공', cards.completeWord('外國'))
check('外國을 만들면 國이 1장 남음', cards.count('國') === 1, `${cards.count('國')}장`)
check('外는 다 씀', cards.count('外') === 0, `${cards.count('外')}장`)
check('國民은 아직 만들 수 있음 (國1 民1)', cards.canComplete('國民'))
check('國民 만들기 성공', cards.completeWord('國民'))
check('카드를 다 씀', cards.total() === 0, `${cards.total()}장`)
check('만든 낱말 2개', cards.completedWords().length === 2, cards.completedWords().join(' '))
check('같은 낱말은 두 번 못 만듦', !cards.canComplete('外國'))

// 교환: 5장 → 1장
cards.resetAll()
cards.add('土', 5)
check('4장으로는 교환 안 됨', !cards.exchange(['土', '土', '土', '土'], '學'))
check('5장으로 교환 성공', cards.exchange(['土', '土', '土', '土', '土'], '學'))
check('교환하면 낸 카드가 사라짐', cards.count('土') === 0, `${cards.count('土')}장`)
check('교환하면 원하는 카드를 받음', cards.count('學') === 1, `${cards.count('學')}장`)

cards.resetAll()
cards.add('日', 3)
cards.add('月', 2)
check('서로 다른 카드 5장으로도 교환됨', cards.exchange(['日', '日', '日', '月', '月'], '火'))
check('교환 뒤 火 1장만 남음', cards.total() === 1 && cards.count('火') === 1)

// 상으로 주는 한자는 반드시 배정한자 안에 있어야 한다
const rewardOk = Array.from({ length: 200 }, () => pickReward('6')).every((c) => seen.has(c))
check('보상 한자가 전부 배정한자 안에 있음', rewardOk)

// 여러 장을 줄 때는 서로 다른 글자여야 한다 (30단계면 30장)
for (const n of [1, 15, 30]) {
  const many = pickRewards('8', n)
  check(`카드 ${n}장 보상이 정확히 ${n}장`, many.length === n, `${many.length}장`)
  check(`카드 ${n}장 보상에 같은 글자 없음`, new Set(many).size === many.length)
  check(`카드 ${n}장 보상이 8급 배정한자 안`, many.every((c) => HANJA_8.some((h) => h.char === c)))
}

cards.resetAll()

// ── 결과 ───────────────────────────────────────────────────────
if (failed > 0) {
  console.error(`\n${failed}건 실패`)
  process.exit(1)
}
console.log(`\n전부 통과 — 한자 ${HANJA_8.length}자, 낱말 ${WORDS_8.length}개`)
