import {
  createUploadSessionResponseSchema,
  retryAssetProcessingResponseSchema,
  retryUploadSessionResponseSchema,
  uploadSessionResponseSchema,
  verifiedAssetResponseSchema,
} from '~~/shared/schemas/upload'
import type {
  UploadSessionDto,
  VerifiedAssetDto,
} from '~~/shared/types/contracts'
import {
  completeAdminUploadSession,
  finishAdminUploadSession,
  runAdminUploadSession,
} from '~/utils/admin-upload-session'
import type { AdminUploadResult } from '~/utils/admin-upload-session'
import { uploadSessionFailureLabel } from '~/utils/media-labels'
import { DECLARATION_FAILURE_LABELS } from '~/utils/upload-declaration'
import { ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH } from '~~/shared/constants/admin-media-preview'
import { adminMediaPreviewUrl } from '~/utils/admin-media-preview'
import { AdminApiError } from './useAdminApi'

export type StudioUploadState
  = | 'digesting'
    | 'uploading'
    | 'validating'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'expired'

export interface StudioUploadItem {
  asset: VerifiedAssetDto | null
  failureStage: string | null
  failureText: string | null
  file: File | null
  fileName: string
  id: string
  previewUrl: string | null
  progress: number | null
  session: UploadSessionDto | null
  state: StudioUploadState
}

export interface StudioUploadContext {
  workId: string
  workVersion: number
}

interface StudioPhotoUploadOptions {
  mediaRole: 'adoption_cover' | 'design_sheet' | 'studio_photo'
  onAssetReady: (item: StudioUploadItem, asset: VerifiedAssetDto) => void
  onWorkConflict: () => void
}

interface PersistedUpload {
  fileName: string
  uploadSessionId: string
}

