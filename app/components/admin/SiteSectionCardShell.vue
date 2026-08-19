<script setup lang="ts">
/**
 * T34-F3 分区 Card 外壳：统一标题、说明、保存按钮、脏/保存中/已保存/冲突呈现。
 * 各分区 Card 只提供字段插槽，不重复实现状态与冲突交互。
 */
const props = defineProps<{
  conflict: boolean
  dirty: boolean
  hasIssues: boolean
  hint?: string
  saved: boolean
  saving: boolean
  section: string
  title: string
}>()

const emit = defineEmits<{
  adoptLatest: []
  reset: []
  save: []
}>()

const canSave = computed(() =>
  props.dirty && !props.saving && !props.hasIssues)
</script>

<template>
  <section
    class="site-section"
    :data-section="section"
    :data-dirty="dirty ? 'true' : 'false'"
    :data-conflict="conflict ? 'true' : 'false'"
    :aria-labelledby="`site-section-${section}-title`"
    data-testid="site-section-card"
  >
    <header class="site-section__header">
      <h3 :id="`site-section-${section}-title`" class="site-section__title">
        {{ title }}
      </h3>
      <p v-if="hint" class="site-section__hint">{{ hint }}</p>
    </header>

    <div
      v-if="conflict"
      class="site-section__conflict"
      role="alert"
      data-testid="site-section-conflict"
    >
      <p class="site-section__conflict-text">
        这一部分已被其他地方保存过，下面显示的是服务端最新内容。
        你的修改仍然保留：可以选择改用最新内容，或核对后重新保存。
      </p>
      <div class="site-section__conflict-actions">
        <AdminAction
          size="small"
          data-testid="site-section-adopt-latest"
          @click="emit('adoptLatest')"
        >
          改用最新内容
        </AdminAction>
      </div>
      <slot name="latest" />
    </div>

    <div class="site-section__fields">
      <slot />
    </div>

    <footer class="site-section__footer">
      <p class="site-section__state" role="status">
        <span v-if="saving">正在保存…</span>
        <span v-else-if="saved" data-testid="site-section-saved">已保存</span>
        <span v-else-if="dirty" data-testid="site-section-dirty">有未保存修改</span>
      </p>
      <div class="site-section__actions">
        <AdminAction
          v-if="dirty"
          size="small"
          :disabled="saving"
          @click="emit('reset')"
        >
          放弃修改
        </AdminAction>
        <AdminAction
          variant="primary"
          size="small"
          :disabled="!canSave"
          :loading="saving"
          loading-label="保存中…"
          data-testid="site-section-save"
          @click="emit('save')"
        >
          保存
        </AdminAction>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.site-section {
  display: grid;
  gap: var(--admin-space-3);
  padding: var(--admin-space-4);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}

.site-section[data-conflict='true'] {
  border-color: var(--admin-border-warning, #a8701a);
}

.site-section__header {
  display: grid;
  gap: var(--admin-space-1);
}

.site-section__title {
  margin: 0;
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.site-section__hint,
.site-section__state,
.site-section__conflict-text {
  margin: 0;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.site-section__conflict {
  display: grid;
  gap: var(--admin-space-2);
  padding: var(--admin-space-3);
  background: var(--admin-bg-secondary);
  border: 1px solid var(--admin-border-warning, #a8701a);
  border-radius: var(--admin-radius-sm);
}

.site-section__fields {
  display: grid;
  gap: var(--admin-space-3);
}

.site-section__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--admin-space-2);
}

.site-section__actions,
.site-section__conflict-actions {
  display: flex;
  gap: var(--admin-space-2);
}

</style>
