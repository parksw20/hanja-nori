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
    const hintBtn = el('button', {
      class: 'hn-btn ps-hint',
      type: 'button',
      text: '살짝 보여줘',
      onclick: () => writer?.animateCharacter(),
    })

    function cleanupWriter() {
      // hanzi-writer는 target 안에 svg를 붙인다. 판을 갈 땐 통째로 비운다.
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
      cleanupWriter()

      writer = HanziWriter.create(stage, char, {
        width: 260,
        height: 260,
        padding: 12,
        showCharacter: false,
        showOutline: true,
        strokeColor: '#3fc1a0',
        outlineColor: '#3a4468',
        drawingColor: '#ffd166',
        drawingWidth: 26,
        highlightColor: '#ffd166',
        charDataLoader: (c: string, onComplete: (d: StrokeData) => void) => onComplete(STROKES[c]),
      })

      writer.quiz({
        // 두 번 삐끗하면 다음 획을 살짝 비춰 준다 (아이가 막혀서 그만두지 않도록)
        showHintAfterMisses: 2,
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
      cleanupWriter()
    }
  }
