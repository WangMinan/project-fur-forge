import { adminSiteContentResponseSchema } from '~~/shared/schemas/site-content'
import type {
  AdminSiteContentDto,
  SiteBusinessStatusKind,
  SiteContentSection,
} from '~~/shared/types/contracts'
import { AdminApiError } from './useAdminApi'

export interface SiteContentSectionPayloads {
  commission: {
    intro: string | null
    estimateNote: string | null
    emailAction: string | null
  }
  faq: {
    faqs: Array<{ id: string, question: string, answer: string }>
  }
  about: {
    studioFacts: string | null
    makingScope: string | null
  }
  terms: { basicTerms: string | null }
  privacy: { privacyPolicy: string | null }
  contact: {
    email: string
    qq: string
    douyin: string | null
    antiScam: string | null
  }
}

export interface SiteStatusPayload {
  tone: 'closed' | 'limited' | 'open'
  label: string
  detail: string
}

type MutationSection = SiteContentSection | `status-${SiteBusinessStatusKind}`

export function useAdminSiteContent() {
  const adminApi = useAdminApi()
  const content = ref<AdminSiteContentDto | null>(null)
  const pageStatus = ref<'error' | 'loading' | 'ready'>('loading')
  const mutatingSections = ref<Partial<Record<MutationSection, boolean>>>({})
  const conflictNotice = ref<string | null>(null)
  const savedSection = ref<MutationSection | null>(null)

  const isMutating = (section: MutationSection) => Boolean(mutatingSections.value[section])

  function setMutating(section: MutationSection, value: boolean) {
    mutatingSections.value = value
      ? { ...mutatingSections.value, [section]: true }
      : Object.fromEntries(
          Object.entries(mutatingSections.value).filter(([key]) => key !== section),
        )
  }

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
    section: MutationSection,
    request: () => Promise<AdminSiteContentDto>,
    errorText: string,
  ): Promise<string | null> {
    if (!content.value || isMutating(section)) {
      return null
    }
    setMutating(section, true)
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
        conflictNotice.value = '该分区已在其他位置更新。已读取最新服务端值，并保留当前 Card 草稿；请核对后重试。'
        await refresh()
        return '未提交：该分区版本已变化，请核对当前草稿与最新内容。'
      }
      if (error instanceof AdminApiError && error.status === 400) {
        return '内容未通过服务端校验，请检查当前 Card 的字段。'
      }
      return errorText
    }
    finally {
      setMutating(section, false)
    }
  }

  async function saveSection<S extends SiteContentSection>(
    section: S,
    payload: SiteContentSectionPayloads[S],
  ): Promise<string | null> {
    const expectedVersion = content.value?.versions[section] ?? 0
    return await runMutation(section, async () => {
      const result = await adminApi(`/api/admin/v1/site/home/content/${section}`, {
        method: 'PUT',
        body: { expectedVersion, payload },
        schema: adminSiteContentResponseSchema,
      })
      return result.data
    }, '保存当前分区失败，请稍后重试。')
  }

  async function saveStatus(
    kind: SiteBusinessStatusKind,
    payload: SiteStatusPayload,
  ): Promise<string | null> {
    const section = `status-${kind}` as const
    const expectedVersion = content.value?.statuses[kind]?.version ?? 0
    return await runMutation(section, async () => {
      const result = await adminApi(`/api/admin/v1/site/home/business-statuses/${kind}`, {
        method: 'PUT',
        body: { expectedVersion, payload },
        schema: adminSiteContentResponseSchema,
      })
      return result.data
    }, '保存营业状态失败，请稍后重试。')
  }

  return {
    conflictNotice,
    content,
    isMutating,
    load,
    pageStatus,
    savedSection,
    saveSection,
    saveStatus,
  }
}
