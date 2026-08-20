import {
  adminHeroCollectionResponseSchema,
} from '~~/shared/schemas/home'
import { publicationOperationResponseSchema } from '~~/shared/schemas/publication'
import type {
  AdminHeroCollectionDto,
  HeroOrientation,
  HeroPlacement,
  PublicationOperationDto,
} from '~~/shared/types/contracts'
import type { MaybeRefOrGetter } from 'vue'
import { AdminApiError } from './useAdminApi'

export interface HeroCollectionItemInput {
  alt: string
  assetId: string
  assetVersion: number
  focalX: number
  focalY: number
  sortOrder: number
}

export interface HeroCollectionFeedback {
  retryOperationId: string | null
  text: string
  tone: 'error' | 'success'
}

export function useAdminHeroCollection(
  placement: MaybeRefOrGetter<HeroPlacement>,
  orientation: MaybeRefOrGetter<HeroOrientation>,
) {
  const adminApi = useAdminApi()
  const polling = usePublicationPolling()
  const collection = ref<AdminHeroCollectionDto | null>(null)
  const pageStatus = ref<'error' | 'loading' | 'ready'>('loading')
  const mutating = ref(false)
  const conflictNotice = ref<string | null>(null)
  const operations = ref<Record<string, PublicationOperationDto>>({})
  const feedback = ref<Record<string, HeroCollectionFeedback>>({})

  const scope = () => ({
    placement: toValue(placement),
    orientation: toValue(orientation),
  })
  const baseUrl = () => {
    const current = scope()
    return `/api/admin/v1/site/hero-collections/${current.placement}/${current.orientation}`
  }
  const label = () => {
    const current = scope()
    return `${current.placement === 'home' ? '首页' : '委托页'}${current.orientation === 'landscape' ? '横版' : '竖版'}大图`
  }

  function setFeedback(id: string, value: HeroCollectionFeedback | null) {
    feedback.value = value
      ? { ...feedback.value, [id]: value }
      : Object.fromEntries(Object.entries(feedback.value).filter(([key]) => key !== id))
  }

  function operationFeedback(operation: PublicationOperationDto): HeroCollectionFeedback {
    if (operation.status === 'DONE') {
      const text = operation.operationType === 'UPSCALE'
        ? '适配完成，可以继续发布。'
        : operation.operationType === 'UNPUBLISH'
          ? '停用完成，公开文件与缓存已撤销。'
          : '发布完成，公开派生图已校验。'
      return { retryOperationId: null, text, tone: 'success' }
    }
    return {
      retryOperationId: operation.status === 'FAILED' ? operation.operationId : null,
      text: '长任务未完成，请重试或刷新后确认状态。',
      tone: 'error',
    }
  }

  async function pollItem(id: string, operationId: string) {
    await polling.poll(id, operationId, {
      onTick: (operation) => {
        operations.value = { ...operations.value, [id]: operation }
      },
      onSettled: async (operation) => {
        operations.value = { ...operations.value, [id]: operation }
        if (operation.operationType === 'UPSCALE' && operation.status === 'DONE') {
          await refresh()
          const error = await startOperation(id, 'enable')
          if (error) {
            setFeedback(id, {
              retryOperationId: null,
              text: error,
              tone: 'error',
            })
          }
          return
        }
        setFeedback(id, operationFeedback(operation))
        await refresh()
      },
    })
  }

  function restoreOperations(snapshot: AdminHeroCollectionDto) {
    for (const item of snapshot.items) {
      const operation = item.publicationOperation
        ?? (item.enabled ? null : item.upscaleOperation)
      if (!operation) {
        continue
      }
      operations.value = { ...operations.value, [item.id]: operation }
      if (isPublicationInProgress(operation) && !polling.isPolling(item.id)) {
        void pollItem(item.id, operation.operationId)
      }
      else if (!isPublicationInProgress(operation)) {
        setFeedback(item.id, operationFeedback(operation))
      }
    }
  }

  async function refresh(restore = true) {
    try {
      const result = await adminApi(baseUrl(), {
        schema: adminHeroCollectionResponseSchema,
      })
      collection.value = result.data
      if (restore) {
        restoreOperations(result.data)
      }
      return result.data
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      return null
    }
  }

  async function load() {
    pageStatus.value = 'loading'
    conflictNotice.value = null
    const result = await refresh()
    pageStatus.value = result ? 'ready' : 'error'
  }

  function conflictText(reason: string | null | undefined) {
    if (reason === 'HERO_LAST_ENABLED_ITEM') {
      return '首页大图集合至少保留一个已启用项。'
    }
    if (reason === 'HERO_SLOT_LIMIT' && toValue(placement) === 'commission') {
      return '委托页每个方向只启用一张大图；请先停用当前大图，再启用新图。'
    }
    if (reason === 'HERO_FOCAL_SHARED_ASSET_CONFLICT') {
      return '这张原图正在多个大图项中复用，不能静默覆盖其它位置的焦点；请上传独立素材。'
    }
    return '版本或状态已变化，请确认后重试。'
  }

  async function onConflict() {
    conflictNotice.value = `${label()}已在其他地方变化，已重新加载。`
    await refresh()
  }

  function body(payload: unknown) {
    return { expectedVersion: collection.value?.version ?? 0, payload }
  }

  async function mutation(
    request: () => Promise<AdminHeroCollectionDto>,
    errorText: string,
  ): Promise<string | null> {
    if (!collection.value || mutating.value) {
      return null
    }
    mutating.value = true
    try {
      collection.value = await request()
      conflictNotice.value = null
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        await onConflict()
        return conflictText(error.reason)
      }
      return errorText
    }
    finally {
      mutating.value = false
    }
  }

  async function createItem(input: HeroCollectionItemInput) {
    return await mutation(async () => {
      const result = await adminApi(`${baseUrl()}/items`, {
        method: 'POST',
        body: body(input),
        schema: adminHeroCollectionResponseSchema,
      })
      return result.data
    }, '新增大图项失败，请稍后重试。')
  }

  async function updateItem(id: string, input: HeroCollectionItemInput) {
    return await mutation(async () => {
      const result = await adminApi(`${baseUrl()}/items/${id}`, {
        method: 'PUT',
        body: body(input),
        schema: adminHeroCollectionResponseSchema,
      })
      return result.data
    }, '保存大图项失败，请稍后重试。')
  }

  async function deleteItem(id: string) {
    return await mutation(async () => {
      const result = await adminApi(`${baseUrl()}/items/${id}`, {
        method: 'DELETE',
        body: body({}),
        schema: adminHeroCollectionResponseSchema,
      })
      return result.data
    }, '删除大图项失败，请稍后重试。')
  }

  async function reorder(itemIds: string[]) {
    return await mutation(async () => {
      const result = await adminApi(`${baseUrl()}/items/order`, {
        method: 'PUT',
        body: body({ itemIds }),
        schema: adminHeroCollectionResponseSchema,
      })
      return result.data
    }, '调整顺序失败，请稍后重试。')
  }

  async function startOperation(
    id: string,
    action: 'disable' | 'enable' | 'upscale',
  ): Promise<string | null> {
    if (!collection.value || mutating.value) {
      return null
    }
    mutating.value = true
    setFeedback(id, null)
    try {
      const result = await adminApi(`${baseUrl()}/items/${id}/${action}`, {
        method: 'POST',
        body: body({}),
        schema: publicationOperationResponseSchema,
      })
      operations.value = { ...operations.value, [id]: result.data }
      void pollItem(id, result.data.operationId)
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        await onConflict()
        return error.reason === 'HERO_LAST_ENABLED_ITEM' || error.reason === 'HERO_SLOT_LIMIT'
          ? conflictText(error.reason)
          : '操作未提交：版本、顺位或大图状态已变化。'
      }
      return '无法启动长任务，请稍后重试。'
    }
    finally {
      mutating.value = false
    }
  }

  async function retryOperation(id: string) {
    const operation = operations.value[id]
    if (!operation || mutating.value) {
      return null
    }
    mutating.value = true
    try {
      const result = await adminApi(
        `/api/admin/v1/site/hero-collections/operations/${operation.operationId}/retry`,
        {
          method: 'POST',
          body: { expectedVersion: operation.version, payload: {} },
          schema: publicationOperationResponseSchema,
        },
      )
      operations.value = { ...operations.value, [id]: result.data }
      void pollItem(id, result.data.operationId)
      return null
    }
    catch {
      return '重试失败，请刷新后再试。'
    }
    finally {
      mutating.value = false
    }
  }

  watch([() => toValue(placement), () => toValue(orientation)], () => {
    polling.stop()
    collection.value = null
    operations.value = {}
    feedback.value = {}
    void load()
  })

  return {
    collection,
    conflictNotice,
    createItem,
    deleteItem,
    feedback,
    load,
    mutating,
    operations,
    pageStatus,
    refresh,
    reorder,
    retryOperation,
    startOperation,
    updateItem,
  }
}
