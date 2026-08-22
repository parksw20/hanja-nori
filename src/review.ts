/**
 * 시든 한자 복습.
 *
 * 며칠 안 하면 정원이 온통 빨개진다. 그때 놀이를 골라 들어가면 시든 글자가
 * 섞여 나오기는 하지만 한 판에 몇 자뿐이라, 빨간 것을 다 지우려면 한참 걸린다.
 * 여기서는 **시든 것만 모아** 한 자씩 빠르게 넘긴다.
 *
 * 맞히면 그 자리에서 복습 기한이 밀려 빨간 테두리가 사라진다. 중간에 그만둬도
 * 답한 것까지는 남는다 — 한 문제마다 바로 저장하기 때문이다.
 */
import type { GradeId } from './data/types'
import { cumulative, hunEumOf } from './data/words'
import * as srs from './srs'
import * as progress from './progress'
import * as tts from './tts'
import * as sfx from './sfx'
import { el, progressBar, resultCard, toast, topBar, type Screen } from './ui'

/** 지금 시든 글자 — 보고 있는 급수가 아니라 **연 급수 전체**에서 모은다 */
export function wiltedNow(): string[] {
  return srs.wiltedChars(cumulative(progress.topUnlockedGrade()).map((h) => h.char))
}

export const reviewScreen =
  (_grade: GradeId, home: Screen): Screen =>
  (root, nav) => {
    const pool = cumulative(progress.topUnlockedGrade()).map((h) => h.char)
    /** 시작할 때 한 번 정한다 — 답하는 사이에 목록이 줄어들면 남은 수가 오락가락한다 */
    const queue = wiltedNow()
    const total = queue.length
    let cleared = 0
    let wrong = 0
    let locked = false

    if (total === 0) {
      root.append(
        topBar('시든 한자 복습', () => nav(home)),
        resultCard({
          emoji: '🌿',
          title: '시든 한자가 없어요',
          lines: ['정원이 모두 싱싱해요!'],
          actions: [{ label: '정원으로', primary: true, onClick: () => nav(home) }],
        }),
      )
      return
    }

    const bar = progressBar()
    const count = el('span', { class: 'rv-count' })
    const charEl = el('div', { class: 'rv-char' })
    const choices = el('div', { class: 'rv-choices' })
    const hint = el('p', { class: 'rv-hint', text: '이 한자의 뜻과 소리는?' })

    function next() {
      locked = false
      if (queue.length === 0) {
        finish()
        return
      }
      const char = queue[0]
      charEl.textContent = char
      charEl.className = 'rv-char'
      count.textContent = `${cleared} / ${total}자 되살림`
      bar.set(cleared / total)

      const answer = hunEumOf(char)
      const others = srs
        .shuffle(pool.filter((c) => c !== char))
        .map(hunEumOf)
        .filter((t) => t !== answer)
      // 훈음이 같은 글자가 있어 보기가 겹치면 문제가 깨진다 → 중복을 먼저 걷어낸다
      const picked = [...new Set(others)].slice(0, 3)
      const opts = srs.shuffle([answer, ...picked])

      choices.replaceChildren(
        ...opts.map((t) =>
          el('button', { class: 'rv-choice', type: 'button', text: t, onclick: () => answerWith(char, answer, t) }),
        ),
      )
    }

    function answerWith(char: string, answer: string, picked: string) {
      if (locked) return
      locked = true
      if (picked === answer) {
        sfx.tap()
        srs.review(char, 'right')
        queue.shift()
        cleared++
        charEl.classList.add('rv-char--ok')
        tts.speak(answer)
        toast(root, '되살아났어요! 🌿', 'good')
        setTimeout(next, 420)
      } else {
        sfx.soft()
        srs.review(char, 'wrong')
        wrong++
        // 틀린 것은 맨 뒤로 — 한 바퀴 돌고 다시 물어본다
        queue.push(queue.shift()!)
        charEl.classList.add('rv-char--bad')
        tts.speak(answer)
        toast(root, `${char} 은(는) "${answer}"`, 'bad')
        setTimeout(next, 1100)
      }
    }

    function finish() {
      root.replaceChildren(
        topBar('시든 한자 복습', () => nav(home)),
        resultCard({
          emoji: '🌸',
          title: `${cleared}자를 되살렸어요!`,
          lines: [
            wrong ? `${wrong}번 틀렸지만 끝까지 했어요` : '한 번도 안 틀렸어요!',
            '정원에 빨간 테두리가 사라졌어요',
          ],
          actions: [{ label: '정원으로', primary: true, onClick: () => nav(home) }],
        }),
      )
    }

    root.append(
      topBar('시든 한자 복습', () => nav(home)),
      el('div', { class: 'rv-wrap' }, [
        el('div', { class: 'rv-hud' }, [count]),
        bar.node,
        charEl,
        hint,
        choices,
      ]),
    )
    next()
  }
