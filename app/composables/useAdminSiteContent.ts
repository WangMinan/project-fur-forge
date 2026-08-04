import { adminSiteContentResponseSchema } from '~~/shared/schemas/site-content'
import type {
  AdminSiteContentDto,
  SiteBusinessStatusKind,
} from '~~/shared/types/contracts'
import { AdminApiError } from './useAdminApi'

// T26–T27 站点内容与营业状态管理：content 快照为唯一状态基线，所有写操作带
// expectedVersion；409 一律重新 GET，不自行递增或猜测版本。表单本地状态在卡片内，
// 冲突重载后由卡片按 dirty 规则保留输入、仅推进基线。
export interface SiteContentPayload {
  commission: {
    intro: string | null
    estimateNote: string | null
    emailAction: string | null
    faqs: Array<{ question: string, answer: string }>
  }
  about: {
    studioFacts: string | null
    makingScope: string | null
    basicTerms: string | null
    privacyPolicy: string | null
  }
  contact: {
    douyin: string | null
    antiScam: string | null
  }
}

export interface SiteStatusPayload {
  tone: 'closed' | 'limited' | 'open'
  label: string
  detail: string
}

export function useAdminSiteContent() {
  const adminApi = useAdminApi()

  const content = ref<AdminSiteContentDto | null>(null)
  const pageStatus = ref<'error' | 'loading' | 'ready'>('loading')
  const mutating = ref(false)
  const conflictNotice = ref<string | null>(null)
  /** 最近一次成功保存的区块；卡片内表单再次变脏后由卡片自行隐藏提示。 */
  const savedSection = ref<'adoption' | 'commission' | 'content' | null>(null)

  async function refresh(): Promise<AdminSiteContentDto | null> {
    try {
      const result = await adminApi('/api/admin/v1/site/home/content', {
        schema: adminSiteContentResponseSchema,
      })
      content.value = result.data
      return result.data
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      throw error
    }
  }

  async function load() {
    pageStatus.value = 'loading'
    conflictNotice.value = null
    try {
      await refresh()
      pageStatus.value = 'ready'
    }
    catch {
      pageStatus.value = 'error'
    }
  }

  async function runMutation(
    request: () => Promise<AdminSiteContentDto>,
    section: 'adoption' | 'commission' | 'content',
    errorText: string,
  ): Promise<string | null> {
    if (!content.value || mutating.value) {
      return null
    }
    mutating.value = true
    try {
      content.value = await request()
      conflictNotice.value = null
      savedSection.value = section
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        conflictNotice.value = '站点内容已在其他地方变化，已重新加载最新值；请确认当前内容后重试。'
        await refresh()
        return '未提交：版本已变化，请确认当前内容后重试。'
      }
      if (error instanceof AdminApiError && error.status === 400) {
        return '内容未通过服务端校验，请检查各字段后重试。'
      }
      return errorText
    }
    finally {
      mutating.value = false
    }
  }

  async function saveContent(payload: SiteContentPayload): Promise<string | null> {
    const expectedVersion = content.value?.version ?? 0
    return await runMutation(async () => {
      const result = await adminApi('/api/admin/v1/site/home/content', {
        method: 'PUT',
        body: { expectedVersion, payload },
        schema: adminSiteContentResponseSchema,
      })
      return result.data
    }, 'content', '保存站点内容失败，请稍后重试。')
  }

  async function saveStatus(
    kind: SiteBusinessStatusKind,
    payload: SiteStatusPayload,
  ): Promise<string | null> {
    const expectedVersion = content.value?.statuses[kind]?.version ?? 0
    return await runMutation(async () => {
      const result = await adminApi(`/api/admin/v1/site/home/business-statuses/${kind}`, {
        method: 'PUT',
        body: { expectedVersion, payload },
        schema: adminSiteContentResponseSchema,
      })
      return result.data
    }, kind, '保存营业状态失败，请稍后重试。')
  }

  return {
    conflictNotice,
    content,
    load,
    mutating,
    pageStatus,
    savedSection,
    saveContent,
    saveStatus,
  }
}
