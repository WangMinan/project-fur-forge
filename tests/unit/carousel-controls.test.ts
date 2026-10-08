import { effectScope } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useCarouselControls } from '../../app/composables/useCarouselControls'

afterEach(() => vi.useRealTimers())
it('shares temporary visibility, paused visibility and disposal cleanup', async () => {
  vi.useFakeTimers()
  let paused = false
  const scope = effectScope()
  const controls = scope.run(() => useCarouselControls(() => paused))!
  controls.revealControls()
  expect(controls.controlsRevealed.value).toBe(true)
  await vi.advanceTimersByTimeAsync(2400)
  expect(controls.controlsRevealed.value).toBe(false)
  paused = true
  controls.revealControls()
  controls.onPointerLeave()
  await vi.advanceTimersByTimeAsync(4000)
  expect(controls.controlsRevealed.value).toBe(true)
  paused = false
  controls.revealControls(4000)
  scope.stop()
  expect(vi.getTimerCount()).toBe(0)
})
