<script setup lang="ts">
import type { CommissionSubmissionListItemDto } from '~~/shared/types/contracts'
import { COMMISSION_EMAIL_LABELS } from '~/utils/commission-email'

defineProps<{ items: CommissionSubmissionListItemDto[] }>()
const emit = defineEmits<{ deleted: [id: string] }>()

const statuses = {
  pending: { label: '待处理', tone: 'warning' },
  accepted: { label: '已接受', tone: 'success' },
  rejected: { label: '已拒绝', tone: 'neutral' },
} as const

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
</script>

<template>
  <AdminListTable
    label="委托申请表格"
    :columns="['申请人', '物种', '提交时间', '处理状态', '回执编号', '邮件通知', '操作']"
  >
    <tr v-for="item in items" :key="item.id" class="commission-inbox__row">
      <td>
        <NuxtLink :to="`/admin/commissions/${item.id}`" class="commission-inbox__item">
          {{ item.nickname }}
        </NuxtLink>
      </td>
      <td class="commission-list__species">{{ item.species ?? '物种待补录' }}</td>
      <td class="commission-list__muted"><time :datetime="item.createdAt">{{ formatTime(item.createdAt) }}</time></td>
      <td><AdminStatusBadge v-bind="statuses[item.status]" /></td>
      <td class="commission-list__muted">{{ item.receiptCode }}</td>
      <td class="commission-list__muted">{{ COMMISSION_EMAIL_LABELS[item.emailNotificationStatus] }}</td>
      <td>
        <div class="commission-list__actions">
          <AdminAction :to="`/admin/commissions/${item.id}`" variant="text">查看详情</AdminAction>
          <AdminCommissionDeletionAction compact :submission-id="item.id" :status="item.status" @deleted="emit('deleted', item.id)" />
        </div>
      </td>
    </tr>
    <template #mobile>
      <ul class="commission-list__cards" aria-label="委托申请列表">
        <li v-for="item in items" :key="item.id" class="commission-inbox__row commission-list__card">
          <div class="commission-list__heading">
            <div>
              <NuxtLink :to="`/admin/commissions/${item.id}`" class="commission-inbox__item">{{ item.nickname }}</NuxtLink>
            </div>
            <AdminStatusBadge v-bind="statuses[item.status]" />
          </div>
          <dl class="commission-list__details">
            <div><dt>物种</dt><dd>{{ item.species ?? '物种待补录' }}</dd></div>
            <div><dt>提交时间</dt><dd><time :datetime="item.createdAt">{{ formatTime(item.createdAt) }}</time></dd></div>
            <div><dt>回执编号</dt><dd>{{ item.receiptCode }}</dd></div>
            <div><dt>邮件通知</dt><dd>{{ COMMISSION_EMAIL_LABELS[item.emailNotificationStatus] }}</dd></div>
          </dl>
          <div class="commission-list__actions">
            <AdminAction :to="`/admin/commissions/${item.id}`" variant="text">查看详情</AdminAction>
            <AdminCommissionDeletionAction compact :submission-id="item.id" :status="item.status" @deleted="emit('deleted', item.id)" />
          </div>
        </li>
      </ul>
    </template>
  </AdminListTable>
</template>

<style scoped>
.commission-inbox__item { display: block; max-width: 12rem; color: var(--admin-text-primary); font-weight: 600; overflow-wrap: anywhere; }
.commission-inbox__item:hover { color: var(--admin-accent-primary); }
.commission-list__species { max-width: 10rem; color: var(--admin-text-secondary); overflow-wrap: anywhere; }
.commission-list__muted { color: var(--admin-text-secondary); white-space: nowrap; }
.commission-list__actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--admin-space-3); }
.commission-list__actions :deep(.admin-action) { min-height: var(--admin-touch-target); min-width: var(--admin-touch-target); white-space: nowrap; }
.commission-inbox__row td .commission-list__actions { flex-wrap: nowrap; }
.commission-list__cards { display: grid; gap: var(--admin-space-3); margin: 0; padding: 0; list-style: none; }
.commission-list__card { padding: var(--admin-space-4); border: 1px solid var(--admin-border-secondary); border-radius: var(--admin-radius-md); background: var(--admin-bg-primary); }
.commission-list__heading { display: flex; justify-content: space-between; align-items: start; gap: var(--admin-space-3); }
.commission-list__details { display: grid; gap: var(--admin-space-2); font-size: var(--admin-font-sm); }
.commission-list__details div { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--admin-space-4); }
.commission-list__details dt { color: var(--admin-text-secondary); }
.commission-list__details dd { margin: 0; overflow-wrap: anywhere; }
</style>
