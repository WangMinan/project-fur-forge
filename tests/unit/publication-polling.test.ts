import { effectScope } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { usePublicationPolling } from '../../app/composables/usePublicationPolling'
import type { PublicationOperationDto } from '../../shared/types/contracts'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('tracks in-flight requests and ignores responses after replacement and disposal', async () => {
  vi.useFakeTimers()
  const replies: Array<(value: unknown) => void> = []
  vi.stubGlobal('useAdminApi', () => vi.fn(() => new Promise(resolve => replies.push(resolve))))
  const scope = effectScope()
  const polling = scope.run(() => usePublicationPolling())!
  const handlers = { onTick: vi.fn(), onSettled: vi.fn() }
  const first = polling.poll('item', 'old', handlers)
  expect(polling.isPolling('item')).toBe(true)
  const second = polling.poll('item', 'new', handlers)
  replies[0]!({ data: { status: 'DONE' } })
  await first
  expect(handlers.onSettled).not.toHaveBeenCalled()
  scope.stop()
  replies[1]!({ data: { status: 'GENERATING_PUBLIC' } })
  await second
  expect(handlers.onTick).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
  expect(polling.isPolling('item')).toBe(false)
})

it('invalidates an asynchronous terminal callback before its next business action', async () => {
  let finish!: () => void
  const barrier = new Promise<void>(resolve => { finish = resolve })
  vi.stubGlobal('useAdminApi', () => vi.fn().mockResolvedValue({ data: { status: 'DONE' } }))
  const scope = effectScope()
  const polling = scope.run(() => usePublicationPolling())!
  const enable = vi.fn()
  const onSettled = vi.fn(async (_operation: PublicationOperationDto, isActive: () => boolean) => {
    await barrier
    if (isActive()) enable()
  })
  const running = polling.poll('item', 'operation', { onSettled })
  await vi.waitFor(() => expect(onSettled).toHaveBeenCalledOnce())
  polling.stop('item')
  finish()
  await running
  expect(enable).not.toHaveBeenCalled()
  scope.stop()
})
