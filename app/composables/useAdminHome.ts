import { adminHomeResponseSchema } from '~~/shared/schemas/home'
import { publicationOperationResponseSchema } from '~~/shared/schemas/publication'
import type {
  AdminHomeDto,
  HeroPlacement,
  PublicationOperationDto,
} from '~~/shared/types/contracts'
import type { MaybeRefOrGetter } from 'vue'
import {
  PUBLICATION_FAILURE_STAGE_LABELS,
  publicationFailureLabel,
} from '~/utils/media-labels'
import { AdminApiError } from './useAdminApi'

// T20/T26-F1 大图管理状态：当前 placement 快照为唯一状态基线，所有写操作带 expectedVersion；
// 409 一律重新 GET，不自行递增或猜测版本。启用为异步发布操作：先返回操作
// 记录，UI 轮询至 DONE/FAILED 后重新加载 home（版本随提交递增）。
export interface HeroSlideInput {
  alt: string
  sortOrder: number
  landscapeAssetId: string
  portraitAssetId: string
  linkedWorkId: string | null
}

/**
 * T34-F3：首屏设置只管首页口号与轮播行为。
 * 官方邮箱、QQ、抖音号和防诈骗提醒统一由“文案配置”的官方渠道分区编辑。
 */
export interface HomeSettingsInput {
  tagline: string
  autoRotate: boolean
  autoRotateIntervalMs: number
}

export interface SlideFeedback {
  retryOperationId: string | null
  text: string
  tone: 'error' | 'success'
}

const IN_PROGRESS_STATUSES = new Set([
  'PREPARING_SOURCE',
  'GENERATING_PUBLIC',
  'APPLYING_WATERMARK',
  'VERIFYING_PUBLIC',
  'COMMITTING',
  'CLEANING_PUBLIC',
])


