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

/** 상단 바 — 뒤로가기 + 제목 + 오른쪽(글자 또는 버튼) */
export function topBar(title: string, onBack: () => void, right: string | HTMLElement = ''): HTMLElement {
  return el('header', { class: 'hn-top' }, [
    el('button', { class: 'hn-top__back', type: 'button', 'aria-label': '뒤로', onclick: onBack, text: '←' }),
    el('h1', { class: 'hn-top__title', text: title }),
    typeof right === 'string' ? el('span', { class: 'hn-top__right', text: right }) : right,
  ])
}

/** 상단 바 오른쪽에 놓는 작은 버튼 */
export function topAction(label: string, onClick: () => void): HTMLElement {
  return el('button', { class: 'hn-top__action', type: 'button', text: label, onclick: onClick })
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

/**
 * 상품(한자 카드)을 짜잔 하고 보여 주는 모달.
 *
 * 결과 화면에 슬쩍 끼워 넣으면 아이가 "카드를 받았다"는 걸 못 알아챈다.
 * 화면을 덮고 → 크게 나타났다가 → 카드 크기로 줄어들고 → 확인을 눌러야 넘어가게 한다.
 */
export function prizeModal(opts: {
  /** 한 글자면 카드, 여러 글자면 낱말 */
  char: string
  title: string
  lines: string[]
  onConfirm: () => void
  /** 외침 — 기본 '짜잔!' */
  tada?: string
}): HTMLElement {
  const len = [...opts.char].length
  const card = el('div', { class: `hn-modal__card ${len > 1 ? 'hn-modal__card--wide' : ''}` }, [
    el('span', { class: `hn-modal__char hn-modal__char--n${Math.min(len, 4)}`, text: opts.char }),
  ])

  const box = el('div', { class: 'hn-modal__box' }, [
    el('div', { class: 'hn-modal__tada', text: opts.tada ?? '짜잔!' }),
    card,
    el('h2', { class: 'hn-modal__title', text: opts.title }),
    ...opts.lines.map((t) => el('p', { class: 'hn-modal__line', text: t })),
    el('button', { class: 'hn-btn hn-btn--primary hn-modal__ok', type: 'button', text: '확인' }),
  ])

  const overlay = el('div', { class: 'hn-modal' }, [box])

  function close() {
    overlay.classList.add('hn-modal--out')
    setTimeout(() => {
      overlay.remove()
      opts.onConfirm()
    }, 180)
  }

  box.querySelector<HTMLButtonElement>('.hn-modal__ok')!.addEventListener('click', close)
  // 바깥을 눌러도 닫히게 하되, 카드 위를 잘못 눌러 닫히지는 않게
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  return overlay
}

/**
 * 카드 여러 장을 한꺼번에 받을 때. 한 장이면 prizeModal이 더 낫다.
 * 장수가 많아도 화면을 넘지 않게 격자로 깔고, 스스로 스크롤한다.
 */
export function cardsModal(opts: {
  chars: string[]
  title: string
  lines: string[]
  onConfirm: () => void
  tada?: string
}): HTMLElement {
  const grid = el(
    'div',
    { class: 'hn-modal__grid' },
    opts.chars.map((c, i) => {
      const card = el('span', { class: 'hn-modal__mini', text: c })
      // 한 장씩 차례로 튀어나오게 (많으면 간격을 좁혀 다 보이기 전에 지루하지 않도록)
      card.style.animationDelay = `${Math.min(i * 60, 900)}ms`
      return card
    }),
  )

  const box = el('div', { class: 'hn-modal__box hn-modal__box--wide' }, [
    el('div', { class: 'hn-modal__tada', text: opts.tada ?? '짜잔!' }),
    grid,
    el('h2', { class: 'hn-modal__title', text: opts.title }),
    ...opts.lines.map((t) => el('p', { class: 'hn-modal__line', text: t })),
    el('button', { class: 'hn-btn hn-btn--primary hn-modal__ok', type: 'button', text: '확인' }),
  ])

  const overlay = el('div', { class: 'hn-modal' }, [box])
  function close() {
    overlay.classList.add('hn-modal--out')
    setTimeout(() => {
      overlay.remove()
      opts.onConfirm()
    }, 180)
  }
  box.querySelector<HTMLButtonElement>('.hn-modal__ok')!.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  return overlay
}

/**
 * 결과를 화면 위에 덮어서 보여 준다.
 *
 * 화면을 통째로 갈아치우면 하던 놀이가 사라져 흐름이 끊긴다. 뒤에 판을 그대로 두고
 * 그 위에 띄운다. **이어서 할 것 하나만 크게**, 나머지는 아래에 작게 — 아이가 고민 없이
 * 큰 버튼만 누르면 계속 놀 수 있게.
 */
export function resultModal(opts: {
  emoji: string
  title: string
  lines: string[]
  primary: { label: string; onClick: () => void }
  secondary?: { label: string; onClick: () => void }[]
}): HTMLElement {
  const overlay = el('div', { class: 'hn-modal' })

  function close(then: () => void) {
    overlay.classList.add('hn-modal--out')
    setTimeout(() => {
      overlay.remove()
      then()
    }, 180)
  }

  const box = el('div', { class: 'hn-modal__box hn-result-modal' }, [
    el('div', { class: 'hn-result__emoji', text: opts.emoji }),
    el('h2', { class: 'hn-result__title', text: opts.title }),
    ...opts.lines.map((t) => el('p', { class: 'hn-result__line', text: t })),
    el('button', {
      class: 'hn-btn hn-btn--primary hn-result-modal__go',
      type: 'button',
      text: opts.primary.label,
      onclick: () => close(opts.primary.onClick),
    }),
    ...(opts.secondary?.length
      ? [
          el(
            'div',
            { class: 'hn-result-modal__more' },
            opts.secondary.map((a) =>
              el('button', {
                class: 'hn-result-modal__small',
                type: 'button',
                text: a.label,
                onclick: () => close(a.onClick),
              }),
            ),
          ),
        ]
      : []),
  ])

  overlay.append(box)
  return overlay
}

/** 획순처럼 나눠 받는 데이터를 기다리는 동안 */
export function loadingBox(text = '불러오는 중…'): HTMLElement {
  return el('div', { class: 'hn-loading' }, [el('span', { class: 'hn-loading__dot' }), el('span', { text })])
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
