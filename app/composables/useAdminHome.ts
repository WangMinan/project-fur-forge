import {
  adminHeroPreviewResponseSchema,
  adminHomeResponseSchema,
} from '~~/shared/schemas/home'
import { publicationOperationResponseSchema } from '~~/shared/schemas/publication'
import type {
  AdminHeroPreviewDto,
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

export interface HomeSettingsInput {
  tagline: string
  contactEmail: string
  contactQq: string
  autoRotate: boolean
  autoRotateIntervalMs: number
}

export interface SlideFeedback {
  retryOperationId: string | null
  text: string
  tone: 'error' | 'success'
}

const IN_PROGRESS_STATUSES = new Set([
  'GENERATING_PUBLIC',
  'APPLYING_WATERMARK',
  'VERIFYING_PUBLIC',
  'COMMITTING',
  'CLEANING_PUBLIC',
])

const POLL_INTERVAL_MS = 1_000

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
  const previews = ref<Record<string, AdminHeroPreviewDto>>({})
  const previewPending = ref<Record<string, boolean>>({})
  const upscaling = ref<Record<string, boolean>>({})

  const pollTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function stopPolling(slideId?: string) {
    if (slideId) {
      const timer = pollTimers.get(slideId)
      if (timer) {
        clearTimeout(timer)
        pollTimers.delete(slideId)
      }
      return
    }
    pollTimers.forEach(clearTimeout)
    pollTimers.clear()
  }

  function setFeedback(slideId: string, value: SlideFeedback | null) {
    feedback.value = value
      ? { ...feedback.value, [slideId]: value }
      : Object.fromEntries(
          Object.entries(feedback.value).filter(([key]) => key !== slideId),
        )
  }

  function restorePublicationOperations(snapshot: AdminHomeDto) {
    for (const slide of snapshot.slides) {
      const operation = slide.publicationOperation
      if (!operation) {
        continue
      }
      operations.value = { ...operations.value, [slide.id]: operation }
      if (IN_PROGRESS_STATUSES.has(operation.status)) {
        if (!pollTimers.has(slide.id)) {
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

  function operationFeedback(operation: PublicationOperationDto): SlideFeedback {
    if (operation.status === 'DONE') {
      return {
        retryOperationId: null,
        text: `启用成功：公开图片已生成并通过校验，${placementLabel()}大图已更新。`,
        tone: 'success',
      }
    }
    const stage = operation.failureStage
      ? PUBLICATION_FAILURE_STAGE_LABELS[operation.failureStage]
      : null
    return {
      retryOperationId: operation.status === 'FAILED' ? operation.operationId : null,
      text: `${publicationFailureLabel(operation.failureCode)}${stage ? `（失败于${stage}环节）` : ''}`,
      tone: 'error',
    }
  }

  async function pollOperation(slideId: string, operationId: string) {
    stopPolling(slideId)
    const tick = async () => {
      let current: PublicationOperationDto | null = null
      try {
        const result = await adminApi(
          `/api/admin/v1/publication-operations/${operationId}`,
          { schema: publicationOperationResponseSchema },
        )
        current = result.data
        operations.value = { ...operations.value, [slideId]: current }
        await refreshHome(false)
      }
      catch (error) {
        if (error instanceof AdminApiError && error.status === 401) {
          return
        }
        // 轮询失败不阻塞：保留已有状态，下一轮继续。
      }
      if (current && !IN_PROGRESS_STATUSES.has(current.status)) {
        setFeedback(slideId, operationFeedback(current))
        // 提交会递增 home 版本：无论成败都重新加载，保证版本基线新鲜。
        await refreshHome()
        return
      }
      pollTimers.set(slideId, setTimeout(() => {
        pollTimers.delete(slideId)
        void tick()
      }, POLL_INTERVAL_MS))
    }
    await tick()
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
        if (error.serverMessage === 'At least one hero slide must remain enabled.') {
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
    return await runHomeMutation(async () => {
      const result = await adminApi(
        heroUrl(`/slides/${id}/disable`),
        {
          method: 'POST',
          body: versionedBody({}),
          schema: adminHomeResponseSchema,
        },
      )
      return result.data
    }, '停用失败，请稍后重试。')
  }

  // 启用为异步发布：返回错误文案或 null；进度经 operations/feedback 呈现。
  async function enableSlide(
    id: string,
    allowUpscale = false,
  ): Promise<string | null> {
    if (!home.value || mutating.value) {
      return null
    }
    mutating.value = true
    setFeedback(id, null)
    let stage: 'publication' | 'upscale' = allowUpscale
      ? 'upscale'
      : 'publication'
    try {
      if (allowUpscale) {
        upscaling.value = { ...upscaling.value, [id]: true }
        const prepared = await adminApi(
          heroUrl(`/slides/${id}/upscale`),
          {
            method: 'POST',
            body: versionedBody({}),
            schema: adminHomeResponseSchema,
          },
        )
        home.value = prepared.data
        upscaling.value = { ...upscaling.value, [id]: false }
        stage = 'publication'
      }
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
        if (error.serverMessage === 'Enabled hero slides must have 1 to 5 unique positions.') {
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
        if (error.serverMessage === 'Enabled hero slide order must be between 0 and 4.') {
          conflictNotice.value = null
          await refreshHome()
          return '启用未提交：顺位必须是 0–4，请修改并保存后重试。'
        }
        await onConflict(`${conflictSubject()}已在其他地方变化，已重新加载，请确认后重试。`)
        return '启用未提交：版本或大图状态已变化，请确认后重试。'
      }
      if (stage === 'upscale') {
        return 'FFmpeg 放大适配失败，私有原图已保留，请稍后重试。'
      }
      return '启用请求失败，请稍后重试。'
    }
    finally {
      upscaling.value = { ...upscaling.value, [id]: false }
      mutating.value = false
    }
  }

  async function retryPublication(slideId: string): Promise<string | null> {
    const operation = operations.value[slideId]
    if (!home.value || !operation || operation.status !== 'FAILED' || mutating.value) {
      return null
    }
    mutating.value = true
    try {
      const result = await adminApi(
        `/api/admin/v1/site/home/publication-operations/${operation.operationId}/retry`,
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

  // 活动居中水印真实私有预览：横版 768×432、竖版 480×853，同源地址 5 分钟。
  async function loadPreview(id: string): Promise<string | null> {
    if (!home.value || previewPending.value[id]) {
      return null
    }
    previewPending.value = { ...previewPending.value, [id]: true }
    try {
      const result = await adminApi(
        heroUrl(`/slides/${id}/preview`),
        {
          method: 'POST',
          body: versionedBody({}),
          schema: adminHeroPreviewResponseSchema,
        },
      )
      previews.value = { ...previews.value, [id]: result.data }
      conflictNotice.value = null
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        await onConflict(`${conflictSubject()}或活动水印已变化，已重新加载，请确认后重试。`)
        return '预览未生成：版本或活动水印已变化，请确认后重试。'
      }
      return '预览生成失败，请稍后重试。'
    }
    finally {
      previewPending.value = { ...previewPending.value, [id]: false }
    }
  }

  watch(
    () => toValue(placement),
    () => {
      stopPolling()
      home.value = null
      operations.value = {}
      feedback.value = {}
      previews.value = {}
      previewPending.value = {}
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
    retryPublication,
    saveSettings,
    updateSlide,
    upscaling,
  }
}
