import { CONTACT_PLATFORMS } from '~~/shared/constants/contact'
import {
  completeUploadSessionResponseSchema,
  createUploadSessionResponseSchema,
  retryAssetProcessingResponseSchema,
} from '~~/shared/schemas/upload'
import type {
  ConditionalPutDto,
  ContactPlatform,
  UploadSessionDto,
  VerifiedAssetDto,
} from '~~/shared/types/contracts'
import { putFileToSignedUrl } from '~/utils/signed-put'
import {
  buildUploadDeclaration,
  DECLARATION_FAILURE_LABELS,
} from '~/utils/upload-declaration'
import { AdminApiError } from './useAdminApi'

export type ContactQrUploadState
  = | 'idle'
    | 'digesting'
    | 'uploading'
    | 'validating'
    | 'ready'
    | 'failed'

export interface ContactQrUploadItem {
  asset: VerifiedAssetDto | null
  failureText: string | null
  fileName: string | null
  previewUrl: string | null
  progress: number | null
  state: ContactQrUploadState
}

function emptyItem(): ContactQrUploadItem {
  return {
    asset: null,
    failureText: null,
    fileName: null,
    previewUrl: null,
    progress: null,
    state: 'idle',
  }
}

export function useContactQrUpload(options: {
  getContactVersion: () => number
  onConflict: () => Promise<void> | void
  onReady: (platform: ContactPlatform, asset: VerifiedAssetDto) => void
}) {
  const adminApi = useAdminApi()
  const items = reactive(Object.fromEntries(
    CONTACT_PLATFORMS.map(platform => [platform, emptyItem()]),
  ) as Record<ContactPlatform, ContactQrUploadItem>)
  const busy = computed(() => CONTACT_PLATFORMS.some(platform => (
    items[platform].state === 'digesting'
    || items[platform].state === 'uploading'
    || items[platform].state === 'validating'
  )))

  function clearPreview(item: ContactQrUploadItem) {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
      item.previewUrl = null
    }
  }

  function reset(platform?: ContactPlatform) {
    const platforms = platform ? [platform] : CONTACT_PLATFORMS
    for (const current of platforms) {
      clearPreview(items[current])
      Object.assign(items[current], emptyItem())
    }
  }

  function fail(item: ContactQrUploadItem, message: string) {
    item.state = 'failed'
    item.progress = null
    item.failureText = message
  }

  function processingFailure(item: ContactQrUploadItem, asset: VerifiedAssetDto) {
    item.asset = asset
    fail(item, asset.processingFailureCode === 'UPLOAD_DERIVATIVE_FAILURE'
      ? '二维码网页图片生成失败，可重试处理'
      : '二维码处理未完成，请重新上传')
  }

  async function complete(
    platform: ContactPlatform,
    item: ContactQrUploadItem,
    session: UploadSessionDto,
  ) {
    item.state = 'validating'
    item.progress = null
    try {
      const result = await adminApi(
        `/api/admin/v1/media/upload-sessions/${session.uploadSessionId}/complete`,
        {
          method: 'POST',
          body: {
            expectedVersion: session.version,
            payload: { focalX: 0.5, focalY: 0.5 },
          },
          schema: completeUploadSessionResponseSchema,
        },
      )
      item.asset = result.data.asset
      if (result.data.asset.status !== 'READY') {
        processingFailure(item, result.data.asset)
        return
      }
      item.state = 'ready'
      options.onReady(platform, result.data.asset)
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return
      }
      if (error instanceof AdminApiError && error.status === 409) {
        fail(item, '联系方式已在其他地方变化，请核对最新内容后重试')
        await options.onConflict()
        return
      }
      fail(item, error instanceof AdminApiError && error.status === 400
        ? '服务端核验未通过，请确认图片完整且符合二维码要求'
        : '服务端处理失败，请稍后重试')
    }
  }

  async function start(file: File, platform: ContactPlatform) {
    if (busy.value) {
      return
    }
    reset(platform)
    const item = items[platform]
    item.fileName = file.name
    item.previewUrl = URL.createObjectURL(file)
    item.state = 'digesting'

    const declaration = await buildUploadDeclaration(file)
    if (!declaration.ok) {
      fail(item, DECLARATION_FAILURE_LABELS[declaration.reason])
      return
    }
    if (declaration.declaration.contentType !== 'image/png') {
      fail(item, '二维码只接受 PNG 图片')
      return
    }
    if (declaration.declaration.byteSize > 20_000_000) {
      fail(item, '二维码 PNG 不能超过 20 MB')
      return
    }
    if (
      declaration.declaration.width !== declaration.declaration.height
      || declaration.declaration.width < 320
    ) {
      fail(item, '二维码需要至少 320×320 的方形 PNG')
      return
    }

    let created: {
      data: { session: UploadSessionDto, upload: ConditionalPutDto }
    }
    try {
      created = await adminApi('/api/admin/v1/media/upload-sessions', {
        method: 'POST',
        body: {
          owner: {
            type: 'site',
            id: 'contact',
            expectedVersion: options.getContactVersion(),
          },
          mediaRole: 'contact_qr',
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
        fail(item, '联系方式已在其他地方变化，请核对最新内容后重试')
        await options.onConflict()
        return
      }
      fail(item, '无法创建上传会话，请稍后重试')
      return
    }

    item.state = 'uploading'
    item.progress = 0
    let status: number
    try {
      status = await putFileToSignedUrl(
        created.data.upload,
        file,
        ratio => (item.progress = ratio),
        () => {},
      )
    }
    catch {
      fail(item, '上传中断，请检查网络后重试')
      return
    }
    if (status === 403) {
      fail(item, '上传签名已过期，请重新上传')
      return
    }
    if (status < 200 || status >= 300) {
      fail(item, '文件未能写入私有存储，请重新上传')
      return
    }
    await complete(platform, item, created.data.session)
  }

  async function retryProcessing(platform: ContactPlatform) {
    const item = items[platform]
    const asset = item.asset
    if (!asset || busy.value) {
      return
    }
    item.state = 'validating'
    item.failureText = null
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
      if (result.data.status !== 'READY') {
        processingFailure(item, result.data)
        return
      }
      item.state = 'ready'
      options.onReady(platform, result.data)
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return
      }
      fail(item, '重试处理失败，请稍后再试')
    }
  }

  onScopeDispose(() => reset())

  return { busy, items, reset, retryProcessing, start }
}
