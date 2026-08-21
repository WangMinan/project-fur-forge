import {
  createUploadSessionResponseSchema,
} from '~~/shared/schemas/upload'
import type { VerifiedAssetDto } from '~~/shared/types/contracts'
import { runAdminUploadSession } from '~/utils/admin-upload-session'
import { DECLARATION_FAILURE_LABELS } from '~/utils/upload-declaration'
import { uploadSessionFailureLabel } from '~/utils/media-labels'
import { AdminApiError } from './useAdminApi'

// T20 首页横/竖槽位上传：digest → 会话（owner 为 site/home）→ 条件 PUT
// （带进度）→ 服务端核验。签名 URL 只在当前上传动作的内存中短暂存在。
export type HeroSlot = 'landscape' | 'portrait'

export type HeroUploadState
  = | 'idle'
    | 'digesting'
    | 'uploading'
    | 'validating'
    | 'completed'
    | 'failed'

export interface HeroUploadItem {
  asset: VerifiedAssetDto | null
  failureText: string | null
  ffmpegPreprocessExpected: boolean
  fileName: string | null
  previewUrl: string | null
  progress: number | null
  state: HeroUploadState
}

interface HeroAssetUploadOptions {
  contextLabel?: () => string
  getHomeVersion: () => number | null
  onAssetReady: (slot: HeroSlot, asset: VerifiedAssetDto) => void
  onConflict: () => void
  placement: 'home' | 'commission'
  slot: HeroSlot
}

const SLOT_MEDIA_ROLE: Record<HeroSlot, 'home_hero_landscape' | 'home_hero_portrait'> = {
  landscape: 'home_hero_landscape',
  portrait: 'home_hero_portrait',
}

export function useHeroAssetUpload(options: HeroAssetUploadOptions) {
  const adminApi = useAdminApi()
  const item = reactive<HeroUploadItem>({
    asset: null,
    failureText: null,
    ffmpegPreprocessExpected: false,
    fileName: null,
    previewUrl: null,
    progress: null,
    state: 'idle',
  })
  const contextLabel = () => options.contextLabel?.() ?? '首页'
  const conflictSubject = () => contextLabel() === '首页'
    ? '首页数据'
    : '委托页大图'

  function fail(text: string) {
    item.state = 'failed'
    item.failureText = text
    item.progress = null
  }

  function clearLocalPreview() {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
      item.previewUrl = null
    }
  }

  async function startUpload(file: File) {
    const homeVersion = options.getHomeVersion()
    if (homeVersion === null || item.state === 'digesting'
      || item.state === 'uploading' || item.state === 'validating') {
      return
    }
    clearLocalPreview()
    item.asset = null
    item.failureText = null
    item.ffmpegPreprocessExpected = false
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
            id: `hero-${options.placement}-${options.slot}`,
            expectedVersion: homeVersion,
          },
          mediaRole: SLOT_MEDIA_ROLE[options.slot],
          expected: declaration,
        },
        schema: createUploadSessionResponseSchema,
      }),
      onProgress: ratio => (item.progress = ratio),
      onStage: stage => (item.state = stage),
      validate: (declaration) => {
        item.ffmpegPreprocessExpected = declaration.byteSize > 20_000_000
        return null
      },
    })
    if (!result.ok) {
      if (result.step === 'declaration') {
        fail(DECLARATION_FAILURE_LABELS[result.reason])
      }
      else if (result.step === 'validation') {
        fail(result.message)
      }
      else if (result.step === 'put') {
        fail(result.reason === 'expired'
          ? '上传签名已过期，请重新上传'
          : result.reason === 'network'
            ? '上传中断（网络异常），请重新上传'
            : '文件未能写入私有存储，请重新上传')
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
          fail(failure.stage ? `${failure.text}（${failure.stage}）` : failure.text)
          return
        }
        if (result.step === 'complete' && result.session?.status === 'EXPIRED') {
          fail('上传会话已过期，请重新上传')
          return
        }
        if (result.step === 'complete' && result.session?.status === 'CANCELLED') {
          fail('上传会话已取消，请重新上传')
          return
        }
        if (error.status === 409) {
          fail(`${conflictSubject()}已在其他地方变化，请刷新后重试`)
          options.onConflict()
          return
        }
        fail(result.step === 'create'
          ? '无法创建上传会话，请稍后重试'
          : error.status === 400
            ? '上传未通过服务端核验，请重新上传'
            : '服务端处理失败，请稍后重试')
      }
      return
    }
    item.asset = result.asset
    if (result.asset.status === 'READY') {
      item.state = 'completed'
      options.onAssetReady(options.slot, result.asset)
    }
    else {
      fail('大原图私有处理源生成失败，请重新上传')
    }
  }

  onScopeDispose(clearLocalPreview)

  return { item, startUpload }
}
