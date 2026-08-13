/**
 * 설정.
 *
 * 어른이 한 번 맞춰 놓고 다시 안 볼 것들을 모았다. 메인 화면에 흩어 두었더니
 * 아이가 놀려고 여는 화면에 "기록 불러오기" 같은 위험한 버튼이 늘 보였다.
 *
 * 고르면 **그 자리에서 들려준다** — 소리 크기도 말 빠르기도 귀로 확인하지 않으면
 * 무엇을 고른 건지 알 수 없다.
 */
import * as sfx from './sfx'
import * as tts from './tts'
import * as prefs from './prefs'
import * as backup from './backup'
import * as srs from './srs'
import * as progress from './progress'
import * as cards from './cards'
import { el, topBar, type Screen } from './ui'

/** 설정 한 줄 — 제목·설명 + 오른쪽에 고르는 것 */
function row(title: string, desc: string, control: HTMLElement): HTMLElement {
  return el('div', { class: 'st-row' }, [
    el('div', { class: 'st-row__text' }, [
      el('span', { class: 'st-row__title', text: title }),
      el('span', { class: 'st-row__desc', text: desc }),
    ]),
    control,
  ])
}

/** 몇 개 중 하나를 고르는 버튼 묶음. select보다 손가락으로 누르기 쉽다 */
function chips<T>(
  options: { label: string; value: T }[],
  isOn: (v: T) => boolean,
  onPick: (v: T) => void,
): HTMLElement {
  const wrap = el('div', { class: 'st-chips' })
  const draw = () =>
    wrap.replaceChildren(
      ...options.map((o) =>
        el('button', {
          class: `st-chip ${isOn(o.value) ? 'st-chip--on' : ''}`,
          type: 'button',
          text: o.label,
          onclick: () => {
            onPick(o.value)
            draw()
          },
        }),
      ),
    )
  draw()
  return wrap
}

