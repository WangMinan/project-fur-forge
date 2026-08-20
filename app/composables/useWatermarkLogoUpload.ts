import {
  createUploadSessionResponseSchema,
} from '~~/shared/schemas/upload'
import { runAdminUploadSession } from '~/utils/admin-upload-session'
import { uploadSessionFailureLabel } from '~/utils/media-labels'
import { DECLARATION_FAILURE_LABELS } from '~/utils/upload-declaration'
import { AdminApiError } from './useAdminApi'

// 水印 Logo 候选上传：浏览器基础检查（PNG/20 MB/可解码/含透明区域）→
// 真实摘要计算 → 品牌上传会话 → 条件直传 → 服务端核验。
// 签名 URL 不持久化；候选缩略图只使用服务端同源 previewUrl。

export type LogoUploadStage
  = | 'idle'
    | 'digesting'
    | 'uploading'
    | 'validating'
    | 'done'
    | 'failed'

interface WatermarkLogoUploadOptions {
  onCompleted: (assetId: string) => Promise<void> | void
  onConflict: () => Promise<void> | void
}

async function pngHasTransparentPixel(bytes: Uint8Array<ArrayBuffer>): Promise<boolean> {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
  try {
    const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = typeof OffscreenCanvas === 'undefined'
      ? Object.assign(document.createElement('canvas'), { width, height })
      : new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) {
      // 无法采样时放行，由服务端核验兜底。
      return true
    }
    context.drawImage(bitmap, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height).data
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index]! < 255) {
        return true
      }
    }
    return false
  }
  finally {
    bitmap.close()
  }
}

export function useWatermarkLogoUpload(options: WatermarkLogoUploadOptions) {
  const adminApi = useAdminApi()

  const stage = ref<LogoUploadStage>('idle')
  const progress = ref<number | null>(null)
  const fileName = ref<string | null>(null)
  const failureText = ref<string | null>(null)
  const failureStage = ref<string | null>(null)

  const busy = computed(() =>
    ['digesting', 'uploading', 'validating'].includes(stage.value),
  )

  function fail(text: string, stageLabel: string | null = null) {
    stage.value = 'failed'
    failureText.value = text
    failureStage.value = stageLabel
    progress.value = null
  }

  async function start(file: File, brandingVersion: number) {
    if (busy.value) {
      return
    }
    fileName.value = file.name
    failureText.value = null
    failureStage.value = null

    if (file.type !== 'image/png') {
      fail('只接受透明 PNG 图片')
      return
    }
    if (file.size < 1 || file.size > 20_000_000) {
      fail('文件大小需在 1 字节到 20 MB 之间')
      return
    }

    const result = await runAdminUploadSession({
      adminApi,
      file,
      createSession: declaration => adminApi(
        '/api/admin/v1/site/branding/watermark-assets/upload-sessions',
        {
          method: 'POST',
          body: {
            expectedVersion: brandingVersion,
            payload: { expected: declaration },
          },
          schema: createUploadSessionResponseSchema,
        },
      ),
      onProgress: ratio => (progress.value = ratio),
      onStage: next => (stage.value = next),
      validate: async (_declaration, selectedFile) => {
        const bytes = new Uint8Array(await selectedFile.arrayBuffer())
        return await pngHasTransparentPixel(bytes)
          ? null
          : '未检测到透明区域，水印 Logo 需要透明 PNG'
      },
    })
    if (!result.ok) {
      if (result.step === 'declaration') {
        fail(result.reason === 'decode'
          ? '浏览器无法解码该文件，请选择有效的 PNG 图片'
          : result.reason === 'dimensions'
            ? '图片边长不能超过 12,000 像素'
            : DECLARATION_FAILURE_LABELS[result.reason])
      }
      else if (result.step === 'validation') {
        fail(result.message)
      }
      else if (result.step === 'put') {
        fail(result.reason === 'expired'
          ? '上传签名已过期，请重新上传'
          : result.reason === 'network'
            ? '上传中断（网络异常），可重新上传'
            : '文件未能写入私有存储，可重新上传')
      }
      else {
        const error = result.error
        if (!(error instanceof AdminApiError)) {
          fail(result.step === 'create'
            ? '无法创建上传会话，请稍后重试'
            : '网络异常，请稍后重试')
          return
        }
        if (error.status === 401) {
          return
        }
        if (result.step === 'complete' && result.session?.status === 'FAILED') {
          const failure = uploadSessionFailureLabel(result.session)
          fail(failure.text, failure.stage)
          return
        }
        if (result.step === 'complete' && result.session?.status === 'EXPIRED') {
          fail('上传会话已过期，请重新上传')
          return
        }
        if (result.step === 'create' && error.status === 409) {
          await options.onConflict()
          fail('站点品牌数据已变化，已刷新，请重新上传')
          return
        }
        fail(result.step === 'create'
          ? '无法创建上传会话，请稍后重试'
          : error.status === 400 || error.status === 409
            ? '上传未通过服务端核验，请重新上传'
            : '服务端处理失败，请稍后重试')
      }
      return
    }
    stage.value = 'done'
    await options.onCompleted(result.asset.assetId)
  }

  function reset() {
    stage.value = 'idle'
    progress.value = null
    fileName.value = null
    failureText.value = null
    failureStage.value = null
  }

  return {
    busy,
    fail,
    failureStage,
    failureText,
    fileName,
    progress,
    reset,
    stage,
    start,
  }
}
