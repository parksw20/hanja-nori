/**
 * 미니게임 ②  독음 요격 — 출제 유형 「독음」
 * 한자어가 하늘에서 내려온다. 바닥에 닿기 전에 바른 소리(독음)를 골라 맞힌다.
 * 8급 시험의 독음 문항은 낱말을 주고 읽는 형식이라, 낱말 단위로 낸다.
 */
import { wordsUpTo } from '../data/words'
import type { GradeId, Word } from '../data/types'
import * as srs from '../srs'
import * as progress from '../progress'
import * as tts from '../tts'
import { el, resultCard, toast, topBar, type Screen } from '../ui'

const GAME_ID = 'dokeum'
const LIVES = 3
/** 한 낱말이 바닥까지 내려오는 시간(ms). 판이 진행될수록 짧아진다. */
const FALL_START = 9000
const FALL_MIN = 4000
const FALL_STEP = 400

export const dokeumGame =
  (grade: GradeId, home: Screen): Screen =>
  (root, nav) => {
    const POOL = wordsUpTo(grade)
    let lives = LIVES
    let score = 0
    let solved = 0
    let queue: Word[] = srs.shuffle(POOL)
    let cur: Word | null = null
    let raf = 0
    /** 이 낱말이 떨어진 시간(ms). 벽시계가 아니라 프레임 델타를 누적한다 —
     *  탭이 뒤로 가면 rAF가 멈추는데, 벽시계로 재면 돌아온 순간 바닥에 처박힌다. */
    let elapsed = 0
    let lastTs = 0
    let fallMs = FALL_START
    let over = false

    const sky = el('div', { class: 'dk-sky' })
    const faller = el('div', { class: 'dk-faller' })
    const choices = el('div', { class: 'dk-choices' })
    const livesEl = el('span', { class: 'dk-lives', text: '❤️'.repeat(LIVES) })
    const scoreEl = el('span', { class: 'dk-score', text: '0점' })

    function nextWord() {
      if (over) return
      if (queue.length === 0) queue = srs.shuffle(POOL)
      cur = queue.shift()!

      faller.textContent = cur.word
      faller.className = 'dk-faller'
      faller.style.top = '0px'
      // 낱말이 길면 글씨를 줄여 화면 밖으로 안 나가게
      faller.style.fontSize = [...cur.word].length >= 4 ? '2.4rem' : '3.2rem'

      const others = srs
        .shuffle(POOL.filter((w) => w.reading !== cur!.reading))
        .slice(0, 3)
        .map((w) => w.reading)
      const opts = srs.shuffle([cur.reading, ...others])

      choices.replaceChildren(
        ...opts.map((r) =>
          el('button', {
            class: 'dk-choice',
            type: 'button',
            text: r,
            onclick: () => answer(r),
          }),
        ),
      )

      elapsed = 0
      lastTs = 0
      raf = requestAnimationFrame(tick)
    }

    function tick(now: number) {
      if (over || !cur) return
      // 한 프레임에 100ms 넘게 흘렀다면 탭이 쉬고 있었다는 뜻 — 그만큼은 안 떨어뜨린다
      if (lastTs) elapsed += Math.min(now - lastTs, 100)
      lastTs = now

      const t = elapsed / fallMs
      const travel = sky.clientHeight - faller.offsetHeight
      faller.style.top = `${Math.max(0, t * travel)}px`
      if (t >= 1) {
        miss()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    /** 남은 시간 비율 (1 = 방금 나왔다, 0 = 바닥) */
    function remaining(): number {
      return 1 - elapsed / fallMs
    }

    function stopFall() {
      cancelAnimationFrame(raf)
    }

    function miss() {
      if (!cur) return
      stopFall()
      for (const c of cur.word) srs.review(c, 'wrong')
      toast(root, `${cur.word} 은(는) "${cur.reading}"`, 'bad')
      loseLife()
    }

    function loseLife() {
      lives--
      livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🤍'.repeat(LIVES - Math.max(0, lives))
      if (lives <= 0) {
        finish()
      } else {
        faller.classList.add('dk-faller--boom')
        setTimeout(nextWord, 700)
      }
    }

    function answer(picked: string) {
      if (!cur || over) return
      if (picked === cur.reading) {
        stopFall()
        // 위에서 맞힐수록 점수가 높다 — 빨리 읽는 것이 곧 실력
        const remain = remaining()
        const gained = 10 + Math.round(remain * 20)
        score += gained
        solved++
        scoreEl.textContent = `${score}점`
        for (const c of cur.word) srs.review(c, remain > 0.6 ? 'easy' : 'right')
        // 맞힌 낱말을 소리로 확인시켜 준다
        tts.speak(cur.reading, { rate: 0.95 })
        toast(root, `+${gained}`, 'good')
        faller.classList.add('dk-faller--hit')
        fallMs = Math.max(FALL_MIN, fallMs - FALL_STEP)
        setTimeout(nextWord, 450)
      } else {
        for (const c of cur.word) srs.review(c, 'wrong')
        toast(root, '다시!', 'bad')
        stopFall()
        loseLife()
      }
    }

    function finish() {
      over = true
      stopFall()
      const isBest = progress.recordBest(GAME_ID, score)
      root.replaceChildren(
        topBar('독음 요격', () => nav(home)),
        resultCard({
          emoji: score >= 200 ? '🚀' : '☄️',
          title: `${score}점`,
          lines: [
            `낱말 ${solved}개를 읽었어요`,
            isBest ? '새 최고 기록!' : `최고 기록 ${progress.bestOf(GAME_ID)}점`,
          ],
          actions: [
            { label: '한 판 더', primary: true, onClick: () => nav(dokeumGame(grade, home)) },
            { label: '정원으로', onClick: () => nav(home) },
          ],
        }),
      )
    }

    sky.append(faller)
    root.append(
      topBar('독음 요격', () => nav(home)),
      el('div', { class: 'dk-wrap' }, [
        el('div', { class: 'dk-hud' }, [livesEl, scoreEl]),
        sky,
        el('p', { class: 'dk-hint', text: '바닥에 닿기 전에 바른 소리를 고르세요' }),
        choices,
      ]),
    )

    // rAF 안에서 첫 낱말을 띄우면 안 된다 — 탭이 뒤에 있으면 rAF가 안 돌아 게임이 시작조차 못 한다.
    // sky는 이미 DOM에 붙어 있어 clientHeight를 바로 읽을 수 있다.
    nextWord()

    return () => {
      over = true
      stopFall()
    }
  }
