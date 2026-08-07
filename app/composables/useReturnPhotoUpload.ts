import {
  createUploadSessionResponseSchema,
  completeUploadSessionResponseSchema,
  uploadSessionResponseSchema,
} from '~~/shared/schemas/upload'
import type {
  ConditionalPutDto,
  UploadSessionDto,
  VerifiedAssetDto,
} from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'
import { putFileToSignedUrl } from '~/utils/signed-put'
import {
  buildUploadDeclaration,
  DECLARATION_FAILURE_LABELS,
} from '~/utils/upload-declaration'

/**
 * T36 返图单图上传。
 *
 * 一条返图只有一张图片，因此这里是单一状态机，不做批量上传、
 * 批量排序或多图焦点编辑（那些不属于阶段 D）。
 *
 * 归属固定为 `{ type: 'return', id, expectedVersion }`，媒体角色固定
 * `return_photo`：复用现有条件 PUT 直传链路，不新建第二套上传协议。
 * 私有 Object Key 与签名 URL 只在本次动作的内存里短暂存在。
 */

export type ReturnUploadState =
  | 'idle'
  | 'digesting'
  | 'uploading'
  | 'validating'
  | 'ready'
  | 'failed'

/** 面向景宸的中文阶段说明，不出现内部错误码或 Object Key。 */
export const RETURN_UPLOAD_STATE_LABELS: Record<ReturnUploadState, string> = {
  idle: '尚未选择图片',
  digesting: '正在计算图片摘要',
  uploading: '正在上传到私有存储',
  validating: '正在核验图片',
  ready: '私有原图已就绪',
  failed: '上传失败',
}

export interface ReturnUploadContext {
  returnPhotoId: string
  version: number
}

export function useReturnPhotoUpload(options: {
  onConflict: () => void
  onUploaded: (asset: VerifiedAssetDto) => Promise<void> | void
}) {
  const adminApi = useAdminApi()

  const state = ref<ReturnUploadState>('idle')
  const progress = ref<number | null>(null)
  const failureText = ref<string | null>(null)
  const session = ref<UploadSessionDto | null>(null)
  const fileName = ref<string | null>(null)
  const previewUrl = ref<string | null>(null)

  function reset() {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
    }
    state.value = 'idle'
    progress.value = null
    failureText.value = null
    session.value = null
    fileName.value = null
    previewUrl.value = null
  }

  function fail(message: string) {
    state.value = 'failed'
    progress.value = null
    failureText.value = message
  }

  async function complete() {
    const current = session.value
    if (!current) {
      return
    }
    state.value = 'validating'
    progress.value = null
    try {
      const completed = await adminApi(
        `/api/admin/v1/media/upload-sessions/${current.uploadSessionId}/complete`,
        {
          method: 'POST',
          body: {
            expectedVersion: current.version,
            payload: { focalX: 0.5, focalY: 0.5 },
          },
          schema: completeUploadSessionResponseSchema,
        },
      )
      session.value = completed.data.session
      if (completed.data.asset.status !== 'READY') {
        fail('图片已上传，但服务端处理未完成，请重试上传')
        return
      }
      state.value = 'ready'
      await options.onUploaded(completed.data.asset)
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return
      }
      if (error instanceof AdminApiError && error.status === 400) {
        fail('服务端核验未通过：请确认选择的是完整、未损坏的图片')
        return
      }
      if (error instanceof AdminApiError && error.status === 409) {
        if (error.reason === 'RETURN_PHOTO_PUBLISHED_READONLY') {
          fail('这条返图已发布，替换图片前请先下架')
          return
        }
        fail('返图数据已在其他地方变化，请刷新后重试')
        options.onConflict()
        return
      }
      fail('服务端处理失败，请稍后重试')
    }
  }

  async function putThenComplete(
    upload: ConditionalPutDto,
    file: File,
  ) {
    state.value = 'uploading'
    progress.value = 0
    let status: number
    try {
      status = await putFileToSignedUrl(
        upload,
        file,
        (ratio) => {
          progress.value = ratio
        },
        () => {},
      )
    }
    catch {
      fail('上传中断，请检查网络后重试')
      return
    }
    if (status < 200 || status >= 300) {
      fail('私有存储拒绝了这次上传，请重试')
      return
    }
    await complete()
  }

  async function start(file: File, context: ReturnUploadContext) {
    reset()
    fileName.value = file.name
    previewUrl.value = URL.createObjectURL(file)
    state.value = 'digesting'

    const declaration = await buildUploadDeclaration(file)
    if (!declaration.ok) {
      fail(DECLARATION_FAILURE_LABELS[declaration.reason])
      return
    }

    let created
    try {
      created = await adminApi('/api/admin/v1/media/upload-sessions', {
        method: 'POST',
        body: {
          owner: {
            type: 'return',
            id: context.returnPhotoId,
            expectedVersion: context.version,
          },
          mediaRole: 'return_photo',
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
        if (error.reason === 'RETURN_PHOTO_PUBLISHED_READONLY') {
          fail('这条返图已发布，替换图片前请先下架')
          return
        }
        fail('返图数据已在其他地方变化，请刷新后重试')
        options.onConflict()
        return
      }
      fail('无法创建上传会话，请稍后重试')
      return
    }

    session.value = created.data.session
    await putThenComplete(created.data.upload, file)
  }

  /** 刷新后恢复：按会话 ID 读回服务端真实状态。 */
  async function refresh() {
    const current = session.value
    if (!current) {
      return
    }
    try {
      const latest = await adminApi(
        `/api/admin/v1/media/upload-sessions/${current.uploadSessionId}`,
        { schema: uploadSessionResponseSchema },
      )
      session.value = latest.data
    }
    catch {
      // 恢复失败不改变当前显示状态，避免把网络抖动写成上传失败。
    }
  }

  return {
    failureText,
    fileName,
    previewUrl,
    progress,
    refresh,
    reset,
    session,
    start,
    state,
  }
}
