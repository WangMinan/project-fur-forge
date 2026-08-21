import type { Ref } from 'vue'

const DESKTOP_QUERY = '(min-width: 1024px)'
const SCENE_SELECTOR = '[data-home-scroll-scene]'

export function useHomeSectionNavigation(
  root: Readonly<Ref<HTMLElement | null>>,
) {
  let pending: { direction: -1 | 1, from: number, to: number } | null = null
  let unlockTimer: ReturnType<typeof setTimeout> | null = null

  function unlockAfterMotion() {
    if (unlockTimer !== null) {
      clearTimeout(unlockTimer)
    }
    unlockTimer = setTimeout(() => {
      pending = null
      unlockTimer = null
    }, 620)
  }

  function scenes() {
    const homeScenes = Array.from(
      root.value?.querySelectorAll<HTMLElement>(SCENE_SELECTOR) ?? [],
    )
    const footer = document.querySelector<HTMLElement>('.public-footer')
    return footer ? [...homeScenes, footer] : homeScenes
  }

  function closestSceneIndex(items: readonly HTMLElement[]) {
    return items.reduce((closest, item, index) => (
      Math.abs(item.getBoundingClientRect().top)
        < Math.abs(items[closest]!.getBoundingClientRect().top)
        ? index
        : closest
    ), 0)
  }

  function onWheel(event: WheelEvent) {
    if (
      !matchMedia(DESKTOP_QUERY).matches
      || event.deltaY === 0
      || event.ctrlKey
      || event.metaKey
      || event.altKey
      || event.shiftKey
      || (event.target as HTMLElement | null)?.closest(
        'input, textarea, select, [contenteditable="true"], [role="dialog"]',
      )
    ) {
      return
    }

    const items = scenes()
    if (items.length === 0) {
      return
    }
    event.preventDefault()
    const direction = event.deltaY > 0 ? 1 : -1
    if (pending) {
      if (pending.direction === direction) {
        return
      }
      pending = {
        direction,
        from: pending.to,
        to: pending.from,
      }
      items[pending.to]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      unlockAfterMotion()
      return
    }

    const current = closestSceneIndex(items)
    const next = Math.max(
      0,
      Math.min(items.length - 1, current + direction),
    )
    if (next === current) {
      return
    }

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    items[next]!.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    })
    if (!reduced) {
      pending = { direction, from: current, to: next }
      unlockAfterMotion()
    }
  }

  onMounted(() => window.addEventListener('wheel', onWheel, { passive: false }))
  onBeforeUnmount(() => {
    window.removeEventListener('wheel', onWheel)
    if (unlockTimer !== null) {
      clearTimeout(unlockTimer)
    }
  })
}
