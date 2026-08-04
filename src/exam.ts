/**
 * 급수별 모의고사 — 사단법인 한국어문회 **출제기준표 그대로**.
 *
 *   급수    독음 훈음 반의 완성 동의 동음 뜻풀이 쓰기 필순  계   합격  시간
 *   8급      24  24   -    -    -    -     -     -    2   50   35   50분
 *   7급II    22  30   2    2    -    -     2     -    2   60   42   50분
 *   7급      32  30   2    2    -    -     2     -    2   70   49   50분
 *   6급II    32  29   2    2    -    -     2    10    3   80   56   50분
 *   6급      33  22   3    3    2    2     2    20    3   90   63   50분
 *
 * 문항 수·시간·합격선은 게임 밸런싱으로 건드리지 않는다. 이 화면이 실제 시험장의 예고편이다.
 * (실제 시험은 주관식이지만, 초등·유치 대상이라 4지선다로 낸다.)
 */
import type { GradeId } from './data/types'
import { LADDER, cumulative, wordsUpTo, hunEumOf, HANJA_BY_CHAR } from './data/words'
import { ANTONYMS, SYNONYMS, IDIOMS, upTo } from './data/pairs'
import { NO_PILSUN } from './data/grades'
import * as srs from './srs'
import * as progress from './progress'
import * as sfx from './sfx'
import { renderCharSvg, strokeCount } from './hanjaSvg'
import * as strokes from './strokes'
import { el, loadingBox, progressBar, resultCard, topBar, type Screen } from './ui'

export interface ExamSpec {
  id: GradeId
  name: string
  dokeum: number
  hunmum: number
  antonym: number
  idiom: number
  synonym: number
  homonym: number
  meaning: number
  writing: number
  pilsun: number
  total: number
  pass: number
  minutes: number
  /** 그 급수의 읽기 배정한자 누계 */
  chars: number
}

export const EXAMS: Readonly<Record<GradeId, ExamSpec>> = {
  '8': mk('8', '8급', { dokeum: 24, hunmum: 24, pilsun: 2 }, 50, 35, 50, 50),
  '7II': mk('7II', '7급II', { dokeum: 22, hunmum: 30, antonym: 2, idiom: 2, meaning: 2, pilsun: 2 }, 60, 42, 50, 100),
  '7': mk('7', '7급', { dokeum: 32, hunmum: 30, antonym: 2, idiom: 2, meaning: 2, pilsun: 2 }, 70, 49, 50, 150),
  '6II': mk(
    '6II',
    '6급II',
    { dokeum: 32, hunmum: 29, antonym: 2, idiom: 2, meaning: 2, writing: 10, pilsun: 3 },
    80,
    56,
    50,
    225,
  ),
  '6': mk(
    '6',
    '6급',
    { dokeum: 33, hunmum: 22, antonym: 3, idiom: 3, synonym: 2, homonym: 2, meaning: 2, writing: 20, pilsun: 3 },
    90,
    63,
    50,
    300,
  ),
  '5II': mk('5II', '5급II', {}, 0, 0, 50, 400),
  '5': mk('5', '5급', {}, 0, 0, 50, 500),
}

function mk(
  id: GradeId,
  name: string,
  parts: Partial<Omit<ExamSpec, 'id' | 'name' | 'total' | 'pass' | 'minutes' | 'chars'>>,
  total: number,
  pass: number,
  minutes: number,
  chars: number,
): ExamSpec {
  const spec: ExamSpec = {
    id,
    name,
    dokeum: 0,
    hunmum: 0,
    antonym: 0,
    idiom: 0,
    synonym: 0,
    homonym: 0,
    meaning: 0,
    writing: 0,
    pilsun: 0,
    total,
    pass,
    minutes,
    chars,
    ...parts,
  }
  const sum =
    spec.dokeum +
    spec.hunmum +
    spec.antonym +
    spec.idiom +
    spec.synonym +
    spec.homonym +
    spec.meaning +
    spec.writing +
    spec.pilsun
  // 출제기준표를 옮겨 적다 틀리면 여기서 즉시 터진다
  if (sum !== total) throw new Error(`${name} 출제 구성 합계가 ${sum}인데 총문항은 ${total}이다`)
  return spec
}

type QKind = '독음' | '훈음' | '반의어' | '완성형' | '유의어' | '동음이의어' | '뜻풀이' | '한자쓰기' | '필순'

