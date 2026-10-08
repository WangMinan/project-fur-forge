import { publicationOperationResponseSchema } from '~~/shared/schemas/publication'
import type { PublicationOperationDto } from '~~/shared/types/contracts'
import { AdminApiError } from './useAdminApi'
import { onScopeDispose } from 'vue'

/**
 * 发布长任务的共享轮询状态。
 * 只负责定时器生命周期与拉取操作状态；不知道 Hero、不知道发布规则。
 */
export const PUBLICATION_IN_PROGRESS_STATUSES = new Set([
  'PREPARING_SOURCE',
  'GENERATING_PUBLIC',
  'VERIFYING_PUBLIC',
  'COMMITTING',
  'CLEANING_PUBLIC',
])

const POLL_INTERVAL_MS = 1_000

export function isPublicationInProgress(operation: PublicationOperationDto) {
  return PUBLICATION_IN_PROGRESS_STATUSES.has(operation.status)
}

export function usePublicationPolling() {
  const adminApi = useAdminApi()
  const active = new Map<string, { timer?: ReturnType<typeof setTimeout> }>()
  let disposed = false

  function stop(key?: string) {
    for (const [id, run] of active) {
      if (key !== undefined && key !== id) continue
      clearTimeout(run.timer)
      active.delete(id)
    }
  }

  function isPolling(key: string) {
    return active.has(key)
  }

  /**
   * 轮询到终态为止。
   * `onTick` 每轮拿到最新操作；`onSettled` 只在终态调用一次。
   * 轮询失败不抛出、不阻塞：保留已有状态，下一轮继续。
   */
  async function poll(
    key: string,
    operationId: string,
    handlers: {
      onSettled: (operation: PublicationOperationDto, isActive: () => boolean) => Promise<void> | void
      onTick?: (operation: PublicationOperationDto, isActive: () => boolean) => Promise<void> | void
    },
  ) {
    stop(key)
    if (disposed) return
    const run: { timer?: ReturnType<typeof setTimeout> } = {}
    active.set(key, run)
    const isActive = () => active.get(key) === run
    const tick = async () => {
      if (!isActive()) return
      let current: PublicationOperationDto | null = null
      try {
        const result = await adminApi(
          `/api/admin/v1/publication-operations/${operationId}`,
          { schema: publicationOperationResponseSchema },
        )
        if (!isActive()) return
        current = result.data
        await handlers.onTick?.(current, isActive)
      }
      catch (error) {
        if (error instanceof AdminApiError && error.status === 401) {
          if (isActive()) stop(key)
          return
        }
      }
      if (!isActive()) return
      if (current && !isPublicationInProgress(current)) {
        try { await handlers.onSettled(current, isActive) }
        finally { if (isActive()) stop(key) }
        return
      }
      run.timer = setTimeout(() => void tick(), POLL_INTERVAL_MS)
    }
    await tick()
  }

  onScopeDispose(() => { disposed = true; stop() })

  return { isPolling, poll, stop }
}