export const settingsScreen =
  (home: Screen): Screen =>
  (root, nav) => {
    function render() {
      const voices = tts.koreanVoices()

      // ── 소리 ───────────────────────────────────────────
      const soundRow = row(
        '효과음 크기',
        '버튼·카드·박수 소리의 크기예요',
        chips(
          [{ label: '꺼짐', value: 0 }, ...sfx.VOLUMES],
          (v) => (v === 0 ? !sfx.isOn() : sfx.isOn() && sfx.volume() === v),
          (v) => {
            // 「꺼짐」과 크기를 한 줄에서 고르게 한다 — 끄는 것도 크기의 하나로 보는 게 자연스럽다
            if (v === 0) {
              if (sfx.isOn()) sfx.toggle()
              return
            }
            if (!sfx.isOn()) sfx.toggle()
            sfx.setVolume(v)
          },
        ),
      )

      // ── 목소리 ─────────────────────────────────────────
      const voiceRow = row(
        '읽어 주는 목소리',
        voices.length > 1
          ? '기기에 있는 한국어 목소리 중에서 골라요'
          : voices.length === 1
            ? `이 기기에는 «${voices[0].name}» 하나뿐이에요`
            : '이 기기에는 한국어 목소리가 없어요',
        voices.length > 1
          ? (() => {
              const sel = el('select', { class: 'st-select' })
              for (const v of voices) {
                const opt = el('option', { value: v.name, text: v.name })
                if (v.name === tts.voiceName()) opt.selected = true
                sel.append(opt)
              }
              sel.addEventListener('change', () => {
                tts.useVoice(sel.value)
                // 바꾼 목소리를 바로 들려준다
                tts.speak('한자놀이')
              })
              return sel
            })()
          : el('span', { class: 'st-none', text: '—' }),
      )

      const rateRow = row(
        '읽어 주는 속도',
        '아직 귀가 느린 아이는 느리게 두세요',
        chips(
          tts.RATES,
          (v) => tts.rate() === v,
          (v) => {
            tts.setRate(v)
            tts.speak('사람 인, 사이 간')
          },
        ),
      )

      // ── 놀이 ───────────────────────────────────────────
      const rampRow = row(
        '독음 요격 속도',
        '맞힐수록 낱말이 빨리 떨어지게 할지',
        chips(
          [
            { label: '변화 없음', value: false },
            { label: '가중됨', value: true },
          ],
          (v) => prefs.get().dokeumRamp === v,
          (v) => {
            sfx.tap()
            prefs.setDokeumRamp(v)
          },
        ),
      )

      // ── 기록 ───────────────────────────────────────────
      const backupRow = row(
        '기록',
        '기록은 이 브라우저에만 있어요. 기기를 바꾸거나 브라우저 데이터를 지우면 사라져요',
        el('div', { class: 'st-chips' }, [
          el('button', {
            class: 'st-chip',
            type: 'button',
            text: '💾 저장',
            onclick: () => {
              sfx.tap()
              backup.download()
            },
          }),
          el('button', {
            class: 'st-chip',
            type: 'button',
            text: '📂 불러오기',
            onclick: () =>
              backup.pickAndRestore(
                (n) => {
                  alert(`기록 ${n}개를 되돌렸어요.`)
                  render()
                },
                (msg) => alert(msg),
              ),
          }),
        ]),
      )

      const passwordRow = row(
        '지우기 비밀번호',
        `「기록 처음부터」를 누를 때 물어봐요. 처음 값은 ${prefs.DEFAULT_RESET_PASSWORD}예요 — 아이가 모르게 바꿔 두세요`,
        el('button', {
          class: 'st-chip',
          type: 'button',
          text: '바꾸기',
          onclick: () => {
            const now = prompt('지금 비밀번호를 입력하세요')
            if (now === null) return
            if (!prefs.checkResetPassword(now)) {
              alert('비밀번호가 달라요.')
              return
            }
            const next = prompt('새 비밀번호를 입력하세요')
            if (next === null) return
            if (!next.trim()) {
              alert('빈 비밀번호는 쓸 수 없어요.')
              return
            }
            if (prompt('한 번 더 입력하세요')?.trim() !== next.trim()) {
              alert('두 번 입력한 값이 달라요. 바꾸지 않았어요.')
              return
            }
            prefs.setResetPassword(next)
            alert('비밀번호를 바꿨어요.')
          },
        }),
      )

      const resetRow = row(
        '기록 처음부터',
        '배운 기록·급수증·한자 카드를 모두 지워요. 되돌릴 수 없어요',
        el('button', {
          class: 'st-chip st-chip--danger',
          type: 'button',
          text: '지우기',
          onclick: () => {
            // 확인 창만 두 번 띄우면 아이는 그냥 두 번 누른다 — 아는 사람만 통과하는 단계가 필요하다
            if (!confirm('배운 기록·급수증·한자 카드가 모두 지워집니다. 계속할까요?')) return
            const pw = prompt('비밀번호를 입력하세요 (먼저 「💾 저장」을 받아 두면 안전해요)')
            if (pw === null) return
            if (!prefs.checkResetPassword(pw)) {
              alert('비밀번호가 달라요. 아무것도 지우지 않았어요.')
              return
            }
            srs.resetAll()
            progress.resetAll()
            cards.resetAll()
            nav(home)
          },
        }),
      )

      root.replaceChildren(
        topBar('설정', () => nav(home)),
        el('div', { class: 'st-wrap' }, [
          el('section', { class: 'st-sec' }, [el('h2', { class: 'st-sec__title', text: '🔊 소리' }), soundRow, voiceRow, rateRow]),
          el('section', { class: 'st-sec' }, [el('h2', { class: 'st-sec__title', text: '🎮 놀이' }), rampRow]),
          el('section', { class: 'st-sec' }, [
            el('h2', { class: 'st-sec__title', text: '💾 기록' }),
            backupRow,
            passwordRow,
            resetRow,
          ]),
        ]),
      )
    }

    render()
  }
