/**
 * 미니게임 ②  독음 요격 — 출제 유형 「독음」
 * 한자어가 하늘에서 내려온다. 바닥에 닿기 전에 바른 소리(독음)를 골라 맞힌다.
 * 8급 시험의 독음 문항은 낱말을 주고 읽는 형식이라, 낱말 단위로 낸다.
 */
import { cumulative, wordsUpTo } from '../data/words'
import type { GradeId, Word } from '../data/types'
import * as srs from '../srs'
import * as progress from '../progress'
import * as tts from '../tts'
import * as cards from '../cards'
import * as prefs from '../prefs'
import { pickRewards } from '../reward'
import { cardsModal, el, resultCard, toast, topBar, type Screen } from '../ui'

const GAME_ID = 'dokeum'
const LIVES = 3
/** 한 낱말이 바닥까지 내려오는 시간(ms). 판이 진행될수록 짧아진다. */
// 처음엔 9000/4000/400이었는데 아이가 읽기도 전에 떨어졌다 → 속도를 20% 줄였다(시간 ×1.25)
const FALL_START = 11250
const FALL_MIN = 5000
const FALL_STEP = 500
/** 이 점수마다 한자 카드 한 장 */
const CARD_PER_SCORE = 200

export const dokeumGame =
  (grade: GradeId, home: Screen): Screen =>
  (root, nav) => {
    const POOL = wordsUpTo(grade)

    /**
     * 이번 판에 낼 낱말 차례.
     *
     * 그냥 다 섞으면 **아래 급수 낱말이 대부분**이라(누계라서) 새로 연 급수 글자는
     * 어쩌다 한 번 나온다 — 4급에서 재 보니 낙하하는 낱말의 74%가 아래 급수 것이었다.
     * 목숨이 셋뿐이라 한 판이 짧은데 그러면 새 글자를 볼 새가 없다.
     *
     * 그래서 **이번 급수 낱말 + 복습할 때가 된 글자 + 아직 안 배운 글자**를 앞으로 당긴다.
     * 나머지도 뒤에 그대로 남겨 둔다 — 오래 버티면 아래 급수 복습으로 이어진다.
     * (훈음·필순이 srs.pickSession으로 하는 것과 같은 뜻이다. 저쪽은 글자 단위,
     *  여기는 낱말 단위라 같은 함수를 못 쓴다.)
     */
    function makeQueue(): Word[] {
      const all = cumulative(grade).map((h) => h.char)
      const due = new Set(srs.dueChars(all))
      const front: Word[] = []
      const back: Word[] = []
      for (const w of POOL) {
        const hot = w.grade === grade || [...w.word].some((c) => due.has(c) || srs.isNew(c))
        ;(hot ? front : back).push(w)
      }
      return [...srs.shuffle(front), ...srs.shuffle(back)]
    }

    let lives = LIVES
    let score = 0
    let solved = 0
    let queue: Word[] = makeQueue()
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
      if (queue.length === 0) queue = makeQueue()
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
        // 설정에서 「변화 없음」을 고르면 처음 속도 그대로 간다
        if (prefs.get().dokeumRamp) fallMs = Math.max(FALL_MIN, fallMs - FALL_STEP)
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
      // 200점마다 카드 한 장 — 오래 버틸수록 더 준다
      const n = Math.floor(score / CARD_PER_SCORE)
      const prize = n > 0 ? pickRewards(grade, n) : []
      if (prize.length) cards.addMany(prize)

      const showResult = () =>
        root.replaceChildren(
          topBar('독음 요격', () => nav(home)),
          resultCard({
            emoji: score >= 200 ? '🚀' : '☄️',
            title: `${score}점`,
            lines: [
              `낱말 ${solved}개를 읽었어요`,
              prize.length
                ? `한자 카드 ${prize.length}장을 받았어요 (${CARD_PER_SCORE}점마다 1장)`
                : `${CARD_PER_SCORE}점을 넘기면 카드를 받아요`,
              isBest ? '새 최고 기록!' : `최고 기록 ${progress.bestOf(GAME_ID)}점`,
            ],
            actions: [
              { label: '한 판 더', primary: true, onClick: () => nav(dokeumGame(grade, home)) },
              { label: '정원으로', onClick: () => nav(home) },
            ],
          }),
        )

      if (!prize.length) {
        showResult()
        return
      }
      root.append(
        cardsModal({
          chars: prize,
          title: `한자 카드 ${prize.length}장`,
          lines: [`${score}점을 냈어요!`],
          onConfirm: showResult,
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
