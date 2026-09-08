import { expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ calls: 0, events: [] as string[] }))
vi.mock('../../server/utils/runtime-config', () => ({ getRuntimeConfig: () => ({ appEnv: 'development' }) }))
vi.mock('../../server/utils/smtp-config', () => ({ smtpConfiguration: () => ({ status: 'ready' }) }))
vi.mock('../../server/utils/media-storage', () => ({ getMediaStorage: () => ({}) }))
vi.mock('../../server/utils/database', () => ({
  getDatabase: () => ({ sqlite: {} }), resolveDatabaseFile: () => {},
  closeDatabase: () => { state.events.push('database closed') },
}))
vi.mock('../../server/utils/runner/commission-email', () => ({
  deliverNextCommissionEmail: ({ signal }: { signal: AbortSignal }) => {
    state.calls++
    return new Promise<boolean>((resolve) => {
      signal.addEventListener('abort', () => {
        Promise.resolve().then(() => { state.events.push('delivery settled'); resolve(true) })
      }, { once: true })
    })
  },
}))

it('cancels on the shutdown signal, settles before closing SQLite, and schedules no more work', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)
  const original = process.listeners('SIGTERM')
  const hooks: Array<() => unknown> = []
  const app = { hooks: { hook: (_name: string, callback: () => unknown) => { hooks.push(callback) } } }
  try {
    // Nitro registers filesystem plugins in filename order and invokes close hooks sequentially.
    for (const plugin of [
      await import('../../server/plugins/01.database-config'),
      await import('../../server/plugins/03.commission-email'),
      await import('../../server/plugins/99.database-close'),
    ]) (plugin.default as (app: unknown) => unknown)(app)
    const cancel = process.listeners('SIGTERM').find(listener => !original.includes(listener))!
    expect(cancel).toBeDefined()
    cancel('SIGTERM')
    for (const close of hooks) await close()
    await vi.advanceTimersByTimeAsync(600_000)
    expect(state.calls).toBe(1)
    expect(state.events).toEqual(['delivery settled', 'database closed'])
    expect(process.listeners('SIGTERM')).not.toContain(cancel)
    expect(process.listeners('SIGINT')).not.toContain(cancel)
  }
  finally {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  }
})
