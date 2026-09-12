<script setup lang="ts">
import { SITE_LOCALES } from '~~/shared/constants/site-locales'
import { adminSiteCopyResponseSchema, siteCopyLocaleSchema, siteCopySectionSchema, type AdminSiteCopy, type SiteCopySection } from '~~/shared/schemas/site-copy'

const emit = defineEmits<{ saved: [] }>()
const api = useAdminApi()
const locale = ref('zh-CN')
const content = ref<AdminSiteCopy | null>(null)
const loading = ref(false)
const busySections = reactive(new Set<SiteCopySection>())
function busy(section: SiteCopySection, value: boolean) { if (value) busySections.add(section); else busySections.delete(section) }
const error = ref('')
const root = useTemplateRef<HTMLElement>('root')
async function load() {
  loading.value = true
  error.value = ''
  try { content.value = (await api(`/api/admin/v1/site/home/content/localized/${locale.value}`, { schema: adminSiteCopyResponseSchema })).data }
  catch { error.value = '文案加载失败，请重试。' }
  finally { loading.value = false }
}
async function choose(value: string) {
  if (loading.value || busySections.size || locale.value === value) return
  const next = siteCopyLocaleSchema.parse(value)
  if (root.value?.querySelector('[data-dirty="true"]') && !window.confirm('当前语言有未保存的文案。放弃修改并切换语言？')) {
    return
  }
  locale.value = next
  content.value = null
  await load()
}
function saved(data: AdminSiteCopy, section: SiteCopySection) {
  if (!content.value) return
  Object.assign(content.value.sections, { [section]: data.sections[section] })
  content.value.source = data.source
  emit('saved')
}
onMounted(load)
defineExpose({ reload: load })
</script>

<template>
  <section ref="root" class="localized-content" aria-label="公开文案">
    <div class="localized-content__language">
      <span id="content-language-label">编辑语言</span>
      <div class="admin-segmented" role="group" aria-labelledby="content-language-label">
        <button
v-for="language in SITE_LOCALES" :key="language.code" type="button" class="admin-segmented__item"
          :aria-pressed="locale === language.code" :disabled="loading || busySections.size > 0" @click="choose(language.code)">
          {{ language.name }}
        </button>
      </div>
      <p>每个分区单独保存。语言切换只影响公开文案，营业与联系配置由所有语言共用。</p>
    </div>
    <p v-if="loading" role="status">正在加载文案…</p>
    <div v-if="error" role="alert">{{ error }} <AdminAction size="small" @click="load">重试</AdminAction></div>
    <template v-if="content">
      <AdminSiteLocalizedCopyCard
        v-for="section in siteCopySectionSchema.options" :key="`${locale}-${section}`"
        :content="content" :section="section" @saved="saved" @busy="busy"
      />
    </template>
  </section>
</template>

<style scoped>
.localized-content { display: grid; gap: var(--admin-space-3); }
.localized-content__language { display: flex; align-items: center; flex-wrap: wrap; gap: var(--admin-space-2); }
.localized-content__language p { flex-basis: 100%; margin: 0; font-size: var(--admin-font-sm); color: var(--admin-text-secondary); }
</style>
