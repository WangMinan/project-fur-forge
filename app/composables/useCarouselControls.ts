import { onScopeDispose, shallowRef } from 'vue'

export function useCarouselControls(paused: () => boolean) {
  const controlsRevealed = shallowRef(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function stopTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function revealControls(timeout = 2_400) {
    controlsRevealed.value = true
    stopTimer()
    if (!paused()) timer = setTimeout(() => {
      controlsRevealed.value = false
      timer = null
    }, timeout)
  }

  function revealForFinePointer(event: MouseEvent) {
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width
    const y = (event.clientY - bounds.top) / bounds.height
    if (!controlsRevealed.value && (x <= 0.16 || x >= 0.84 || y >= 0.72)) revealControls()
  }

  function onPointerLeave() {
    if (!paused()) {
      stopTimer()
      controlsRevealed.value = false
    }
  }

  function onHeroClick(event: MouseEvent) {
    if ((event.target as HTMLElement | null)?.closest('button, a')) return
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) revealControls(4_000)
  }

  onScopeDispose(stopTimer)
  return { controlsRevealed, revealControls, revealForFinePointer, onPointerLeave, onHeroClick }
}
