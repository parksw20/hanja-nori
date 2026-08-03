/**
 * 미니게임 ③  필순 따라쓰기 — 출제 유형 「필순」
 * 획을 순서대로 직접 그어야 통과한다. 8급에서 필순은 2문항뿐이지만,
 * 손으로 쓰는 경험이 훈음·독음 기억을 가장 오래 붙들어 둔다.
 *
 * 획순 데이터는 Make Me a Hanzi(hanzi-writer-data)에서 온 것을 굽는다.
 * → scripts/build-strokes.mjs, 라이선스는 NOTICE.md 참고.
 */
import HanziWriter from 'hanzi-writer'
import strokesJson from '../data/strokes.json'
import { cumulative, hunEumOf } from '../data/words'
import { NO_PILSUN } from '../data/grades'
import type { GradeId, StrokeData } from '../data/types'
import * as srs from '../srs'
import * as progress from '../progress'
import * as tts from '../tts'
import { el, resultCard, toast, topBar, type Screen } from '../ui'

const GAME_ID = 'pilsun'
const ROUND = 5

const STROKES = strokesJson as Record<string, StrokeData>

export const pilsunGame =
  (grade: GradeId, home: Screen): Screen =>
  (root, nav) => {
    const chars = srs.pickSession(
      // 자형이 정자와 다른 글자(敎 飮 窓 淸)는 획순을 가르치면 안 된다
      cumulative(grade)
        .filter((h) => !NO_PILSUN.has(h.char))
        .map((h) => h.char),
      ROUND,
      2, // 손으로 쓰는 건 힘드니 새 글자는 판당 2자까지
    )

    let idx = 0
    let score = 0
    let totalMistakes = 0
    let writer: HanziWriter | null = null
    let disposed = false

    const prompt = el('p', { class: 'ps-prompt' })
    const counter = el('span', { class: 'ps-counter' })
    const stage = el('div', { class: 'ps-stage' })
    /**
     * 힌트는 hanzi-writer에게 맡기지 않는다.
     *
     * `animateCharacter()`는 내부에서 `cancelQuiz()`를 부르고, `highlightStroke()`도 실측해 보니
     * 퀴즈 입력이 죽었다 — 힌트를 한 번 누르면 그 뒤로 아무리 그어도 반응하지 않았다.
     * 그래서 획 데이터를 **우리 SVG에 직접** 그린다. `pointer-events: none` 오버레이라
     * 보여 주는 동안에도 아이가 그대로 그을 수 있고, 퀴즈는 아예 건드리지 않는다.
     *
     * 좌표계는 writer가 쓰는 g의 transform을 그대로 복사해 맞춘다(자체 계산하면 어긋난다).
     */
    const HINT_STEP = 800 // 획 사이 간격(ms). hanzi-writer 기본 1000ms보다 20% 빠르다.
    const HINT_FADE = 260
    let hintTimers: number[] = []
    /** 지금까지 바르게 그은 획 수 — 힌트는 이 다음 획부터 보여 준다 */
    let drawnCount = 0

    // 화면에 실제로 붙어 있는 글씨판을 문서에서 찾는다.
    // 클로저의 stage가 이전 판의 것일 수 있어(판을 갈면 새 화면이 마운트된다) 눈에 보이는 쪽을 기준으로 삼는다.
    const liveStage = () => document.querySelector<HTMLElement>('.ps-stage') ?? stage

    function clearHint() {
      for (const t of hintTimers) clearTimeout(t)
      hintTimers = []
      document.querySelector('.ps-hintlayer')?.remove()
    }

    function showHint(char: string) {
      clearHint()
      const host = liveStage()
      const src = host.querySelector('svg:not(.ps-hintlayer) g[transform]')
      if (!src) return

      // 이미 그은 획은 다시 보여 줄 필요가 없다 — **다음에 그을 획부터** 알려 준다
      const remaining = STROKES[char].strokes.slice(drawnCount)
      if (remaining.length === 0) return

      const NS = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(NS, 'svg')
      svg.setAttribute('class', 'ps-hintlayer')
      svg.setAttribute('width', '260')
      svg.setAttribute('height', '260')
      const g = document.createElementNS(NS, 'g')
      g.setAttribute('transform', src.getAttribute('transform')!)
      svg.append(g)
      // 글씨판 **맨 아래**에 깔아 둔다. 내가 쓴 획과 안내선이 힌트 위로 올라와야
      // 어디까지 썼는지가 안 가린다 (hanzi-writer의 svg는 배경이 투명하다).
      host.prepend(svg)

      const paths = remaining.map((d) => {
        const p = document.createElementNS(NS, 'path')
        p.setAttribute('d', d)
        p.setAttribute('fill', '#ffd166') // 노란색
        p.style.opacity = '0'
        p.style.transition = `opacity ${HINT_FADE}ms ease`
        g.append(p)
        return p
      })

      // 획을 순서대로 하나씩 노랗게 켠다 → 다 보여 준 뒤 통째로 지운다
      paths.forEach((p, i) => {
        hintTimers.push(window.setTimeout(() => (p.style.opacity = '1'), i * HINT_STEP))
      })
      const total = paths.length * HINT_STEP + HINT_FADE
      hintTimers.push(
        window.setTimeout(() => {
          svg.style.opacity = '0'
          svg.style.transition = `opacity ${HINT_FADE}ms ease`
        }, total),
      )
      hintTimers.push(window.setTimeout(clearHint, total + HINT_FADE + 50))
    }

    const hintBtn = el('button', {
      class: 'hn-btn ps-hint',
      type: 'button',
      text: '살짝 보여줘',
      onclick: () => showHint(chars[idx]),
    })

    function cleanupWriter() {
      // hanzi-writer는 target 안에 svg를 붙인다. 판을 갈 땐 통째로 비운다.
      clearHint()
      writer = null
      stage.replaceChildren()
    }

    function finish() {
      const isBest = progress.recordBest(GAME_ID, score)
      root.replaceChildren(
        topBar('필순 따라쓰기', () => nav(home)),
        resultCard({
          emoji: totalMistakes === 0 ? '🖌️' : '✏️',
          title: `${score}점`,
          lines: [
            `${ROUND}자를 썼어요`,
            totalMistakes === 0 ? '한 획도 안 틀렸어요!' : `삐끗한 획 ${totalMistakes}번`,
            isBest ? '새 최고 기록!' : `최고 기록 ${progress.bestOf(GAME_ID)}점`,
          ],
          actions: [
            { label: '한 판 더', primary: true, onClick: () => nav(pilsunGame(grade, home)) },
            { label: '정원으로', onClick: () => nav(home) },
          ],
        }),
      )
    }

    function step() {
      if (disposed) return
      if (idx >= chars.length) {
        finish()
        return
      }

      const char = chars[idx]
      const he = hunEumOf(char)
      const strokeCount = STROKES[char].strokes.length
      let mistakes = 0

      prompt.textContent = `「${he}」 — ${strokeCount}획`
      tts.speak(he)
      counter.textContent = `${idx + 1} / ${ROUND}`
      drawnCount = 0
      cleanupWriter()

      writer = HanziWriter.create(stage, char, {
        width: 260,
        height: 260,
        padding: 12,
        showCharacter: false,
        showOutline: true,
        strokeColor: '#7fd4ff',
        // 안내선은 반투명이어야 아래 깔린 노란 힌트가 비쳐 보인다
        outlineColor: 'rgba(120, 140, 200, 0.45)',
        drawingColor: '#7fd4ff',
        drawingWidth: 26,
        // 힌트 획은 노란색. 기본 속도(2)보다 20% 빠르게.
        highlightColor: '#ffd166',
        strokeHighlightSpeed: 2.4,
        charDataLoader: (c: string, onComplete: (d: StrokeData) => void) => onComplete(STROKES[c]),
      })

      writer.quiz({
        // 두 번 삐끗하면 다음 획을 살짝 비춰 준다 (아이가 막혀서 그만두지 않도록)
        showHintAfterMisses: 2,
        // 힌트가 "여기부터"를 알려면 어디까지 썼는지 알아야 한다.
        // 보여 주는 중에 그어도 힌트를 지우지 않는다 — 방금 그은 하늘색 획이 노란 힌트를 덮으므로
        // 화면은 저절로 "여기까지 썼고 이제 여기부터"가 된다.
        onCorrectStroke: (info: { strokeNum: number }) => {
          drawnCount = info.strokeNum + 1
        },
        onMistake: () => {
          mistakes++
          totalMistakes++
          toast(root, '획 순서를 봐요', 'bad')
        },
        onComplete: () => {
          score += Math.max(10, 50 - mistakes * 10)
          srs.review(char, mistakes === 0 ? 'easy' : mistakes <= 2 ? 'right' : 'wrong')
          toast(root, mistakes === 0 ? '완벽!' : '잘했어요', 'good')
          idx++
          setTimeout(step, 700)
        },
      })
    }

    root.append(
      topBar('필순 따라쓰기', () => nav(home)),
      el('div', { class: 'ps-wrap' }, [
        counter,
        prompt,
        stage,
        el('p', { class: 'ps-guide', text: '회색 획 위를 순서대로 그어 주세요' }),
        hintBtn,
      ]),
    )

    step()

    return () => {
      disposed = true
      clearHint()
      cleanupWriter()
    }
  }