export function useAdminHome(
  placement: MaybeRefOrGetter<HeroPlacement> = 'home',
) {
  const adminApi = useAdminApi()

  const currentPlacement = () => toValue(placement)
  const placementLabel = () => currentPlacement() === 'home'
    ? '首页'
    : '委托页'
  const conflictSubject = () => currentPlacement() === 'home'
    ? '首页数据'
    : '委托页大图'
  const heroUrl = (path = '') => (
    `/api/admin/v1/site/home${path}${currentPlacement() === 'commission' ? '?placement=commission' : ''}`
  )

  const home = ref<AdminHomeDto | null>(null)
  const pageStatus = ref<'error' | 'loading' | 'ready'>('loading')
  const mutating = ref(false)
  const conflictNotice = ref<string | null>(null)
  // 每个轮播项的最近一次启用操作与反馈，按 slideId 归档。
  const operations = ref<Record<string, PublicationOperationDto>>({})
  const feedback = ref<Record<string, SlideFeedback>>({})

  // T34-F4：定时器生命周期与操作状态拉取交给 usePublicationPolling。
  const polling = usePublicationPolling()
  const stopPolling = polling.stop

  function setFeedback(slideId: string, value: SlideFeedback | null) {
    feedback.value = value
      ? { ...feedback.value, [slideId]: value }
      : Object.fromEntries(
          Object.entries(feedback.value).filter(([key]) => key !== slideId),
        )
  }

  function restorePublicationOperations(snapshot: AdminHomeDto) {
    for (const slide of snapshot.slides) {
      const operation = slide.publicationOperation ?? slide.upscaleOperation
      if (!operation) {
        continue
      }
      if (slide.enabled && operation.operationType === 'UPSCALE') {
        continue
      }
      operations.value = { ...operations.value, [slide.id]: operation }
      if (IN_PROGRESS_STATUSES.has(operation.status)) {
        if (!polling.isPolling(slide.id)) {
          void pollOperation(slide.id, operation.operationId)
        }
      }
      else {
        setFeedback(slide.id, operationFeedback(operation))
      }
    }
  }

  async function refreshHome(restoreOperations = true) {
    try {
      const result = await adminApi(heroUrl(), {
        schema: adminHomeResponseSchema,
      })
      home.value = result.data
      if (restoreOperations) {
        restorePublicationOperations(result.data)
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
    try {
      const result = await adminApi(heroUrl(), {
        schema: adminHomeResponseSchema,
      })
      home.value = result.data
      restorePublicationOperations(result.data)
      pageStatus.value = 'ready'
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return
      }
      pageStatus.value = 'error'
    }
  }

  async function onConflict(message: string) {
    conflictNotice.value = message
    await refreshHome()
  }

  // T34-F4：预览状态与请求交给 useHeroPreview。
  const preview = useHeroPreview({
    conflictSubject,
    heroUrl,
    onConflict,
    resetConflictNotice: () => {
      conflictNotice.value = null
    },
    versionedBody: payload => versionedBody(payload),
  })
  const { loadPreview, previewPending, previews } = preview

  function operationFeedback(operation: PublicationOperationDto): SlideFeedback {
    if (operation.status === 'DONE') {
      if (operation.operationType === 'UPSCALE') {
        return {
          retryOperationId: null,
          text: '放大适配完成，私有原图已保留；可以继续启用。',
          tone: 'success',
        }
      }
      if (operation.operationType === 'UNPUBLISH') {
        return {
          retryOperationId: null,
          text: '停用完成：页面已隐藏，公开文件与 ESA 缓存已撤销。',
          tone: 'success',
        }
      }
      return {
        retryOperationId: null,
        text: `启用成功：公开图片已生成并通过校验，${placementLabel()}大图已更新。`,
        tone: 'success',
      }
    }
    const stage = operation.failureStage
      ? PUBLICATION_FAILURE_STAGE_LABELS[operation.failureStage]
      : null
    if (operation.operationType === 'UNPUBLISH' && operation.edgePurgeStatus === 'FAILED') {
      return {
        retryOperationId: operation.operationId,
        text: `页面已隐藏，但 ESA 缓存撤销未完成：${publicationFailureLabel(operation.failureCode)}${stage ? `（失败于${stage}环节）` : ''}`,
        tone: 'error',
      }
    }
    return {
      retryOperationId: operation.status === 'FAILED' ? operation.operationId : null,
      text: `${publicationFailureLabel(operation.failureCode)}${stage ? `（失败于${stage}环节）` : ''}`,
      tone: 'error',
    }
  }

  async function pollOperation(slideId: string, operationId: string) {
    await polling.poll(slideId, operationId, {
      onTick: async (current) => {
        operations.value = { ...operations.value, [slideId]: current }
        await refreshHome(false)
      },
      onSettled: async (current) => {
        // 放大完成后自动接续启用发布，保持原有交接语义。
        if (current.operationType === 'UPSCALE' && current.status === 'DONE') {
          await refreshHome()
          const error = await startPublication(slideId)
          if (error) {
            setFeedback(slideId, {
              retryOperationId: null,
              text: error,
              tone: 'error',
            })
          }
          return
        }
        setFeedback(slideId, operationFeedback(current))
        // 提交会递增 home 版本：无论成败都重新加载，保证版本基线新鲜。
        await refreshHome()
      },
    })
  }

  // 除启用外的写操作共用通道：成功则替换 home 快照，409 走冲突重载。
  // 返回 null 表示成功；否则为可展示的中文错误。
  async function runHomeMutation(
    request: () => Promise<AdminHomeDto>,
    errorText: string,
  ): Promise<string | null> {
    if (!home.value || mutating.value) {
      return null
    }
    mutating.value = true
    try {
      home.value = await request()
      conflictNotice.value = null
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        // T34-F4：只匹配稳定业务 reason，不再匹配服务端英文 message。
        if (error.reason === 'HERO_LAST_ENABLED_SLIDE') {
          conflictNotice.value = null
          await refreshHome()
          return '停用未提交：首页至少需要保留一个启用的轮播项。请先启用另一个轮播项，再停用当前项。'
        }
        await onConflict(`${conflictSubject()}已在其他地方变化，已重新加载，请确认后重试。`)
        return '未提交：版本已变化，请确认当前内容后重试。'
      }
      if (error instanceof AdminApiError && error.status === 400) {
        return '参数未通过服务端校验，请检查填写内容。'
      }
      return errorText
    }
    finally {
      mutating.value = false
    }
  }

  function versionedBody(payload: unknown) {
    return { expectedVersion: home.value?.version ?? 0, payload }
  }

  async function saveSettings(input: HomeSettingsInput) {
    return await runHomeMutation(async () => {
      const result = await adminApi('/api/admin/v1/site/home/settings', {
        method: 'PUT',
        body: versionedBody(input),
        schema: adminHomeResponseSchema,
      })
      return result.data
    }, '保存设置失败，请稍后重试。')
  }

  async function createSlide(input: HeroSlideInput) {
    return await runHomeMutation(async () => {
      const result = await adminApi(heroUrl('/slides'), {
        method: 'POST',
        body: versionedBody(input),
        schema: adminHomeResponseSchema,
      })
      return result.data
    }, `新增${placementLabel()}大图失败，请稍后重试。`)
  }

  async function updateSlide(id: string, input: HeroSlideInput) {
    return await runHomeMutation(async () => {
      const result = await adminApi(heroUrl(`/slides/${id}`), {
        method: 'PUT',
        body: versionedBody(input),
        schema: adminHomeResponseSchema,
      })
      return result.data
    }, `保存${placementLabel()}大图失败，请稍后重试。`)
  }

  async function deleteSlide(id: string) {
    return await runHomeMutation(async () => {
      const result = await adminApi(heroUrl(`/slides/${id}`), {
        method: 'DELETE',
        body: versionedBody({}),
        schema: adminHomeResponseSchema,
      })
      return result.data
    }, `删除${placementLabel()}大图失败，请稍后重试。`)
  }

  async function reorderEnabled(slideIds: string[]) {
    return await runHomeMutation(async () => {
      const result = await adminApi(heroUrl('/slides/order'), {
        method: 'PUT',
        body: versionedBody({ slideIds }),
        schema: adminHomeResponseSchema,
      })
      return result.data
    }, '调整顺序失败，请稍后重试。')
  }

  async function disableSlide(id: string) {
    if (!home.value || mutating.value) {
      return null
    }
    mutating.value = true
    setFeedback(id, null)
    try {
      const result = await adminApi(
        heroUrl(`/slides/${id}/disable`),
        {
          method: 'POST',
          body: versionedBody({}),
          schema: publicationOperationResponseSchema,
        },
      )
      operations.value = { ...operations.value, [id]: result.data }
      conflictNotice.value = null
      void pollOperation(id, result.data.operationId)
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        if (error.reason === 'HERO_LAST_ENABLED_SLIDE') {
          conflictNotice.value = null
          await refreshHome()
          return '停用未提交：首页至少需要保留一个启用的轮播项。请先启用另一个轮播项，再停用当前项。'
        }
        await onConflict(`${conflictSubject()}已在其他地方变化，已重新加载，请确认后重试。`)
        return '停用未提交：版本或大图状态已变化，请确认后重试。'
      }
      return '停用失败，请稍后重试。'
    }
    finally {
      mutating.value = false
    }
  }

  async function startPublication(id: string): Promise<string | null> {
    if (!home.value || mutating.value) {
      return null
    }
    mutating.value = true
    setFeedback(id, null)
    try {
      const result = await adminApi(
        heroUrl(`/slides/${id}/enable`),
        {
          method: 'POST',
          body: versionedBody({}),
          schema: publicationOperationResponseSchema,
        },
      )
      operations.value = { ...operations.value, [id]: result.data }
      conflictNotice.value = null
      void pollOperation(id, result.data.operationId)
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        if (error.reason === 'HERO_SLOT_LIMIT') {
          const slide = home.value.slides.find(item => item.id === id)
          const orderOccupied = slide && home.value.slides.some(item =>
            item.enabled && item.sortOrder === slide.sortOrder,
          )
          conflictNotice.value = null
          await refreshHome()
          return orderOccupied
            ? `启用未提交：顺位 ${slide.sortOrder} 已被其他启用项占用，请改为未使用的顺位并保存后重试。`
            : `启用未提交：${placementLabel()}最多启用 5 个大图项。`
        }
        if (error.reason === 'HERO_ORDER_STALE') {
          conflictNotice.value = null
          await refreshHome()
          return '启用未提交：顺位必须是 0–4，请修改并保存后重试。'
        }
        await onConflict(`${conflictSubject()}已在其他地方变化，已重新加载，请确认后重试。`)
        return '启用未提交：版本或大图状态已变化，请确认后重试。'
      }
      return '启用请求失败，请稍后重试。'
    }
    finally {
      mutating.value = false
    }
  }

  // 低分辨率确认与启用共用持久操作：适配完成后再启动原有公开发布。
  async function enableSlide(
    id: string,
    allowUpscale = false,
  ): Promise<string | null> {
    if (!allowUpscale) {
      return await startPublication(id)
    }
    if (!home.value || mutating.value) {
      return null
    }
    mutating.value = true
    setFeedback(id, null)
    try {
      const result = await adminApi(
        heroUrl(`/slides/${id}/upscale`),
        {
          method: 'POST',
          body: versionedBody({}),
          schema: publicationOperationResponseSchema,
        },
      )
      operations.value = { ...operations.value, [id]: result.data }
      void pollOperation(id, result.data.operationId)
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        await onConflict(`${conflictSubject()}已在其他地方变化，已重新加载，请确认后重试。`)
        return '适配未开始：版本或大图状态已变化，请确认后重试。'
      }
      return 'FFmpeg 放大适配未开始，私有原图已保留，请稍后重试。'
    }
    finally {
      mutating.value = false
    }
  }

  async function retryOperation(slideId: string): Promise<string | null> {
    const operation = operations.value[slideId]
    if (!home.value || !operation || operation.status !== 'FAILED' || mutating.value) {
      return null
    }
    mutating.value = true
    try {
      const retryUrl = operation.operationType === 'UPSCALE'
        ? `/api/admin/v1/site/home/upscale-operations/${operation.operationId}/retry`
        : `/api/admin/v1/site/home/publication-operations/${operation.operationId}/retry`
      const result = await adminApi(
        retryUrl,
        {
          method: 'POST',
          body: { expectedVersion: operation.version, payload: {} },
          schema: publicationOperationResponseSchema,
        },
      )
      operations.value = { ...operations.value, [slideId]: result.data }
      setFeedback(slideId, null)
      if (IN_PROGRESS_STATUSES.has(result.data.status)) {
        void pollOperation(slideId, result.data.operationId)
      }
      else {
        setFeedback(slideId, operationFeedback(result.data))
        await refreshHome()
      }
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        await onConflict(`${conflictSubject()}已在其他地方变化，已重新加载，请确认后重试。`)
        return '操作状态已变化，请按最新状态继续。'
      }
      return '重试失败，请稍后重试。'
    }
    finally {
      mutating.value = false
    }
  }

  watch(
    () => toValue(placement),
    () => {
      stopPolling()
      home.value = null
      operations.value = {}
      feedback.value = {}
      preview.reset()
      void load()
    },
  )

  onScopeDispose(stopPolling)

  return {
    conflictNotice,
    createSlide,
    deleteSlide,
    disableSlide,
    enableSlide,
    feedback,
    home,
    load,
    mutating,
    operations,
    pageStatus,
    loadPreview,
    previewPending,
    previews,
    reorderEnabled,
    retryOperation,
    saveSettings,
    updateSlide,
  }
}
