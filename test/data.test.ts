/**
 * 배정한자·한자어 데이터 무결성 테스트.
 *
 * 이 데이터는 사람이 손으로 넣는다 → 손으로 넣는 순간 오타·중복·범위이탈이 들어온다.
 * 게임 로직보다 이 테스트가 먼저다. `npm test`.
 */
import { HANJA_8, WORDS_8 } from '../src/data/hanja8'
import { HANJA_7II, HANJA_7, HANJA_6II, HANJA_6, STROKE_VARIANT, NO_PILSUN } from '../src/data/grades'
import { ALL_HANJA, ALL_WORDS } from '../src/data/words'
import { EXAMS, buildQuestions } from '../src/exam'
import strokes from '../src/data/strokes.json'

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
const usedInWords = new Set([...ALL_WORDS.flatMap((w) => [...w.word])])
const unused = ALL_HANJA.filter((h) => !usedInWords.has(h.char)).map((h) => h.char)
check('300자 전부가 낱말에 최소 한 번은 쓰임', unused.length === 0, `미사용: ${unused.join(' ')}`)

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

const noStrokeAny = [...seen].filter((c) => !strokeMap[c])
check(
  '모든 급수의 한자에 획순 데이터가 있음',
  noStrokeAny.length === 0,
  noStrokeAny.join(' '),
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
] as const

for (const o of OFFICIAL) {
  const spec = EXAMS[o.id]
  check(`${spec.name} 총문항 ${o.total}`, spec.total === o.total, `실제 ${spec.total}`)
  check(`${spec.name} 합격문항 ${o.pass} (70%)`, spec.pass === o.pass, `실제 ${spec.pass}`)
  check(`${spec.name} 합격선이 70% 이상`, spec.pass / spec.total >= 0.7)
  check(`${spec.name} 시험시간 50분`, spec.minutes === 50, `실제 ${spec.minutes}분`)

  // 실제로 문제를 만들어 본다 — 데이터가 모자라면 문항 수가 안 채워진다
  const qs = buildQuestions(spec)
  check(`${spec.name} 문제 생성 ${o.total}문항`, qs.length === o.total, `실제 ${qs.length}문항`)

  const noAnswer = qs.filter((q) => !q.choices.includes(q.answer))
  check(`${spec.name} 모든 문제에 정답이 보기에 있음`, noAnswer.length === 0, noAnswer.map((q) => q.stem).join(' '))

  const notFour = qs.filter((q) => q.choices.length !== 4)
  check(`${spec.name} 모든 문제가 4지선다`, notFour.length === 0, notFour.map((q) => `${q.stem}:${q.choices.length}`).join(' '))

  const dupChoice = qs.filter((q) => new Set(q.choices).size !== q.choices.length)
  check(`${spec.name} 보기에 같은 것이 두 번 안 나옴`, dupChoice.length === 0, dupChoice.map((q) => q.stem).join(' '))

  const pilsunBad = qs.filter((q) => q.kind === '필순' && q.chars.some((c) => NO_PILSUN.has(c)))
  check(`${spec.name} 필순 문제에 대체 자형 글자가 안 나옴`, pilsunBad.length === 0, pilsunBad.map((q) => q.stem).join(' '))
}

// ── 결과 ───────────────────────────────────────────────────────
if (failed > 0) {
  console.error(`\n${failed}건 실패`)
  process.exit(1)
}
console.log(`\n전부 통과 — 한자 ${HANJA_8.length}자, 낱말 ${WORDS_8.length}개`)