interface Question {
  kind: QKind
  stem: string
  /** 필순 문제에서 강조할 획 (0-based) */
  highlight?: number
  choices: string[]
  answer: string
  chars: string[]
  note: string
}

/** n개를 뽑되 모자라면 있는 만큼만 (데이터가 얇은 급수에서 죽지 않게) */
function take<T>(arr: T[], n: number): T[] {
  return srs.shuffle(arr).slice(0, n)
}

/** 정답 + 오답 3개를 섞어 4지선다로 */
function choose(answer: string, pool: string[]): string[] {
  const distractors = take(
    pool.filter((p) => p !== answer),
    3,
  )
  return srs.shuffle([answer, ...distractors])
}

export function buildQuestions(spec: ExamSpec): Question[] {
  const qs: Question[] = []
  const chars = cumulative(spec.id)
  const words = wordsUpTo(spec.id)
  const readings = words.map((w) => w.reading)
  const hunEums = chars.map((h) => `${h.hun} ${h.eum}`)

  // ── 독음: 한자어를 주고 읽기 ──────────────────────────────
  for (const w of take(words, spec.dokeum)) {
    qs.push({
      kind: '독음',
      stem: w.word,
      choices: choose(w.reading, readings),
      answer: w.reading,
      chars: [...w.word],
      note: `${w.word} → ${w.reading} (${w.meaning})`,
    })
  }

  // ── 훈음: 한자를 주고 뜻과 소리 ────────────────────────────
  for (const h of take(chars, spec.hunmum)) {
    const he = `${h.hun} ${h.eum}`
    qs.push({
      kind: '훈음',
      stem: h.char,
      choices: choose(he, hunEums),
      answer: he,
      chars: [h.char],
      note: `${h.char} → ${he}`,
    })
  }

  // ── 반의어 / 유의어: 짝이 되는 한자 고르기 ──────────────────
  const pairKinds: [QKind, typeof ANTONYMS, number][] = [
    ['반의어', upTo(ANTONYMS, spec.id), spec.antonym],
    ['유의어', upTo(SYNONYMS, spec.id), spec.synonym],
  ]
  for (const [kind, pool, count] of pairKinds) {
    for (const p of take(pool, count)) {
      // a를 보여 주고 b를 고르게 (방향은 매번 뒤집는다)
      const flip = Math.random() < 0.5
      const [shown, answer] = flip ? [p.b, p.a] : [p.a, p.b]
      qs.push({
        kind,
        stem: shown,
        choices: choose(answer, chars.map((h) => h.char)),
        answer,
        chars: [p.a, p.b],
        note: `${p.a} ↔ ${p.b} — ${p.note}`,
      })
    }
  }

  // ── 완성형: 성어의 빈칸 채우기 ─────────────────────────────
  for (const idiom of take(upTo(IDIOMS, spec.id), spec.idiom)) {
    const letters = [...idiom.text]
    const blank = Math.floor(Math.random() * letters.length)
    const answer = letters[blank]
    const shown = letters.map((c, i) => (i === blank ? '□' : c)).join('')
    qs.push({
      kind: '완성형',
      stem: shown,
      choices: choose(answer, chars.map((h) => h.char)),
      answer,
      chars: letters,
      note: `${idiom.text} (${idiom.reading}) — ${idiom.meaning}`,
    })
  }

  // ── 동음이의어: 음이 같은 다른 한자 고르기 ──────────────────
  if (spec.homonym > 0) {
    const byEum = new Map<string, string[]>()
    for (const h of chars) byEum.set(h.eum, [...(byEum.get(h.eum) ?? []), h.char])
    const sameSound = [...byEum.values()].filter((cs) => cs.length >= 2)
    for (const group of take(sameSound, spec.homonym)) {
      const [shown, answer] = take(group, 2)
      // 오답은 음이 **다른** 글자여야 문제가 성립한다
      const others = chars.filter((h) => h.eum !== HANJA_BY_CHAR.get(shown)!.eum).map((h) => h.char)
      qs.push({
        kind: '동음이의어',
        stem: shown,
        choices: srs.shuffle([answer, ...take(others, 3)]),
        answer,
        chars: [shown, answer],
        note: `${shown}(${hunEumOf(shown)})과 ${answer}(${hunEumOf(answer)})은 소리가 같다`,
      })
    }
  }

  // ── 뜻풀이: 설명을 주고 한자어 고르기 ──────────────────────
  for (const w of take(words, spec.meaning)) {
    qs.push({
      kind: '뜻풀이',
      stem: w.meaning,
      choices: choose(w.word, words.map((x) => x.word)),
      answer: w.word,
      chars: [...w.word],
      note: `${w.meaning} → ${w.word}(${w.reading})`,
    })
  }

  // ── 한자쓰기: 한글 독음을 주고 한자어 고르기 ────────────────
  for (const w of take(words, spec.writing)) {
    qs.push({
      kind: '한자쓰기',
      stem: w.reading,
      choices: choose(w.word, words.map((x) => x.word)),
      answer: w.word,
      chars: [...w.word],
      note: `${w.reading} → ${w.word} (${w.meaning})`,
    })
  }

  // ── 필순: 강조된 획이 몇 번째인가 ──────────────────────────
  // 획이 너무 적으면 문제가 안 되고, 자형이 정자와 다른 글자(NO_PILSUN)는 물으면 안 된다.
  const writable = chars.filter((h) => strokeCount(h.char) >= 5 && !NO_PILSUN.has(h.char))
  for (const h of take(writable, spec.pilsun)) {
    const n = strokeCount(h.char)
    const target = Math.floor(Math.random() * n)
    const pool = take(
      [...Array(n).keys()].filter((i) => i !== target),
      3,
    )
    qs.push({
      kind: '필순',
      stem: h.char,
      highlight: target,
      choices: srs.shuffle([target + 1, ...pool.map((i) => i + 1)]).map((i) => `${i}번째`),
      answer: `${target + 1}번째`,
      chars: [h.char],
      note: `${h.char}(${hunEumOf(h.char)}) — 빨간 획은 ${target + 1}번째 (모두 ${n}획)`,
    })
  }

  return srs.shuffle(qs)
}

