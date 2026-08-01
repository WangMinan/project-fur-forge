import {
  completeUploadSessionResponseSchema,
  createUploadSessionResponseSchema,
  retryAssetProcessingResponseSchema,
  retryUploadSessionResponseSchema,
  uploadSessionResponseSchema,
} from '~~/shared/schemas/upload'
import type {
  ConditionalPutDto,
  UploadSessionDto,
  VerifiedAssetDto,
} from '~~/shared/types/contracts'
import {
  UPLOAD_FAILURE_CODE_LABELS,
  UPLOAD_FAILURE_STAGE_LABELS,
} from '~/utils/media-labels'
import { putFileToSignedUrl } from '~/utils/signed-put'
import {
  buildUploadDeclaration,
  DECLARATION_FAILURE_LABELS,
} from '~/utils/upload-declaration'
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
  file: File
  fileName: string
  id: string
  previewUrl: string
  progress: number | null
  session: UploadSessionDto | null
  state: StudioUploadState
  // 签名 URL 只在当前上传动作的内存中短暂存在，不持久化、不上报。
  upload: ConditionalPutDto | null
}

export interface StudioUploadContext {
  workId: string
  workVersion: number
}

interface StudioPhotoUploadOptions {
  onAssetReady: (item: StudioUploadItem, asset: VerifiedAssetDto) => void
  onWorkConflict: () => void
}

function sessionFailureText(session: UploadSessionDto) {
  return {
    stage: session.failureStage
      ? UPLOAD_FAILURE_STAGE_LABELS[session.failureStage]
      : null,
    text: session.failureCode
      ? UPLOAD_FAILURE_CODE_LABELS[session.failureCode]
      : '上传未通过服务端核验，请重新上传',
  }
}

function putFile(
  upload: ConditionalPutDto,
  file: File,
  onProgress: (ratio: number) => void,
  registerXhr: (xhr: XMLHttpRequest | null) => void,
) {
  return putFileToSignedUrl(upload, file, onProgress, registerXhr)
}

// 出厂照上传状态机：预检查/摘要 → 会话 → 条件 PUT（带进度）→ 服务端核验 →
// READY / 处理失败（可重试处理）/ 失败或过期（可新会话重传）。
export function useStudioPhotoUpload(options: StudioPhotoUploadOptions) {
  const adminApi = useAdminApi()
  const items = ref<StudioUploadItem[]>([])
  const activeXhrs = new Map<string, XMLHttpRequest>()

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

  async function putThenComplete(item: StudioUploadItem) {
    const upload = item.upload
    const session = item.session
    if (!upload || !session) {
      failItem(item, '上传会话缺少签名信息，请重新上传')
      return
    }

    item.state = 'uploading'
    item.progress = 0
    let putStatus: number
    try {
      putStatus = await putFile(upload, item.file, (ratio) => {
        item.progress = ratio
      }, (xhr) => {
        if (xhr) {
          activeXhrs.set(item.id, xhr)
        }
        else {
          activeXhrs.delete(item.id)
        }
      })
    }
    catch {
      activeXhrs.delete(item.id)
      failItem(item, '上传中断（网络异常或已取消），可重新上传')
      return
    }
    finally {
      item.progress = null
      activeXhrs.delete(item.id)
    }
    // PUT 完成后签名 URL 立即丢弃。
    item.upload = null

    if (putStatus === 403) {
      expireItem(item)
      return
    }
    if (putStatus < 200 || putStatus >= 300) {
      failItem(item, '文件未能写入私有存储，可重新上传')
      return
    }

    item.state = 'validating'
    await completeItem(item)
  }

  async function completeItem(item: StudioUploadItem) {
    const session = item.session
    if (!session) {
      return
    }
    try {
      const result = await adminApi(
        `/api/admin/v1/media/upload-sessions/${session.uploadSessionId}/complete`,
        {
          method: 'POST',
          body: {
            expectedVersion: session.version,
            payload: {
              focalX: 0.5,
              focalY: 0.5,
            },
          },
          schema: completeUploadSessionResponseSchema,
        },
      )
      item.session = result.data.session
      item.asset = result.data.asset
      item.state = 'completed'
      if (result.data.asset.status === 'READY') {
        options.onAssetReady(item, result.data.asset)
      }
      return
    }
    catch (error) {
      if (!(error instanceof AdminApiError)) {
        failItem(item, '网络异常，请稍后重试')
        return
      }
      if (error.status === 401) {
        return
      }
      if (error.status === 400 || error.status === 409) {
        // 核验失败/过期/版本漂移：以服务端会话状态为准呈现。
        const fresh = await refreshSession(item)
        if (fresh?.status === 'EXPIRED') {
          expireItem(item)
          return
        }
        if (fresh?.status === 'FAILED') {
          const failure = sessionFailureText(fresh)
          failItem(item, failure.text, failure.stage)
          return
        }
        if (fresh?.status === 'CANCELLED') {
          item.state = 'cancelled'
          item.failureText = '上传会话已取消，请重新上传'
          return
        }
        failItem(
          item,
          error.status === 400
            ? '上传未通过服务端核验，请重新上传'
            : '上传会话状态冲突，请重新上传',
        )
        return
      }
      failItem(item, '服务端处理失败，请稍后重试')
    }
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
      upload: null,
    }) as StudioUploadItem
    items.value.push(item)

    const declaration = await buildUploadDeclaration(file)
    if (!declaration.ok) {
      failItem(item, DECLARATION_FAILURE_LABELS[declaration.reason])
      return
    }

    let created
    try {
      created = await adminApi('/api/admin/v1/media/upload-sessions', {
        method: 'POST',
        body: {
          owner: {
            type: 'work',
            id: context.workId,
            expectedVersion: context.workVersion,
          },
          mediaRole: 'studio_photo',
          expected: declaration.declaration,
        },
        schema: createUploadSessionResponseSchema,
      })
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
      failItem(item, '无法创建上传会话，请稍后重试')
      return
    }

    item.session = created.data.session
    item.upload = created.data.upload
    await putThenComplete(item)
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
    if (!session) {
      const file = item.file
      dismiss(item)
      await startUpload(file, context)
      return
    }
    try {
      const result = await adminApi(
        `/api/admin/v1/media/upload-sessions/${session.uploadSessionId}/retry`,
        {
          method: 'POST',
          body: { expectedVersion: session.version, payload: {} },
          schema: retryUploadSessionResponseSchema,
        },
      )
      item.session = result.data.session
      item.upload = result.data.upload
      item.failureText = null
      item.failureStage = null
      await putThenComplete(item)
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
    if (!options.keepPreview) {
      URL.revokeObjectURL(item.previewUrl)
    }
    items.value = items.value.filter(candidate => candidate.id !== item.id)
  }

  onScopeDispose(() => {
    items.value.forEach(item => URL.revokeObjectURL(item.previewUrl))
  })

  return {
    items,
    startUpload,
    cancelUpload,
    retryUpload,
    retryProcessing,
    dismiss,
  }
}
