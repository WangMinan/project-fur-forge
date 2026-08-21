<script setup lang="ts">
import {
  COMMISSION_DELETE_CONFIRMATION,
  commissionDeletionResponseSchema,
} from '~~/shared/schemas/commission'
import type {
  CommissionDeletionBlocker,
  CommissionDeletionResultDto,
  CommissionSubmissionStatus,
} from '~~/shared/types/contracts'

const props = defineProps<{
  submissionId: string
  status: CommissionSubmissionStatus
}>()

const emit = defineEmits<{
  deleted: []
}>()

const adminApi = useAdminApi()
const preview = shallowRef<CommissionDeletionResultDto | null>(null)
const dialogOpen = shallowRef(false)
const previewing = shallowRef(false)
const executing = shallowRef(false)
const error = shallowRef<string | null>(null)

const BLOCKER_LABELS: Record<CommissionDeletionBlocker, string> = {
  ASSET_RELATION_INVALID: '设定图资产关系异常',
  EXTERNAL_REFERENCE_FOUND: '发现作品、Hero、水印或其它 owner 引用',
  PRIVATE_VARIANT_INVALID: '发现非私有或归属异常的派生图',
  STATUS_NOT_REJECTED: '只能从管理端删除已拒绝申请',
  STORAGE_INSPECTION_FAILED: '私有对象盘点失败',
  UPLOAD_SESSION_RELATION_INVALID: '上传会话关系异常',
}

const databaseRowCount = computed(() => preview.value
  ? Object.values(preview.value.databaseRows).reduce((total, value) => total + value, 0)
  : 0)
const canExecute = computed(() => preview.value?.status === 'ready'
  && preview.value.blockers.length === 0)

async function requestPreview() {
  if (props.status !== 'rejected' || previewing.value || executing.value) {
    return
  }
  previewing.value = true
  error.value = null
  try {
    const response = await adminApi(
      `/api/admin/v1/commissions/${props.submissionId}/deletion`,
      {
        method: 'POST',
        body: { execute: false },
        schema: commissionDeletionResponseSchema,
      },
    )
    preview.value = response.data
    dialogOpen.value = true
  }
  catch {
    error.value = '删除盘点失败，未修改任何数据。'
  }
  finally {
    previewing.value = false
  }
}

async function executeDeletion() {
  if (!canExecute.value || executing.value) {
    return
  }
  executing.value = true
  error.value = null
  try {
    const response = await adminApi(
      `/api/admin/v1/commissions/${props.submissionId}/deletion`,
      {
        method: 'POST',
        body: {
          execute: true,
          confirmation: COMMISSION_DELETE_CONFIRMATION,
        },
        schema: commissionDeletionResponseSchema,
      },
    )
    if (response.data.status !== 'deleted'
      && response.data.status !== 'already_deleted') {
      throw new Error('deletion did not complete')
    }
    dialogOpen.value = false
    emit('deleted')
  }
  catch {
    error.value = '删除失败，数据库关系已保留或可安全重入，请重试。'
  }
  finally {
    executing.value = false
  }
}
</script>

<template>
  <div v-if="status === 'rejected'" class="commission-deletion">
    <AdminAction
      variant="danger"
      size="small"
      :disabled="executing"
      :loading="previewing"
      loading-label="正在盘点…"
      @click="requestPreview"
    >删除申请数据</AdminAction>
    <p v-if="error && !dialogOpen" class="commission-deletion__error" role="alert">
      {{ error }}
    </p>

    <AdminConfirmDialog
      :open="dialogOpen"
      title="确认删除这一条申请？"
      confirm-label="确认永久删除"
      confirm-loading-label="正在删除…"
      tone="danger"
      :busy="executing"
      :confirm-disabled="!canExecute"
      @confirm="executeDeletion"
      @cancel="dialogOpen = false"
    >
      <template v-if="preview">
        <p>dry-run 只返回脱敏计数，不显示手机号、QQ、Object Key 或完整标识。</p>
        <ul class="commission-deletion__counts">
          <li>数据库直接关联行：{{ databaseRowCount }}</li>
          <li>私有对象 Key：{{ preview.privateObjects.keys }}</li>
          <li>当前对象：{{ preview.privateObjects.current }}</li>
          <li>历史版本 / delete marker：{{ preview.privateObjects.versions }} / {{ preview.privateObjects.deleteMarkers }}</li>
        </ul>
        <ul v-if="preview.blockers.length > 0" class="commission-deletion__blockers" role="alert">
          <li v-for="blocker in preview.blockers" :key="blocker">
            {{ BLOCKER_LABELS[blocker] }}
          </li>
        </ul>
        <p v-else>执行后无法从站内撤销；请确认上述单条范围。</p>
        <p v-if="error" class="commission-deletion__error" role="alert">{{ error }}</p>
      </template>
    </AdminConfirmDialog>
  </div>
</template>

<style scoped>
.commission-deletion {
  display: grid;
  justify-items: start;
  gap: var(--admin-space-2);
}

.commission-deletion__counts,
.commission-deletion__blockers {
  margin: var(--admin-space-3) 0;
  padding-inline-start: var(--admin-space-5);
}

.commission-deletion__blockers,
.commission-deletion__error {
  color: var(--admin-status-error);
}

.commission-deletion__error {
  margin: 0;
  font-size: var(--admin-font-xs);
}
</style>