const ASK: Record<QKind, string> = {
  독음: '이 낱말을 어떻게 읽을까요?',
  훈음: '이 한자의 뜻과 소리는?',
  반의어: '뜻이 반대인 한자는?',
  유의어: '뜻이 비슷한 한자는?',
  완성형: '□ 에 들어갈 한자는?',
  동음이의어: '소리가 같은 한자는?',
  뜻풀이: '이 뜻을 가진 낱말은?',
  한자쓰기: '이 말을 한자로 쓰면?',
  필순: '빨간 획은 몇 번째로 쓸까요?',
}

/** 보기가 한자(어)인 유형 — 글씨를 크게 보여 준다 */
const HANJA_CHOICES: ReadonlySet<QKind> = new Set(['반의어', '유의어', '완성형', '동음이의어', '뜻풀이', '한자쓰기'])

export const examScreen =
  (grade: GradeId, home: Screen): Screen =>
  (root, nav) => {
    const spec = EXAMS[grade]
    let ticking = 0
    let disposed = false

    // 필순 문제를 만들려면 획순 데이터가 있어야 한다 — 급수별로 나눠 받으므로 먼저 기다린다
    root.append(topBar(`${spec.name} 모의고사`, () => nav(home)), loadingBox('시험 준비 중…'))
    void strokes.loadUpTo(grade).then(() => {
      if (disposed) return
      root.replaceChildren()
      start()
    })

    return () => {
      disposed = true
      clearInterval(ticking)
    }

    function start() {
    const questions = buildQuestions(spec)
    const picked: (string | null)[] = new Array(questions.length).fill(null)
    let idx = 0
    const startedAt = Date.now()
    const deadline = startedAt + spec.minutes * 60 * 1000
    let submitted = false

    const clock = el('span', { class: 'ex-clock' })
    const bar = progressBar()
    const stage = el('div', { class: 'ex-stage' })
    const counter = el('span', { class: 'ex-counter' })

    function fmt(ms: number): string {
      const s = Math.max(0, Math.round(ms / 1000))
      return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    }

    function submit() {
      if (submitted) return
      submitted = true
      clearInterval(ticking)

      let score = 0
      const wrong: Question[] = []
      questions.forEach((q, i) => {
        const ok = picked[i] === q.answer
        if (ok) score++
        else wrong.push(q)
        for (const c of q.chars) srs.review(c, ok ? 'right' : 'wrong')
      })

      const seconds = Math.round((Date.now() - startedAt) / 1000)
      const passed = score >= spec.pass
      progress.recordExam({ score, total: spec.total, passed, seconds, at: Date.now() }, spec.id)
      // 제출음이 끝난 뒤에 결과음 — 합격이면 팡파레가 끝나는 지점부터 박수가 이어진다
      setTimeout(() => {
        if (passed) {
          sfx.fanfare()
          sfx.applause(0.68)
        } else {
          sfx.soft()
        }
      }, 260)

      const next = LADDER[LADDER.indexOf(grade) + 1]
      const notes = el(
        'div',
        { class: 'ex-notes' },
        wrong.length
          ? [
              el('h3', { class: 'ex-notes__title', text: `틀린 문제 ${wrong.length}개` }),
              ...wrong.map((q) => el('p', { class: 'ex-notes__row', text: `[${q.kind}] ${q.note}` })),
            ]
          : [el('p', { class: 'ex-notes__row', text: '전부 맞혔어요!' })],
      )

      root.replaceChildren(
        topBar(`${spec.name} 모의고사`, () => nav(home)),
        resultCard({
          emoji: passed ? '🎖️' : '📚',
          title: passed ? `합격!  ${score} / ${spec.total}` : `${score} / ${spec.total}`,
          lines: [
            `합격 기준 ${spec.pass}문항 (70%)`,
            `걸린 시간 ${fmt(seconds * 1000)} / ${spec.minutes}분`,
            passed
              ? next
                ? `${spec.name} 급수증을 받았어요 — ${EXAMS[next].name}이 열렸어요!`
                : `${spec.name} 급수증을 받았어요`
              : `${spec.pass - score}문항만 더 맞히면 합격이에요`,
          ],
          actions: [
            { label: '다시 응시', primary: true, onClick: () => nav(examScreen(grade, home)) },
            { label: '정원으로', onClick: () => nav(home) },
          ],
        }),
        notes,
      )
    }

    function render() {
      if (submitted) return
      const q = questions[idx]
      counter.textContent = `${idx + 1} / ${questions.length}`
      bar.set((idx + 1) / questions.length)

      const stemClass =
        q.kind === '필순'
          ? 'ex-stem ex-stem--svg'
          : q.kind === '뜻풀이'
            ? 'ex-stem ex-stem--text'
            : [...q.stem].length === 1
              ? 'ex-stem ex-stem--char'
              : 'ex-stem ex-stem--word'

      const stem =
        q.kind === '필순'
          ? el('div', { class: stemClass }, [renderCharSvg(q.stem, { size: 190, highlight: q.highlight })])
          : el('div', { class: stemClass, text: q.stem })

      stage.replaceChildren(
        el('span', { class: 'ex-kind', text: q.kind }),
        el('p', { class: 'ex-ask', text: ASK[q.kind] }),
        stem,
        el(
          'div',
          { class: 'ex-choices' },
          q.choices.map((c) =>
            el('button', {
              class: `ex-choice ${HANJA_CHOICES.has(q.kind) ? 'ex-choice--hanja' : ''} ${
                picked[idx] === c ? 'ex-choice--on' : ''
              }`,
              type: 'button',
              text: c,
              onclick: () => {
                // 정답 여부는 제출할 때까지 안 알려 준다 — 누른 느낌만 준다
                sfx.tap()
                picked[idx] = c
                if (idx < questions.length - 1) idx++
                render()
              },
            }),
          ),
        ),
        el('div', { class: 'ex-nav' }, [
          el('button', {
            class: 'hn-btn',
            type: 'button',
            text: '← 이전',
            disabled: idx === 0,
            onclick: () => {
              if (idx > 0) {
                sfx.move()
                idx--
                render()
              }
            },
          }),
          el('button', {
            class: 'hn-btn',
            type: 'button',
            text: '다음 →',
            disabled: idx === questions.length - 1,
            onclick: () => {
              if (idx < questions.length - 1) {
                sfx.move()
                idx++
                render()
              }
            },
          }),
          el('button', {
            class: 'hn-btn hn-btn--primary',
            type: 'button',
            text: `제출 (${picked.filter(Boolean).length}/${questions.length})`,
            onclick: () => {
              sfx.submit()
              submit()
            },
          }),
        ]),
      )
    }

    ticking = window.setInterval(() => {
      const left = deadline - Date.now()
      clock.textContent = fmt(left)
      clock.classList.toggle('ex-clock--hurry', left < 5 * 60 * 1000)
      if (left <= 0) submit()
    }, 1000)
    clock.textContent = fmt(deadline - Date.now())

    root.append(
      topBar(`${spec.name} 모의고사`, () => nav(home)),
      el('div', { class: 'ex-wrap' }, [el('div', { class: 'ex-hud' }, [counter, clock]), bar.node, stage]),
    )
    render()
    }
  }
