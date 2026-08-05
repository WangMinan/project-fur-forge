import { publicationOperationResponseSchema } from '~~/shared/schemas/publication'
import type { PublicationOperationDto } from '~~/shared/types/contracts'
import { AdminApiError } from './useAdminApi'

/**
 * T34-F4：长任务轮询从 useAdminHome 抽出。
 * 只负责定时器生命周期与拉取操作状态；不知道 Hero、不知道发布规则。
 */
export const PUBLICATION_IN_PROGRESS_STATUSES = new Set([
  'PREPARING_SOURCE',
  'GENERATING_PUBLIC',
  'APPLYING_WATERMARK',
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
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function stop(key?: string) {
    if (key) {
      const timer = timers.get(key)
      if (timer) {
        clearTimeout(timer)
        timers.delete(key)
      }
      return
    }
    timers.forEach(clearTimeout)
    timers.clear()
  }

  function isPolling(key: string) {
    return timers.has(key)
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
      onSettled: (operation: PublicationOperationDto) => Promise<void> | void
      onTick?: (operation: PublicationOperationDto) => Promise<void> | void
    },
  ) {
    stop(key)
    const tick = async () => {
      let current: PublicationOperationDto | null = null
      try {
        const result = await adminApi(
          `/api/admin/v1/publication-operations/${operationId}`,
          { schema: publicationOperationResponseSchema },
        )
        current = result.data
        await handlers.onTick?.(current)
      }
      catch (error) {
        if (error instanceof AdminApiError && error.status === 401) {
          return
        }
      }
      if (current && !isPublicationInProgress(current)) {
        await handlers.onSettled(current)
        return
      }
      timers.set(key, setTimeout(() => {
        timers.delete(key)
        void tick()
      }, POLL_INTERVAL_MS))
    }
    await tick()
  }

  onScopeDispose(() => stop())

  return { isPolling, poll, stop }
}
