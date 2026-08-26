import { adminSiteContentResponseSchema } from '~~/shared/schemas/site-content'
import type {
  AdminSiteContentDto,
  SiteBusinessStatusKind,
} from '~~/shared/types/contracts'
import { AdminApiError } from './useAdminApi'

/**
 * T34-F3 分区文案管理：每个分区独立版本、独立保存、独立冲突。
 * 409 时保留本地草稿，只刷新服务端最新值供管理员对比，不自动把旧草稿套上新版本重发。
 */
export type SiteContentSection =
  | 'about'
  | 'commission'
  | 'contact'
  | 'privacy'
  | 'terms'

export type SiteSaveSection = SiteBusinessStatusKind | SiteContentSection

export interface SiteStatusPayload {
  tone: 'closed' | 'open'
  label: string
}

const SECTION_VERSION_KEYS = {
  'commission': 'commission',
  'about': 'about',
  'terms': 'terms',
  'privacy': 'privacy',
  'contact': 'contact',
} as const satisfies Record<
  SiteContentSection,
  keyof AdminSiteContentDto['sectionVersions']
>

export function useAdminSiteContent() {
  const adminApi = useAdminApi()

  const content = ref<AdminSiteContentDto | null>(null)
  const pageStatus = ref<'error' | 'loading' | 'ready'>('loading')
  /** 每个分区独立的保存中状态：一个 Card 保存时其它 Card 不被禁用。 */
  const savingSection = ref<SiteSaveSection | null>(null)
  const savedSection = ref<SiteSaveSection | null>(null)
  /** 分区级冲突：值为发生冲突的分区，Card 内展示服务端最新值供对比。 */
  const conflictSection = ref<SiteSaveSection | null>(null)

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
    conflictSection.value = null
    try {
      await refresh()
      pageStatus.value = 'ready'
    }
    catch {
      pageStatus.value = 'error'
    }
  }

  async function refreshConflict(section: SiteSaveSection): Promise<string | null> {
    conflictSection.value = section
    try {
      await refresh()
      return null
    }
    catch {
      return '最新内容加载失败，请刷新页面后重试。'
    }
  }

  async function runMutation(
    request: () => Promise<AdminSiteContentDto>,
    section: SiteSaveSection,
    errorText: string,
  ): Promise<string | null> {
    if (!content.value || savingSection.value) {
      return null
    }
    savingSection.value = section
    try {
      content.value = await request()
      if (conflictSection.value === section) {
        conflictSection.value = null
      }
      savedSection.value = section
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        conflictSection.value = section
        // 只刷新服务端值；Card 保留本地草稿，由管理员选择采用最新值或重试。
        await refresh()
        return null
      }
      if (error instanceof AdminApiError && error.status === 400) {
        return '内容未通过服务端校验，请检查各字段后重试。'
      }
      return errorText
    }
    finally {
      savingSection.value = null
    }
  }

  function saveSection(
    section: SiteContentSection,
    payload: Record<string, unknown>,
  ): Promise<string | null> {
    const expectedVersion = content.value
      ?.sectionVersions[SECTION_VERSION_KEYS[section]] ?? 0
    return runMutation(async () => {
      const result = await adminApi(
        `/api/admin/v1/site/home/content/${section}`,
        {
          method: 'PUT',
          body: { expectedVersion, payload },
          schema: adminSiteContentResponseSchema,
        },
      )
      return result.data
    }, section, '保存失败，请稍后重试。')
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
    conflictSection,
    content,
    load,
    pageStatus,
    refreshConflict,
    savedSection,
    saveSection,
    saveStatus,
    savingSection,
  }
}
