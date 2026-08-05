import { adminHeroPreviewResponseSchema } from '~~/shared/schemas/home'
import type { AdminHeroPreviewDto } from '~~/shared/types/contracts'
import { AdminApiError } from './useAdminApi'

/**
 * T34-F4：Hero 私有预览从 useAdminHome 抽出。
 * 自己拥有 previews / previewPending 两份状态；版本、URL 与冲突处理由调用方注入，
 * 因此不重复实现 placement 与版本基线逻辑。
 */
export function useHeroPreview(options: {
  conflictSubject: () => string
  heroUrl: (path?: string) => string
  onConflict: (message: string) => Promise<void>
  resetConflictNotice: () => void
  versionedBody: (payload: unknown) => unknown
}) {
  const adminApi = useAdminApi()

  const previews = ref<Record<string, AdminHeroPreviewDto>>({})
  const previewPending = ref<Record<string, boolean>>({})

  function reset() {
    previews.value = {}
    previewPending.value = {}
  }

  /** 活动居中水印真实私有预览：横版 768×432、竖版 480×853，同源地址 5 分钟。 */
  async function loadPreview(id: string): Promise<string | null> {
    if (previewPending.value[id]) {
      return null
    }
    previewPending.value = { ...previewPending.value, [id]: true }
    try {
      const result = await adminApi(
        options.heroUrl(`/slides/${id}/preview`),
        {
          method: 'POST',
          body: options.versionedBody({}),
          schema: adminHeroPreviewResponseSchema,
        },
      )
      previews.value = { ...previews.value, [id]: result.data }
      options.resetConflictNotice()
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        await options.onConflict(
          `${options.conflictSubject()}或活动水印已变化，已重新加载，请确认后重试。`,
        )
        return '预览未生成：版本或活动水印已变化，请确认后重试。'
      }
      return '预览生成失败，请稍后重试。'
    }
    finally {
      previewPending.value = { ...previewPending.value, [id]: false }
    }
  }

  return { loadPreview, previewPending, previews, reset }
}
