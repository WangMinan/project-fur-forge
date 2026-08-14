import { featuredWorkOrderResponseSchema } from '~~/shared/schemas/work'
import type { WorkListItemDto } from '~~/shared/types/contracts'
import { AdminApiError } from './useAdminApi'
import {
  moveFeaturedItem,
  type FeaturedMove,
} from '~/utils/featured-order'

export function useFeaturedWorkOrder() {
  const adminApi = useAdminApi()
  const items = ref<WorkListItemDto[]>([])
  const status = ref<'error' | 'loading' | 'ready'>('loading')
  const pendingId = ref<string | null>(null)
  const error = ref<string | null>(null)

  async function load() {
    status.value = 'loading'
    error.value = null
    try {
      const result = await adminApi('/api/admin/v1/works/featured-order', {
        schema: featuredWorkOrderResponseSchema,
      })
      items.value = result.data
      status.value = 'ready'
    }
    catch (caught) {
      if (caught instanceof AdminApiError && caught.status === 401) {
        return
      }
      status.value = 'error'
    }
  }

  async function move(id: string, direction: FeaturedMove) {
    if (pendingId.value !== null) {
      return
    }
    const from = items.value.findIndex(item => item.id === id)
    if (from < 0) {
      return
    }
    const next = moveFeaturedItem(items.value, id, direction)
    if (next.findIndex(item => item.id === id) === from) {
      return
    }
    pendingId.value = id
    error.value = null
    try {
      const result = await adminApi('/api/admin/v1/works/featured-order', {
        method: 'PUT',
        body: {
          payload: {
            items: next.map(item => ({
              id: item.id,
              expectedVersion: item.version,
            })),
          },
        },
        schema: featuredWorkOrderResponseSchema,
      })
      items.value = result.data
    }
    catch (caught) {
      if (caught instanceof AdminApiError && caught.status === 401) {
        return
      }
      if (
        caught instanceof AdminApiError
        && caught.reason === 'FEATURED_ORDER_CONFLICT'
      ) {
        await load()
        error.value = '精选作品或版本已在其他地方变化，已重新加载，请再操作一次。'
        return
      }
      error.value = '精选顺序未保存，请稍后重试。'
    }
    finally {
      pendingId.value = null
    }
  }

  return {
    error,
    items,
    load,
    move,
    pendingId,
    status,
  }
}
