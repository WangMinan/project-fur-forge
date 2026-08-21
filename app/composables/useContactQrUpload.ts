import { CONTACT_PLATFORMS } from '~~/shared/constants/contact'
import {
  createUploadSessionResponseSchema,
  retryAssetProcessingResponseSchema,
} from '~~/shared/schemas/upload'
import type {
  ContactPlatform,
  VerifiedAssetDto,
} from '~~/shared/types/contracts'
import { runAdminUploadSession } from '~/utils/admin-upload-session'
import { uploadSessionFailureLabel } from '~/utils/media-labels'
import { DECLARATION_FAILURE_LABELS } from '~/utils/upload-declaration'
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
  ffmpegExpected: boolean
  previewUrl: string | null
  progress: number | null
  state: ContactQrUploadState
}

function emptyItem(): ContactQrUploadItem {
  return {
    asset: null,
    failureText: null,
    fileName: null,
    ffmpegExpected: false,
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
    fail(item, asset.processingFailureCode === 'UPLOAD_PREPROCESS_FAILURE'
      ? '二维码分辨率适配失败，私有原图已保留，可重试处理'
      : asset.processingFailureCode === 'UPLOAD_DERIVATIVE_FAILURE'
        ? '二维码网页图片生成失败，可重试处理'
        : '二维码处理未完成，请重新上传')
  }

  async function start(file: File, platform: ContactPlatform) {
    if (busy.value) {
      return
    }
    reset(platform)
    const item = items[platform]
    item.fileName = file.name
    item.previewUrl = URL.createObjectURL(file)
    const result = await runAdminUploadSession({
      adminApi,
      file,
      createSession: declaration => adminApi('/api/admin/v1/media/upload-sessions', {
        method: 'POST',
        body: {
          owner: {
            type: 'site',
            id: 'contact',
            expectedVersion: options.getContactVersion(),
          },
          mediaRole: 'contact_qr',
          expected: declaration,
        },
        schema: createUploadSessionResponseSchema,
      }),
      onProgress: ratio => (item.progress = ratio),
      onStage: stage => (item.state = stage),
      validate: (declaration) => {
        if (declaration.byteSize > 20_000_000) {
          return '二维码图片不能超过 20 MB'
        }
        if (declaration.width < 64 || declaration.height < 64) {
          return '二维码图片任一边至少需要 64 px；更小的图片无法保证可读性'
        }
        item.ffmpegExpected = true
        return null
      },
    })
    if (!result.ok) {
      if (result.step === 'declaration') {
        fail(item, DECLARATION_FAILURE_LABELS[result.reason])
      }
      else if (result.step === 'validation') {
        fail(item, result.message)
      }
      else if (result.step === 'put') {
        fail(item, result.reason === 'expired'
          ? '上传签名已过期，请重新上传'
          : result.reason === 'network'
            ? '上传中断，请检查网络后重试'
            : '文件未能写入私有存储，请重新上传')
      }
      else {
        const error = result.error
        if (error instanceof AdminApiError && error.status === 401) {
          return
        }
        if (error instanceof AdminApiError && error.status === 409) {
          fail(item, '联系方式已在其他地方变化，请核对最新内容后重试')
          await options.onConflict()
          return
        }
        if (result.step === 'complete' && result.session?.status === 'FAILED') {
          fail(item, uploadSessionFailureLabel(result.session).text)
          return
        }
        fail(item, result.step === 'create'
          ? '无法创建上传会话，请稍后重试'
          : error instanceof AdminApiError && error.status === 400
            ? '服务端核验未通过，请确认图片完整且符合二维码要求'
            : '服务端处理失败，请稍后重试')
      }
      return
    }
    item.asset = result.asset
    if (result.asset.status !== 'READY') {
      processingFailure(item, result.asset)
      return
    }
    item.state = 'ready'
    options.onReady(platform, result.asset)
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