// 出厂照上传状态机：预检查/摘要 → 会话 → 条件 PUT（带进度）→ 服务端核验 →
// READY / 处理失败（可重试处理）/ 失败或过期（可新会话重传）。
export function useStudioPhotoUpload(options: StudioPhotoUploadOptions) {
  const adminApi = useAdminApi()
  const items = ref<StudioUploadItem[]>([])
  const activeXhrs = new Map<string, XMLHttpRequest>()
  let disposed = false

  function persistenceKey(workId: string) {
    return `project-fur-forge:work-upload:${workId}:${options.mediaRole}`
  }

  function readPersisted(workId: string): PersistedUpload[] {
    if (!import.meta.client) {
      return []
    }
    try {
      const raw = sessionStorage.getItem(persistenceKey(workId))
      const value = raw ? JSON.parse(raw) : []
      return Array.isArray(value)
        ? value.filter(record =>
            typeof record?.fileName === 'string'
            && typeof record?.uploadSessionId === 'string',
          )
        : []
    }
    catch {
      return []
    }
  }

  function writePersisted(workId: string, records: PersistedUpload[]) {
    if (!import.meta.client) {
      return
    }
    try {
      if (records.length === 0) {
        sessionStorage.removeItem(persistenceKey(workId))
      }
      else {
        sessionStorage.setItem(persistenceKey(workId), JSON.stringify(records))
      }
    }
    catch {
      // Upload recovery is best effort when browser storage is unavailable.
    }
  }

  function remember(item: StudioUploadItem, context: StudioUploadContext) {
    const session = item.session
    if (!session) {
      return
    }
    const records = readPersisted(context.workId).filter(
      record => record.uploadSessionId !== session.uploadSessionId,
    )
    records.push({
      fileName: item.fileName,
      uploadSessionId: session.uploadSessionId,
    })
    writePersisted(context.workId, records)
  }

  function forget(item: StudioUploadItem) {
    const session = item.session
    if (!session || session.owner.type !== 'work') {
      return
    }
    writePersisted(
      session.owner.id,
      readPersisted(session.owner.id).filter(
        record => record.uploadSessionId !== session.uploadSessionId,
      ),
    )
  }

  function failItem(item: StudioUploadItem, text: string, stage: string | null = null) {
    // 取消竞态：abort 引发的 PUT 失败不得覆盖已取消状态。
    if (item.state === 'cancelled') {
      return
    }
    item.state = 'failed'
    item.failureText = text
    item.failureStage = stage
    item.progress = null
  }

  function expireItem(item: StudioUploadItem) {
    item.state = 'expired'
    item.failureText = '上传签名已过期，请重新上传'
    item.failureStage = null
    item.progress = null
  }

  async function refreshSession(item: StudioUploadItem) {
    const session = item.session
    if (!session) {
      return null
    }
    const fresh = await adminApi(
      `/api/admin/v1/media/upload-sessions/${session.uploadSessionId}`,
      { schema: uploadSessionResponseSchema },
    ).catch(() => null)
    if (fresh) {
      item.session = fresh.data
    }
    return fresh?.data ?? null
  }

  async function completeItem(item: StudioUploadItem) {
    const session = item.session
    if (!session) {
      return
    }
    const result = await finishAdminUploadSession({ adminApi, session })
    await applyUploadResult(item, result)
  }

  async function applyUploadResult(
    item: StudioUploadItem,
    result: AdminUploadResult,
  ) {
    if (result.ok) {
      item.session = result.session
      item.asset = result.asset
      item.state = 'completed'
      if (result.asset.status === 'READY') {
        options.onAssetReady(item, result.asset)
      }
      return
    }
    if (result.step === 'declaration') {
      failItem(item, DECLARATION_FAILURE_LABELS[result.reason])
      return
    }
    if (result.step === 'validation') {
      failItem(item, result.message)
      return
    }
    if (result.step === 'put') {
      if (result.reason === 'expired') {
        expireItem(item)
      }
      else {
        failItem(item, result.reason === 'network'
          ? '上传中断（网络异常或已取消），可重新上传'
          : '文件未能写入私有存储，可重新上传')
      }
      return
    }

    const error = result.error
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (result.step === 'create') {
      if (error instanceof AdminApiError && error.status === 409) {
        failItem(item, '作品数据已在其他地方变化，请刷新后重试')
        options.onWorkConflict()
      }
      else {
        failItem(item, '无法创建上传会话，请稍后重试')
      }
      return
    }

    if (result.session) {
      item.session = result.session
      if (result.session.status === 'EXPIRED') {
        expireItem(item)
        return
      }
      if (result.session.status === 'FAILED') {
        const failure = uploadSessionFailureLabel(result.session)
        failItem(item, failure.text, failure.stage)
        return
      }
      if (result.session.status === 'CANCELLED') {
        item.state = 'cancelled'
        item.failureText = '上传会话已取消，请重新上传'
        return
      }
    }
    failItem(item, error instanceof AdminApiError && error.status === 400
      ? '上传未通过服务端核验，请重新上传'
      : error instanceof AdminApiError && error.status === 409
        ? '上传会话状态冲突，请重新上传'
        : '服务端处理失败，请稍后重试')
  }

  async function startUpload(file: File, context: StudioUploadContext) {
    const item = reactive({
      asset: null,
      failureStage: null,
      failureText: null,
      file,
      fileName: file.name,
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      progress: null,
      session: null,
      state: 'digesting',
    }) as StudioUploadItem
    items.value.push(item)

    const result = await runAdminUploadSession({
      adminApi,
      file,
      createSession: declaration => adminApi('/api/admin/v1/media/upload-sessions', {
        method: 'POST',
        body: {
          owner: {
            type: 'work',
            id: context.workId,
            expectedVersion: context.workVersion,
          },
          mediaRole: options.mediaRole,
          expected: declaration,
        },
        schema: createUploadSessionResponseSchema,
      }),
      onCreated: (created) => {
        item.session = created.data.session
        remember(item, context)
      },
      onProgress: ratio => (item.progress = ratio),
      onStage: stage => (item.state = stage),
      registerXhr: (xhr) => {
        if (xhr) {
          activeXhrs.set(item.id, xhr)
        }
        else {
          activeXhrs.delete(item.id)
        }
      },
    })
    await applyUploadResult(item, result)
  }

  async function cancelUpload(item: StudioUploadItem) {
    const session = item.session
    if (!session || session.status !== 'AWAITING_UPLOAD') {
      return
    }
    // 先中断进行中的 PUT，再取消服务端会话；会话取消后不再 PUT。
    activeXhrs.get(item.id)?.abort()
    try {
      const result = await adminApi(
        `/api/admin/v1/media/upload-sessions/${session.uploadSessionId}/cancel`,
        {
          method: 'POST',
          body: { expectedVersion: session.version, payload: {} },
          schema: uploadSessionResponseSchema,
        },
      )
      item.session = result.data
      item.state = 'cancelled'
      item.failureText = '上传会话已取消，请重新上传'
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return
      }
      failItem(item, '取消失败，请稍后重试')
    }
  }

  // 失败/取消/过期会话的重传：服务端返回全新会话与签名 URL，必须用新 URL 重传。
  async function retryUpload(item: StudioUploadItem, context: StudioUploadContext) {
    const session = item.session
    const file = item.file
    if (!file) {
      failItem(item, '刷新后需要重新选择原文件并重新上传')
      return
    }
    if (!session) {
      dismiss(item)
      await startUpload(file, context)
      return
    }
    try {
      const retried = await adminApi(
        `/api/admin/v1/media/upload-sessions/${session.uploadSessionId}/retry`,
        {
          method: 'POST',
          body: { expectedVersion: session.version, payload: {} },
          schema: retryUploadSessionResponseSchema,
        },
      )
      forget(item)
      item.failureText = null
      item.failureStage = null
      const result = await completeAdminUploadSession({
        adminApi,
        created: retried,
        file,
        onCreated: (created) => {
          item.session = created.data.session
          remember(item, context)
        },
        onProgress: ratio => (item.progress = ratio),
        onStage: stage => (item.state = stage),
        registerXhr: (xhr) => {
          if (xhr) {
            activeXhrs.set(item.id, xhr)
          }
          else {
            activeXhrs.delete(item.id)
          }
        },
      })
      await applyUploadResult(item, result)
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return
      }
      if (error instanceof AdminApiError && error.status === 409) {
        failItem(item, '作品数据已在其他地方变化，请刷新后重试')
        options.onWorkConflict()
        return
      }
      failItem(item, '无法重试上传，请稍后重试')
    }
  }

  // 预处理失败的永久 asset：不重传原图，只重试私有处理源生成。
  async function retryProcessing(item: StudioUploadItem) {
    const asset = item.asset
    if (!asset || asset.status !== 'FAILED') {
      return
    }
    item.state = 'validating'
    item.failureText = null
    item.failureStage = null
    try {
      const result = await adminApi(
        `/api/admin/v1/media/assets/${asset.assetId}/retry-processing`,
        {
          method: 'POST',
          body: { expectedVersion: asset.version, payload: {} },
          schema: retryAssetProcessingResponseSchema,
        },
      )
      item.asset = result.data
      item.state = 'completed'
      if (result.data.status === 'READY') {
        options.onAssetReady(item, result.data)
      }
      else {
        item.failureText = '大原图私有处理源生成失败，可重试处理'
        item.failureStage = '私有处理源'
      }
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return
      }
      item.state = 'completed'
      item.failureText = '重试处理失败，请稍后重试'
    }
  }

  function dismiss(item: StudioUploadItem, options: { keepPreview?: boolean } = {}) {
    forget(item)
    if (!options.keepPreview && item.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(item.previewUrl)
    }
    items.value = items.value.filter(candidate => candidate.id !== item.id)
  }

  async function recoverCompleted(item: StudioUploadItem) {
    const assetId = item.session?.assetId
    if (!assetId) {
      failItem(item, '服务端会话已完成，但没有可恢复的媒体资产')
      return
    }
    try {
      const result = await adminApi(`/api/admin/v1/media/assets/${assetId}`, {
        schema: verifiedAssetResponseSchema,
      })
      item.asset = result.data
      item.previewUrl = adminMediaPreviewUrl(assetId, ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH)
      item.state = 'completed'
      if (result.data.status === 'READY') {
        options.onAssetReady(item, result.data)
      }
      else if (result.data.status === 'FAILED') {
        item.failureText = '大原图私有处理源生成失败，可重试处理'
        item.failureStage = '私有处理源'
      }
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return
      }
      failItem(item, '无法恢复已完成的媒体资产，请稍后重试')
    }
  }

  async function restore(context: StudioUploadContext) {
    const records = readPersisted(context.workId)
    for (const record of records) {
      if (disposed || items.value.some(item =>
        item.session?.uploadSessionId === record.uploadSessionId,
      )) {
        continue
      }
      let session: UploadSessionDto
      try {
        const result = await adminApi(
          `/api/admin/v1/media/upload-sessions/${record.uploadSessionId}`,
          { schema: uploadSessionResponseSchema },
        )
        session = result.data
      }
      catch (error) {
        if (error instanceof AdminApiError && error.status === 401) {
          return
        }
        writePersisted(
          context.workId,
          readPersisted(context.workId).filter(
            candidate => candidate.uploadSessionId !== record.uploadSessionId,
          ),
        )
        continue
      }
      if (
        session.owner.type !== 'work'
        || session.owner.id !== context.workId
        || session.mediaRole !== options.mediaRole
      ) {
        writePersisted(
          context.workId,
          readPersisted(context.workId).filter(
            candidate => candidate.uploadSessionId !== record.uploadSessionId,
          ),
        )
        continue
      }
      const item = reactive({
        asset: null,
        failureStage: null,
        failureText: null,
        file: null,
        fileName: record.fileName,
        id: crypto.randomUUID(),
        previewUrl: null,
        progress: null,
        session,
        state: session.status === 'AWAITING_UPLOAD' || session.status === 'VALIDATING'
          ? 'validating'
          : session.status === 'COMPLETED'
            ? 'completed'
            : session.status === 'CANCELLED'
              ? 'cancelled'
              : session.status === 'EXPIRED'
                ? 'expired'
                : 'failed',
      }) as StudioUploadItem
      items.value.push(item)

      if (session.status === 'AWAITING_UPLOAD') {
        await completeItem(item)
      }
      else {
        while (!disposed && item.session?.status === 'VALIDATING') {
          await new Promise(resolve => setTimeout(resolve, 1_000))
          const fresh = await refreshSession(item)
          if (!fresh) {
            break
          }
        }
        const current = item.session
        if (current?.status === 'COMPLETED') {
          await recoverCompleted(item)
        }
        else if (current?.status === 'FAILED') {
          const failure = uploadSessionFailureLabel(current)
          failItem(item, failure.text, failure.stage)
        }
        else if (current?.status === 'CANCELLED') {
          item.state = 'cancelled'
          item.failureText = '上传会话已取消，请重新选择文件'
        }
        else if (current?.status === 'EXPIRED') {
          expireItem(item)
        }
      }
    }
  }

  onScopeDispose(() => {
    disposed = true
    items.value.forEach((item) => {
      if (item.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl)
      }
    })
  })

  return {
    items,
    startUpload,
    cancelUpload,
    retryUpload,
    retryProcessing,
    dismiss,
    restore,
  }
}
