<script setup lang="ts">
import type { AdminAssetFixture, AdminMediaState } from '~~/shared/fixtures/visual-admin'

defineProps<{
  asset: AdminAssetFixture
}>()

const emit = defineEmits<{
  retry: []
  remove: []
  setPrimary: []
}>()

const STATE_LABELS: Record<AdminMediaState, string> = {
  pending_upload: '待上传',
  uploading: '私有上传中',
  validating: '校验中',
  private_ready: '私有 READY',
  generating_public: '生成公开图',
  ready: 'READY',
  failed: '失败',
}

const STATE_TONES: Record<AdminMediaState, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  pending_upload: 'neutral',
  uploading: 'info',
  validating: 'info',
  private_ready: 'info',
  generating_public: 'info',
  ready: 'success',
  failed: 'error',
}
</script>

<template>
  <article class="asset-card" :data-state="asset.state">
    <div class="asset-card__thumb">
      <img
        v-if="asset.thumb"
        :src="asset.thumb"
        :alt="asset.alt || '媒体缩略图'"
        width="160"
        height="160"
        loading="lazy"
      >
      <div v-else class="asset-card__placeholder" aria-hidden="true">
        {{ STATE_LABELS[asset.state] }}
      </div>
      <span v-if="asset.isPrimary" class="asset-card__primary">主图</span>
    </div>
    <div class="asset-card__body">
      <p class="asset-card__order">第 {{ asset.order }} 张</p>
      <AdminStatusBadge :tone="STATE_TONES[asset.state]" :label="STATE_LABELS[asset.state]" />
      <p v-if="asset.failureStage" class="asset-card__failure">
        失败于{{ asset.failureStage }}环节
      </p>
      <p v-else-if="asset.alt" class="asset-card__alt">{{ asset.alt }}</p>
      <p v-else class="asset-card__alt asset-card__alt--muted">处理完成后可填写图片说明</p>
    </div>
    <div class="asset-card__actions">
      <button
        v-if="asset.state === 'failed'"
        type="button"
        class="asset-card__action"
        @click="emit('retry')"
      >重试</button>
      <button
        v-if="asset.state === 'failed'"
        type="button"
        class="asset-card__action asset-card__action--danger"
        @click="emit('remove')"
      >删除</button>
      <button
        v-if="asset.state === 'ready' && !asset.isPrimary"
        type="button"
        class="asset-card__action"
        @click="emit('setPrimary')"
      >设为主图</button>
    </div>
  </article>
</template>

<style scoped>
.asset-card {
  display: flex;
  gap: var(--admin-space-3);
  align-items: flex-start;
  padding: var(--admin-space-3);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}

.asset-card[data-state='failed'] {
  border-color: var(--admin-status-error);
}

.asset-card__thumb {
  position: relative;
  flex: none;
  width: 5rem;
  height: 5rem;
  border-radius: var(--admin-radius-sm);
  overflow: hidden;
  background: var(--admin-bg-subtle);
}

.asset-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.asset-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
  text-align: center;
  padding: var(--admin-space-1);
}

.asset-card__primary {
  position: absolute;
  inset-inline-start: 0;
  inset-block-start: 0;
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font-size: var(--admin-font-xs);
  font-weight: 600;
  padding: 0.05rem 0.4rem;
  border-end-end-radius: var(--admin-radius-sm);
}

.asset-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-2);
  min-width: 0;
}

.asset-card__order {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.asset-card__failure {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-error);
}

.asset-card__alt {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.asset-card__alt--muted {
  color: var(--admin-text-tertiary);
}

.asset-card__actions {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-1);
}

.asset-card__action {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font-size: var(--admin-font-xs);
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.asset-card__action:hover {
  background: var(--admin-bg-subtle);
}

.asset-card__action--danger {
  color: var(--admin-danger);
  border-color: var(--admin-danger);
}
</style>
