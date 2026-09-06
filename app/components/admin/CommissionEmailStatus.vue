<script setup lang="ts">
import { commissionEmailResponseSchema } from '~~/shared/schemas/commission-email'
import type { z } from 'zod'
import { COMMISSION_EMAIL_LABELS, COMMISSION_EMAIL_ERRORS } from '~/utils/commission-email'

const props = defineProps<{ submissionId: string }>()
const api = useAdminApi()
const state = ref<z.infer<typeof commissionEmailResponseSchema>['data'] | null>(null)
const busy = ref(false)
const error = ref('')
async function load(notificationId?: string) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const response = await api(`/api/admin/v1/commissions/${props.submissionId}/${notificationId ? 'email-retry' : 'email'}`, {
      method: notificationId ? 'POST' : 'GET',
      ...(notificationId ? { body: { notificationId } } : {}),
      schema: commissionEmailResponseSchema,
    })
    state.value = response.data
  }
  catch { error.value = '通知信息获取或重试失败，请刷新后重试。' }
  finally { busy.value = false }
}
onMounted(() => void load())
</script>

<template>
  <section class="commission-email" aria-labelledby="commission-email-title">
    <h2 id="commission-email-title">委托邮件通知</h2>
    <p>邮件包含完整申请资料及私有设定图，仅供内部处理。</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="state?.smtpStatus !== 'ready' && state" role="status">
      {{ state.smtpStatus === 'invalid' ? '邮件配置不完整或无效，请联系维护人员。' : '邮件发送未启用，已有待发通知暂停。' }}
    </p>
    <template v-if="state">
      <p role="status">{{ COMMISSION_EMAIL_LABELS[state.status] }}</p>
      <ul v-if="state.deliveries.length">
        <li v-for="delivery in state.deliveries" :key="delivery.id">
          <strong>{{ delivery.recipient }}</strong>
          <span>{{ COMMISSION_EMAIL_LABELS[delivery.status] }} · 已尝试 {{ delivery.attempts }} 次</span>
          <span v-if="delivery.errorCode">{{ COMMISSION_EMAIL_ERRORS[delivery.errorCode] }}</span>
          <AdminAction v-if="delivery.retryable" :disabled="busy" @click="load(delivery.id)">重试此邮箱</AdminAction>
        </li>
      </ul>
    </template>
    <AdminAction :disabled="busy" @click="load()">{{ busy ? '处理中…' : '刷新通知状态' }}</AdminAction>
  </section>
</template>

<style scoped>
.commission-email { display: grid; gap: var(--admin-space-3); padding: var(--admin-space-5); border: 1px solid var(--admin-border-secondary); border-radius: var(--admin-radius-lg); background: var(--admin-bg-primary); min-width: 0; }
.commission-email h2, .commission-email p { margin: 0; }
.commission-email ul { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--admin-space-4); }
.commission-email li { display: grid; gap: var(--admin-space-2); overflow-wrap: anywhere; }
.commission-email__hint { color: var(--admin-text-secondary); font-size: var(--admin-font-sm); }
</style>
