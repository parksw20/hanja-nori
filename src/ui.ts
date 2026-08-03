/** DOM 조립 헬퍼 + 화면 전환. 프레임워크 없이 간다 (번들 작게, 아이 기기에서 가볍게). */

type Attrs = Record<string, string | number | boolean | ((e: Event) => void)>

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') node.addEventListener(k.replace(/^on/, '').toLowerCase(), v as EventListener)
    else if (k === 'class') node.className = String(v)
    else if (k === 'text') node.textContent = String(v)
    else if (v === false) continue
    else node.setAttribute(k, String(v))
  }
  for (const c of children) node.append(c)
  return node
}

/** 화면 하나. mount는 정리 함수를 돌려줄 수 있다 (타이머·이벤트 해제용). */
export type Screen = (root: HTMLElement, nav: Nav) => void | (() => void)
export type Nav = (screen: Screen) => void

let cleanup: (() => void) | void

export function createNav(root: HTMLElement): Nav {
  const nav: Nav = (screen) => {
    if (typeof cleanup === 'function') cleanup()
    root.replaceChildren()
    root.scrollTop = 0
    cleanup = screen(root, nav)
  }
  return nav
}

/** 상단 바 — 뒤로가기 + 제목 + 오른쪽 상태 */
export function topBar(title: string, onBack: () => void, right = ''): HTMLElement {
  return el('header', { class: 'hn-top' }, [
    el('button', { class: 'hn-top__back', type: 'button', 'aria-label': '뒤로', onclick: onBack, text: '←' }),
    el('h1', { class: 'hn-top__title', text: title }),
    el('span', { class: 'hn-top__right', text: right }),
  ])
}

/** 큰 결과 화면 (판 끝났을 때) */
export function resultCard(opts: {
  emoji: string
  title: string
  lines: string[]
  actions: { label: string; primary?: boolean; onClick: () => void }[]
}): HTMLElement {
  return el('div', { class: 'hn-result' }, [
    el('div', { class: 'hn-result__emoji', text: opts.emoji }),
    el('h2', { class: 'hn-result__title', text: opts.title }),
    ...opts.lines.map((t) => el('p', { class: 'hn-result__line', text: t })),
    el(
      'div',
      { class: 'hn-result__actions' },
      opts.actions.map((a) =>
        el('button', {
          class: `hn-btn ${a.primary ? 'hn-btn--primary' : ''}`,
          type: 'button',
          text: a.label,
          onclick: a.onClick,
        }),
      ),
    ),
  ])
}

/** 짧은 칭찬/오답 알림 */
export function toast(root: HTMLElement, text: string, kind: 'good' | 'bad' = 'good'): void {
  const t = el('div', { class: `hn-toast hn-toast--${kind}`, text })
  root.append(t)
  setTimeout(() => t.remove(), 900)
}

/** 진행 막대 */
export function progressBar(): { node: HTMLElement; set: (ratio: number) => void } {
  const fill = el('div', { class: 'hn-bar__fill' })
  const node = el('div', { class: 'hn-bar' }, [fill])
  return { node, set: (r) => (fill.style.width = `${Math.max(0, Math.min(1, r)) * 100}%`) }
}
