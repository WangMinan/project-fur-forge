import type { AdminSiteContentDto } from '~~/shared/types/contracts'
import type { SiteContentSection } from './useAdminSiteContent'

/**
 * T34-F3 单个文案分区 Card 的本地状态机。
 * 每个 Card 自己管理 draft / dirty / saving / saved / conflict，页面层只负责布局。
 *
 * 409 行为：保留本地草稿，同时暴露服务端最新分区值（`latest`），
 * 由管理员选择「采用最新值」或保留草稿后人工重试。绝不自动把旧草稿套上新版本重发。
 */
export function useSiteContentSectionCard<T extends Record<string, unknown>>(options: {
  content: () => AdminSiteContentDto
  conflictSection: () => string | null
  extract: (dto: AdminSiteContentDto) => T
  savedSection: () => string | null
  savingSection: () => string | null
  section: SiteContentSection
}) {
  /**
   * 草稿必须与 `serverValue` 计算属性的缓存对象完全隔离。
   * 直接赋值会让两者共享同一引用：之后管理员的输入同时改到"服务端值"上，
   * dirty 判定永远为 false、保存按钮永远禁用。
   */
  // 分区草稿均来自严格 Zod DTO，只含 JSON 值。JSON 往返会递归解开 Vue Proxy；
  // structuredClone(toRaw(value)) 只解最外层，嵌套数组仍是 Proxy 时会抛 DataCloneError。
  const cloneOf = (value: T): T => JSON.parse(JSON.stringify(value)) as T

  const draft = ref(cloneOf(options.extract(options.content()))) as Ref<T>

  const serverValue = computed(() => options.extract(options.content()))
  const saving = computed(() => options.savingSection() === options.section)
  const conflict = computed(() => options.conflictSection() === options.section)
  const isDirty = computed(() =>
    JSON.stringify(draft.value) !== JSON.stringify(serverValue.value))
  /** 保存成功提示只在未再次变脏时显示。 */
  const saved = computed(() =>
    options.savedSection() === options.section && !isDirty.value)

  watch(serverValue, (next) => {
    // 无本地修改时直接跟随服务端；有修改时保留草稿，冲突提示由 `conflict` 驱动。
    if (!isDirty.value) {
      draft.value = cloneOf(next)
    }
  }, { deep: true })

  /** 冲突后管理员选择采用服务端最新值，丢弃本地草稿。 */
  function adoptLatest() {
    draft.value = cloneOf(serverValue.value)
  }

  function reset() {
    draft.value = cloneOf(serverValue.value)
  }

  return {
    adoptLatest,
    conflict,
    draft,
    isDirty,
    latest: serverValue,
    reset,
    saved,
    saving,
  }
}
