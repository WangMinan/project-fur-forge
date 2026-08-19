<script setup lang="ts">
const props = withDefaults(defineProps<{
  canCancel?: boolean
  canRetry?: boolean
  cancelLabel?: string
  completedCount?: number | null
  detail?: string | null
  label: string
  max?: number | null
  mode: 'determinate' | 'indeterminate' | 'stage'
  retryLabel?: string
  showElapsed?: boolean
  stage?: string | null
  startedAt?: number | string | null
  status?: 'active' | 'cancelled' | 'error' | 'success'
  totalCount?: number | null
  value?: number | null
}>(), {
  canCancel: false,
  canRetry: false,
  cancelLabel: '取消',
  completedCount: null,
  detail: null,
  max: null,
  retryLabel: '重试',
  showElapsed: false,
  stage: null,
  startedAt: null,
  status: 'active',
  totalCount: null,
  value: null,
})

const emit = defineEmits<{
  cancel: []
  retry: []
}>()

const now = shallowRef(Date.now())
const mountedAt = Date.now()
let timer: ReturnType<typeof setInterval> | null = null
let mounted = false

const startedAtMs = computed(() => {
  if (typeof props.startedAt === 'number') {
    return props.startedAt
  }
  if (typeof props.startedAt === 'string') {
    const parsed = Date.parse(props.startedAt)
    return Number.isFinite(parsed) ? parsed : mountedAt
  }
  return mountedAt
})

const elapsedSeconds = computed(() => Math.max(
  0,
  Math.floor((now.value - startedAtMs.value) / 1_000),
))
const elapsedLabel = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
  const seconds = elapsedSeconds.value % 60
  return minutes > 0
    ? `${minutes} 分 ${seconds.toString().padStart(2, '0')} 秒`
    : `${seconds} 秒`
})
const determinate = computed(() => props.mode === 'determinate'
  && props.value !== null
  && props.max !== null
  && props.max > 0)
const countedStage = computed(() => props.mode === 'stage'
  && props.completedCount !== null
  && props.totalCount !== null
  && props.totalCount > 0)
const percent = computed(() => determinate.value
  ? Math.round(Math.min(props.value! / props.max!, 1) * 100)
  : null)
const progressValue = computed(() => {
  if (props.status === 'success') {
    return 1
  }
  if (determinate.value) {
    return props.value ?? undefined
  }
  if (countedStage.value) {
    return props.completedCount ?? undefined
  }
  return undefined
})
const progressMax = computed(() => {
  if (props.status === 'success') {
    return 1
  }
  if (determinate.value) {
    return props.max ?? undefined
  }
  if (countedStage.value) {
    return props.totalCount ?? undefined
  }
  return undefined
})

function syncTimer() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  if (mounted && props.showElapsed && props.status === 'active') {
    now.value = Date.now()
    timer = setInterval(() => {
      now.value = Date.now()
    }, 1_000)
  }
}

watch(() => [props.showElapsed, props.status], syncTimer)

onMounted(() => {
  mounted = true
  syncTimer()
})

onScopeDispose(() => {
  mounted = false
  if (timer !== null) {
    clearInterval(timer)
  }
})
</script>

<template>
  <div
    class="admin-task-progress"
    data-testid="admin-task-progress"
    :data-mode="mode"
    :data-status="status"
    :role="status === 'error' ? 'alert' : 'status'"
    :aria-live="status === 'error' ? 'assertive' : 'polite'"
  >
    <div class="admin-task-progress__head">
      <strong class="admin-task-progress__label">{{ label }}</strong>
      <span v-if="showElapsed" class="admin-task-progress__elapsed">
        已等待 {{ elapsedLabel }}
      </span>
    </div>
    <div v-if="stage || percent !== null || countedStage" class="admin-task-progress__facts">
      <span v-if="stage">{{ stage }}</span>
      <span v-if="percent !== null">{{ percent }}%</span>
      <span v-else-if="countedStage">{{ completedCount }} / {{ totalCount }}</span>
    </div>
    <progress
      v-if="status === 'active' || status === 'success'"
      class="admin-task-progress__bar"
      :value="progressValue"
      :max="progressMax"
      :aria-label="stage ? `${label}：${stage}` : label"
    />
    <p v-if="detail" class="admin-task-progress__detail">{{ detail }}</p>
    <div v-if="canRetry || canCancel" class="admin-task-progress__actions">
      <AdminAction v-if="canRetry" size="small" @click="emit('retry')">
        {{ retryLabel }}
      </AdminAction>
      <AdminAction v-if="canCancel" size="small" @click="emit('cancel')">
        {{ cancelLabel }}
      </AdminAction>
    </div>
  </div>
</template>

<style scoped>
.admin-task-progress {
  display: grid;
  gap: var(--admin-space-2);
  width: 100%;
  padding: var(--admin-space-3);
  color: var(--admin-text-secondary);
  background: var(--admin-bg-subtle);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.admin-task-progress[data-status='success'] {
  color: var(--admin-status-success);
  background: var(--admin-status-success-soft);
  border-color: color-mix(in srgb, var(--admin-status-success) 35%, transparent);
}

.admin-task-progress[data-status='error'] {
  color: var(--admin-status-error);
  background: var(--admin-status-error-soft);
  border-color: color-mix(in srgb, var(--admin-status-error) 35%, transparent);
}

.admin-task-progress[data-status='cancelled'] {
  color: var(--admin-text-tertiary);
}

.admin-task-progress__head,
.admin-task-progress__facts,
.admin-task-progress__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--admin-space-2) var(--admin-space-3);
}

.admin-task-progress__head {
  justify-content: space-between;
}

.admin-task-progress__label {
  color: currentcolor;
  font-size: var(--admin-font-sm);
}

.admin-task-progress__elapsed {
  color: var(--admin-text-tertiary);
  white-space: nowrap;
}

.admin-task-progress__facts {
  justify-content: space-between;
}

.admin-task-progress__bar {
  width: 100%;
  height: 0.5rem;
  accent-color: currentcolor;
}

.admin-task-progress__detail {
  margin: 0;
}

.admin-task-progress__actions {
  justify-content: flex-end;
}
</style>
