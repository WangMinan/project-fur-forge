import {
  completeUploadSessionResponseSchema,
  createUploadSessionResponseSchema,
  uploadSessionResponseSchema,
} from '~~/shared/schemas/upload'
import type {
  ConditionalPutDto,
  UploadSessionDto,
  VerifiedAssetDto,
} from '~~/shared/types/contracts'
import { putFileToSignedUrl } from '~/utils/signed-put'
import {
  buildUploadDeclaration,
  DECLARATION_FAILURE_LABELS,
} from '~/utils/upload-declaration'
import {
  UPLOAD_FAILURE_CODE_LABELS,
  UPLOAD_FAILURE_STAGE_LABELS,
} from '~/utils/media-labels'
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

  let session: UploadSessionDto | null = null
  let upload: ConditionalPutDto | null = null

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

  function sessionFailureText(currentSession: UploadSessionDto) {
    const text = currentSession.failureCode
      ? UPLOAD_FAILURE_CODE_LABELS[currentSession.failureCode]
      : '上传未通过服务端核验，请重新上传'
    return currentSession.failureStage
      ? `${text}（${UPLOAD_FAILURE_STAGE_LABELS[currentSession.failureStage]}）`
      : text
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
    item.state = 'digesting'

    const declaration = await buildUploadDeclaration(file)
    if (!declaration.ok) {
      fail(DECLARATION_FAILURE_LABELS[declaration.reason])
      return
    }
    item.ffmpegPreprocessExpected = declaration.declaration.byteSize > 20_000_000

    try {
      const created = await adminApi('/api/admin/v1/media/upload-sessions', {
        method: 'POST',
        body: {
          owner: {
            type: 'site',
            id: `hero-${options.placement}-${options.slot}`,
            expectedVersion: homeVersion,
          },
          mediaRole: SLOT_MEDIA_ROLE[options.slot],
          expected: declaration.declaration,
        },
        schema: createUploadSessionResponseSchema,
      })
      session = created.data.session
      upload = created.data.upload
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return
      }
      if (error instanceof AdminApiError && error.status === 409) {
        fail(`${conflictSubject()}已在其他地方变化，请刷新后重试`)
        options.onConflict()
        return
      }
      fail('无法创建上传会话，请稍后重试')
      return
    }

    item.state = 'uploading'
    item.progress = 0
    let putStatus: number
    try {
      putStatus = await putFileToSignedUrl(upload!, file, (ratio) => {
        item.progress = ratio
      }, () => {})
    }
    catch {
      fail('上传中断（网络异常），请重新上传')
      return
    }
    finally {
      item.progress = null
      // PUT 完成后签名 URL 立即丢弃。
      upload = null
    }

    if (putStatus === 403) {
      fail('上传签名已过期，请重新上传')
      return
    }
    if (putStatus < 200 || putStatus >= 300) {
      fail('文件未能写入私有存储，请重新上传')
      return
    }

    item.state = 'validating'
    const currentSession = session
    if (!currentSession) {
      fail('上传会话丢失，请重新上传')
      return
    }
    try {
      const result = await adminApi(
        `/api/admin/v1/media/upload-sessions/${currentSession.uploadSessionId}/complete`,
        {
          method: 'POST',
          body: {
            expectedVersion: currentSession.version,
            payload: { focalX: 0.5, focalY: 0.5 },
          },
          schema: completeUploadSessionResponseSchema,
        },
      )
      session = result.data.session
      item.asset = result.data.asset
      if (result.data.asset.status === 'READY') {
        item.state = 'completed'
        options.onAssetReady(options.slot, result.data.asset)
      }
      else {
        fail('大原图私有处理源生成失败，请重新上传')
      }
    }
    catch (error) {
      if (!(error instanceof AdminApiError)) {
        fail('网络异常，请稍后重试')
        return
      }
      if (error.status === 401) {
        return
      }
      if (error.status === 400 || error.status === 409) {
        const fresh = await adminApi(
          `/api/admin/v1/media/upload-sessions/${currentSession.uploadSessionId}`,
          { schema: uploadSessionResponseSchema },
        ).catch(() => null)
        if (fresh?.data.status === 'FAILED') {
          fail(sessionFailureText(fresh.data))
          return
        }
        if (fresh?.data.status === 'EXPIRED') {
          fail('上传会话已过期，请重新上传')
          return
        }
        if (fresh?.data.status === 'CANCELLED') {
          fail('上传会话已取消，请重新上传')
          return
        }
      }
      if (error.status === 409) {
        fail(`${conflictSubject()}已在其他地方变化，请刷新后重试`)
        options.onConflict()
        return
      }
      fail(error.status === 400
        ? '上传未通过服务端核验，请重新上传'
        : '服务端处理失败，请稍后重试')
    }
  }

  onScopeDispose(clearLocalPreview)

  return { item, startUpload }
}
