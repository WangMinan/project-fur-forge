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
  title: '文案配置',
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
  savedSection,
  saveSection,
  saveStatus,
  savingSection,
} = useAdminSiteContent()

const actionError = ref<string | null>(null)
const CONTENT_ANCHORS = [
  { href: '#content-status', label: '营业状态' },
  { href: '#content-commission', label: '委托' },
  { href: '#content-about', label: '关于' },
  { href: '#content-terms', label: '服务' },
  { href: '#content-privacy', label: '隐私' },
  { href: '#content-contact', label: '联系方式' },
] as const

function closeErrorDialog() {
  actionError.value = null
}

async function onSaveStatus(kind: SiteBusinessStatusKind, payload: SiteStatusPayload) {
  actionError.value = await saveStatus(kind, payload)
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

onMounted(() => void load())
</script>

<template>
  <AdminShell current="content">
    <div class="content-admin" data-testid="content-admin">
      <header class="content-admin__header">
        <h1 class="content-admin__title">文案配置</h1>
      </header>

      <div v-if="pageStatus === 'loading'" class="content-admin__state" role="status">
        正在加载文案配置…
      </div>
      <div v-else-if="pageStatus === 'error'" class="content-admin__state" role="alert">
        <p>文案配置加载失败。</p>
        <AdminAction size="small" @click="load">重试</AdminAction>
      </div>

      <template v-else-if="content">
        <nav class="content-admin__anchors" aria-label="文案配置分区">
          <AdminAction
            v-for="anchor in CONTENT_ANCHORS"
            :key="anchor.href"
            :href="anchor.href"
            variant="text"
            size="small"
          >{{ anchor.label }}</AdminAction>
        </nav>

        <section
          id="content-status"
          class="content-admin__group content-admin__anchor"
          aria-labelledby="business-statuses-title"
        >
          <h2 id="business-statuses-title" class="content-admin__group-title">营业状态</h2>
          <div class="content-admin__statuses">
            <AdminSiteBusinessStatusCard
              kind="commission"
              :status="content.statuses.commission"
              :mutating="savingSection === 'commission'"
              :saved="savedSection === 'commission'"
              @save="payload => onSaveStatus('commission', payload)"
            />
          </div>
        </section>

        <section class="content-admin__group" aria-labelledby="content-sections-title">
          <h2 id="content-sections-title" class="content-admin__group-title">页面内容</h2>
          <div class="content-admin__sections">
            <AdminSiteCommissionContentCard
              id="content-commission"
              class="content-admin__anchor"
              :content="content"
              :conflict-section="conflictSection"
              :saved-section="savedSection"
              :saving-section="savingSection"
              @save="payload => onSaveSection('commission', payload)"
            />
            <AdminSiteAboutContentCard
              id="content-about"
              class="content-admin__anchor"
              :content="content"
              :conflict-section="conflictSection"
              :saved-section="savedSection"
              :saving-section="savingSection"
              @save="payload => onSaveSection('about', payload)"
            />
            <AdminSiteLegalContentCard
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

.content-admin__anchors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--admin-space-2) var(--admin-space-4);
  padding-bottom: var(--admin-space-3);
  border-bottom: 1px solid var(--admin-border-secondary);
}

.content-admin__anchor {
  scroll-margin-top: calc(var(--admin-touch-target) + var(--admin-space-4));
}
</style>
