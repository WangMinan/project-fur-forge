import type { Ref } from 'vue'

interface MotionTokens {
  content: number
  easing: string
  media: number
  state: number
}

interface MotionEntranceContext {
  reduced: boolean
  tokens: MotionTokens
}

function cssTime(value: string) {
  const trimmed = value.trim()
  if (trimmed.endsWith('ms')) {
    return Number.parseFloat(trimmed)
  }
  if (trimmed.endsWith('s')) {
    return Number.parseFloat(trimmed) * 1000
  }
  return 0
}

function motionTokens(): MotionTokens {
  const style = getComputedStyle(document.documentElement)
  return {
    content: cssTime(style.getPropertyValue('--motion-duration-content')),
    easing: style.getPropertyValue('--motion-ease-standard').trim(),
    media: cssTime(style.getPropertyValue('--motion-duration-media')),
    state: cssTime(style.getPropertyValue('--motion-duration-state')),
  }
}

export function useMotionEntrance(
  root: Readonly<Ref<HTMLElement | null>>,
  play: (context: MotionEntranceContext) => Animation[],
) {
  let observer: IntersectionObserver | null = null
  let animations: Animation[] = []

  onMounted(() => {
    const element = root.value
    if (!element || !('animate' in element) || !('IntersectionObserver' in window)) {
      return
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) {
        return
      }
      observer?.disconnect()
      observer = null
      animations = play({ reduced, tokens: motionTokens() })
    }, {
      threshold: 0.16,
      rootMargin: '0px 0px -8% 0px',
    })
    observer.observe(element)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    for (const animation of animations) {
      animation.cancel()
    }
  })
}
