import type { Ref } from 'vue'

interface FullscreenNavigationOptions {
  open: () => boolean
  panel: Readonly<Ref<HTMLElement | null>>
  triggerId: string
  close: () => void
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * 公开端与管理端全屏导航共用的 DOM 行为。
 *
 * 组件只负责菜单内容和样式；这里统一处理滚动锁定、背景 inert、
 * Escape、焦点循环和关闭后的触发按钮焦点归还。
 */
export function useFullscreenNavigation(options: FullscreenNavigationOptions) {
  const inertedElements = new Set<HTMLElement>()
  let previousOverflow = ''
  let active = false

  function focusableElements() {
    return Array.from(
      options.panel.value?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    ).filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      options.close()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const focusable = focusableElements()
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) {
      return
    }

    if (event.shiftKey && (document.activeElement === first || !options.panel.value?.contains(document.activeElement))) {
      event.preventDefault()
      last.focus()
    }
    else if (!event.shiftKey && (document.activeElement === last || !options.panel.value?.contains(document.activeElement))) {
      event.preventDefault()
      first.focus()
    }
  }

  function setBackgroundInert(inert: boolean) {
    if (!import.meta.client) {
      return
    }

    if (!inert) {
      for (const element of inertedElements) {
        element.inert = false
      }
      inertedElements.clear()
      return
    }

    const candidates = new Set<Element | null>([
      ...Array.from(options.panel.value?.parentElement?.children ?? []),
      document.querySelector('main'),
      document.querySelector('footer'),
    ])

    for (const candidate of candidates) {
      if (
        candidate instanceof HTMLElement
        && candidate !== options.panel.value
        && !candidate.inert
      ) {
        candidate.inert = true
        inertedElements.add(candidate)
      }
    }
  }

  function deactivate(returnFocus: boolean) {
    if (!active || !import.meta.client) {
      return
    }

    document.documentElement.style.overflow = previousOverflow
    setBackgroundInert(false)
    document.removeEventListener('keydown', onKeydown)
    active = false

    if (returnFocus) {
      document.getElementById(options.triggerId)?.focus()
    }
  }

  watch(options.open, async (isOpen) => {
    if (!import.meta.client) {
      return
    }

    if (isOpen) {
      active = true
      previousOverflow = document.documentElement.style.overflow
      document.documentElement.style.overflow = 'hidden'
      await nextTick()
      setBackgroundInert(true)
      focusableElements()[0]?.focus()
      document.addEventListener('keydown', onKeydown)
    }
    else {
      deactivate(true)
    }
  })

  onBeforeUnmount(() => deactivate(false))
}
