<script setup lang="ts">
import type {
  SiteBusinessStatusKind,
  SiteContentSection,
} from '~~/shared/types/contracts'
import type {
  SiteContentSectionPayloads,
  SiteStatusPayload,
} from '~/composables/useAdminSiteContent'

definePageMeta({ layout: 'admin', ssr: false })
useSeoMeta({ title: '文案配置', robots: 'noindex, nofollow' })

const {
  conflictNotice,
  content,
  isMutating,
  load,
  pageStatus,
  savedSection,
  saveSection,
  saveStatus,
} = useAdminSiteContent()

const actionError = ref<string | null>(null)
const errorDialogOpen = computed(() => Boolean(actionError.value || conflictNotice.value))
function closeErrorDialog() {
  actionError.value = null
  conflictNotice.value = null
}
async function onSaveStatus(kind: SiteBusinessStatusKind, payload: SiteStatusPayload) {
  actionError.value = await saveStatus(kind, payload)
}
async function onSaveSection<S extends SiteContentSection>(
  section: S,
  payload: SiteContentSectionPayloads[S],
) {
  actionError.value = await saveSection(section, payload)
}
onMounted(() => void load())
</script>

<template>
  <AdminShell current="content">
    <div class="content-admin" data-testid="content-admin">
      <header class="content-admin__header">
        <h1 class="content-admin__title">文案配置</h1>
        <p class="content-admin__meta">
          按业务分区独立维护和保存。一个 Card 的草稿、冲突或保存不会覆盖其他分区。
        </p>
      </header>

      <div v-if="pageStatus === 'loading'" class="content-admin__state" role="status">
        正在加载文案配置…
      </div>
      <div v-else-if="pageStatus === 'error'" class="content-admin__state" role="alert">
        <p>文案配置加载失败。</p>
        <button type="button" class="content-admin__button" @click="load">重试</button>
      </div>

      <template v-else-if="content">
        <section class="content-admin__card" aria-labelledby="business-statuses-title">
          <h2 id="business-statuses-title" class="content-admin__card-title">营业状态</h2>
          <p class="content-admin__meta">
            委托与领养各自独立保存，并直接显示在首页统一业务入口卡中。
          </p>
          <div class="content-admin__statuses">
            <AdminSiteBusinessStatusCard
              kind="commission"
              :status="content.statuses.commission"
              :mutating="isMutating('status-commission')"
              :saved="savedSection === 'status-commission'"
              @save="payload => onSaveStatus('commission', payload)"
            />
            <AdminSiteBusinessStatusCard
              kind="adoption"
              :status="content.statuses.adoption"
              :mutating="isMutating('status-adoption')"
              :saved="savedSection === 'status-adoption'"
              @save="payload => onSaveStatus('adoption', payload)"
            />
          </div>
        </section>

        <AdminSiteContentCard
          :content="content"
          :is-mutating="isMutating"
          :saved-section="savedSection"
          @save="onSaveSection"
        />
      </template>

      <AdminConfirmDialog
        :open="errorDialogOpen"
        title="操作未完成"
        confirm-label="知道了"
        :show-cancel="false"
        @confirm="closeErrorDialog"
        @cancel="closeErrorDialog"
      >
        <p v-if="actionError" role="alert">{{ actionError }}</p>
        <p v-if="conflictNotice" role="alert">{{ conflictNotice }}</p>
      </AdminConfirmDialog>
    </div>
  </AdminShell>
</template>

<style scoped>
.content-admin {
  display: grid;
  gap: var(--admin-space-4);
  max-width: 88rem;
}
.content-admin__header { display: grid; gap: var(--admin-space-1); }
.content-admin__title,
.content-admin__card-title,
.content-admin__meta,
.content-admin__state p { margin: 0; }
.content-admin__title { font-size: var(--admin-font-lg); font-weight: 700; }
.content-admin__meta {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}
.content-admin__state,
.content-admin__card {
  padding: var(--admin-space-4);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}
.content-admin__state {
  display: grid;
  justify-items: start;
  gap: var(--admin-space-3);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}
.content-admin__card { display: grid; gap: var(--admin-space-3); }
.content-admin__card-title { font-size: var(--admin-font-md); font-weight: 600; }
.content-admin__statuses { display: grid; gap: var(--admin-space-3); }
.content-admin__button {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-xs);
  cursor: pointer;
}
@media (min-width: 1024px) {
  .content-admin__statuses { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}
</style>
