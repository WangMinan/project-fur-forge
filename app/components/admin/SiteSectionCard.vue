<script setup lang="ts">
defineProps<{
  title: string
  description: string
  canSubmit: boolean
  mutating: boolean
  saved: boolean
  saveLabel: string
}>()

defineEmits<{ save: [] }>()
</script>

<template>
  <section class="site-section-card">
    <header class="site-section-card__head">
      <div>
        <h2 class="site-section-card__title">{{ title }}</h2>
        <p class="site-section-card__description">{{ description }}</p>
      </div>
      <p v-if="saved" class="site-section-card__saved" role="status">已保存</p>
    </header>
    <div class="site-section-card__body"><slot /></div>
    <footer class="site-section-card__actions">
      <button
        type="button"
        class="site-section-card__button"
        :disabled="!canSubmit"
        @click="$emit('save')"
      >{{ mutating ? '保存中…' : saveLabel }}</button>
    </footer>
  </section>
</template>

<style scoped>
.site-section-card {
  display: grid;
  gap: var(--admin-space-4);
  padding: var(--admin-space-5);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}
.site-section-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--admin-space-3);
}
.site-section-card__title,
.site-section-card__description,
.site-section-card__saved { margin: 0; }
.site-section-card__title { font-size: var(--admin-font-md); font-weight: 600; }
.site-section-card__description {
  margin-top: var(--admin-space-1);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}
.site-section-card__saved { color: var(--admin-status-success); font-size: var(--admin-font-xs); }
.site-section-card__body { display: grid; gap: var(--admin-space-3); }
.site-section-card__actions { display: flex; justify-content: flex-end; }
.site-section-card__button {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  color: var(--admin-text-inverse);
  background: var(--admin-accent-primary);
  border: 0;
  border-radius: var(--admin-radius-md);
  font: inherit;
  font-size: var(--admin-font-sm);
  font-weight: 600;
  cursor: pointer;
}
.site-section-card__button:disabled { opacity: 0.55; cursor: default; }
</style>
