import type { Ref } from 'vue'

const DESKTOP_QUERY = '(min-width: 1024px)'
const SCENE_SELECTOR = '[data-home-scroll-scene]'

export function useHomeSectionNavigation(
  root: Readonly<Ref<HTMLElement | null>>,
) {
  let locked = false
  let unlockTimer: ReturnType<typeof setTimeout> | null = null

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
    if (locked) {
      return
    }

    const current = closestSceneIndex(items)
    const next = Math.max(
      0,
      Math.min(items.length - 1, current + (event.deltaY > 0 ? 1 : -1)),
    )
    if (next === current) {
      return
    }

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    locked = true
    items[next]!.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    })
    unlockTimer = setTimeout(() => {
      locked = false
      unlockTimer = null
    }, reduced ? 0 : 620)
  }

  onMounted(() => window.addEventListener('wheel', onWheel, { passive: false }))
  onBeforeUnmount(() => {
    window.removeEventListener('wheel', onWheel)
    if (unlockTimer !== null) {
      clearTimeout(unlockTimer)
    }
  })
}
