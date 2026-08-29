import {
  computed,
  onBeforeUnmount,
  onMounted,
  readonly,
  shallowRef,
  watch,
} from 'vue'

const AUTOPLAY_INTERVAL_MS = 4_000

export function useCarouselPlayback(options: {
  advance: () => void
  enabled: () => boolean
  intervalMs?: number
}) {
  const reduceMotion = shallowRef(false)
  const pageHidden = shallowRef(false)
  const running = computed(() => (
    options.enabled() && !reduceMotion.value && !pageHidden.value
  ))
  let timer: ReturnType<typeof setInterval> | null = null
  let motionQuery: MediaQueryList | null = null

  function stop() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  function restart() {
    stop()
    if (running.value) {
      timer = setInterval(
        options.advance,
        options.intervalMs ?? AUTOPLAY_INTERVAL_MS,
      )
    }
  }

  function onMotionChange(event: MediaQueryListEvent) {
    reduceMotion.value = event.matches
  }

  function onVisibilityChange() {
    pageHidden.value = document.hidden
  }

  watch(running, restart)

  onMounted(() => {
    motionQuery = matchMedia('(prefers-reduced-motion: reduce)')
    reduceMotion.value = motionQuery.matches
    motionQuery.addEventListener('change', onMotionChange)
    pageHidden.value = document.hidden
    document.addEventListener('visibilitychange', onVisibilityChange)
    restart()
  })

  onBeforeUnmount(() => {
    stop()
    motionQuery?.removeEventListener('change', onMotionChange)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return {
    reduceMotion: readonly(reduceMotion),
    restart,
  }
}
