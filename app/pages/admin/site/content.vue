<script setup lang="ts">
import type { SiteBusinessStatusKind } from '~~/shared/types/contracts'
import type {
  SiteContentSection,
  SiteStatusPayload,
} from '~/composables/useAdminSiteContent'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '站点配置',
  robots: 'noindex, nofollow',
})

/**
 * T34-F3：页面只负责布局、初次加载和全局错误边界。
 * 每个分区 Card 自己管理草稿、校验、保存和冲突，互不影响。
 */
const {
  conflictSection,
  content,
  load,
  pageStatus,
  refreshConflict,
  refresh,
  savedSection,
  saveSection,
  saveStatus,
  savingSection,
} = useAdminSiteContent()

const actionError = ref<string | null>(null)
const group = ref('copy')
const localized = useTemplateRef<{ reload: () => Promise<void> }>('localized')
const root = useTemplateRef<HTMLElement>('contentRoot')
const GROUPS = [{ key: 'copy', label: '公开文案' }, { key: 'shared', label: '营业与联系' }, { key: 'legal', label: '条款与隐私' }]
function hasDraft() { return Boolean(root.value?.querySelector('[data-dirty="true"], [data-saving="true"]')) }
function beforeUnload(event: BeforeUnloadEvent) {
  if (hasDraft()) { event.preventDefault(); event.returnValue = '' }
}
onBeforeRouteLeave(() => !hasDraft() || window.confirm('有未保存的站点配置。确定离开？'))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

function closeErrorDialog() {
  actionError.value = null
}

async function onSaveStatus(kind: SiteBusinessStatusKind, payload: SiteStatusPayload) {
  actionError.value = await saveStatus(kind, payload)
  await localized.value?.reload()
}

async function onSaveSection(
  section: SiteContentSection,
  payload: Record<string, unknown>,
) {
  actionError.value = await saveSection(section, payload)
}

async function onSectionConflict(section: SiteContentSection) {
  actionError.value = await refreshConflict(section)
}

onMounted(async () => {
  await load()
  await nextTick()
  window.addEventListener('beforeunload', beforeUnload)
  const hash = window.location.hash
  if (['#content-contact', '#content-status'].includes(hash)) group.value = 'shared'
  if (['#content-terms', '#content-privacy'].includes(hash)) group.value = 'legal'
  await nextTick()
  if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
})
</script>

<template>
  <AdminShell current="content">
    <span v-if="pageStatus !== 'ready'" id="content-contact" aria-hidden="true" />
    <div ref="contentRoot" class="content-admin" data-testid="content-admin">
      <header class="content-admin__header">
        <h1 class="content-admin__title">站点配置</h1>
      </header>

      <div v-if="pageStatus === 'loading'" class="content-admin__state" role="status">
        正在加载站点配置…
      </div>
      <div v-else-if="pageStatus === 'error'" class="content-admin__state" role="alert">
        <p>站点配置加载失败。</p>
        <AdminAction size="small" @click="load">重试</AdminAction>
      </div>

      <template v-else-if="content">
        <nav class="admin-segmented" aria-label="站点配置分区">
          <button v-for="item in GROUPS" :key="item.key" type="button" class="admin-segmented__item" :aria-pressed="group === item.key" @click="group = item.key">{{ item.label }}</button>
        </nav>
        <div v-show="group === 'copy'">
          <AdminSiteLocalizedContent ref="localized" @saved="refresh" />
        </div>
        <section
          v-show="group === 'shared'"
          id="content-status"
          class="content-admin__group content-admin__anchor"
          aria-labelledby="business-statuses-title"
        >
          <h2 id="business-statuses-title" class="content-admin__group-title">营业状态</h2>
          <div class="content-admin__statuses">
            <AdminSiteBusinessStatusCard
              kind="commission"
              tone-only
              :status="content.statuses.commission"
              :mutating="savingSection === 'commission'"
              :saved="savedSection === 'commission'"
              @save="payload => onSaveStatus('commission', payload)"
            />
          </div>
        </section>

        <section class="content-admin__group" aria-label="其他配置">
          <div class="content-admin__sections">
            <AdminSiteLegalContentCard
              v-show="group === 'legal'"
              id="content-terms"
              class="content-admin__anchor"
              section="terms"
              :content="content"
              :conflict-section="conflictSection"
              :saved-section="savedSection"
              :saving-section="savingSection"
              @save="payload => onSaveSection('terms', payload)"
            />
            <AdminSiteLegalContentCard
              v-show="group === 'legal'"
              id="content-privacy"
              class="content-admin__anchor"
              section="privacy"
              :content="content"
              :conflict-section="conflictSection"
              :saved-section="savedSection"
              :saving-section="savingSection"
              @save="payload => onSaveSection('privacy', payload)"
            />
            <AdminSiteOfficialChannelsCard
              v-show="group === 'shared'"
              id="content-contact"
              class="content-admin__anchor"
              :content="content"
              :conflict-section="conflictSection"
              :saved-section="savedSection"
              :saving-section="savingSection"
              @conflict="onSectionConflict('contact')"
              @save="payload => onSaveSection('contact', payload)"
            />
          </div>
        </section>
      </template>

      <AdminConfirmDialog
        :open="Boolean(actionError)"
        title="操作未完成"
        confirm-label="知道了"
        :show-cancel="false"
        @confirm="closeErrorDialog"
        @cancel="closeErrorDialog"
      >
        <p v-if="actionError" role="alert">{{ actionError }}</p>
      </AdminConfirmDialog>
    </div>
  </AdminShell>
</template>

<style scoped>
.content-admin {
  display: grid;
  gap: var(--admin-space-4);
  max-width: 72rem;
}

.content-admin__header,
.content-admin__group {
  display: grid;
  gap: var(--admin-space-2);
}

.content-admin__title,
.content-admin__group-title,
.content-admin__meta,
.content-admin__state p {
  margin: 0;
}

.content-admin__title {
  font-size: var(--admin-font-lg);
  font-weight: 700;
}

.content-admin__group-title {
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.content-admin__meta {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.content-admin__state {
  display: grid;
  justify-items: start;
  gap: var(--admin-space-3);
  padding: var(--admin-space-4);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.content-admin__statuses,
.content-admin__sections {
  display: grid;
  gap: var(--admin-space-3);
}

.content-admin__anchor {
  scroll-margin-top: calc(var(--admin-touch-target) + var(--admin-space-4));
}
</style>
