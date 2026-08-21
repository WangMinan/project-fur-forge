<script setup lang="ts">
import type { WorkListItemDto } from '~~/shared/types/contracts'
import { PUBLIC_FEATURED_LIMIT } from '~~/shared/constants/featured'
import { ADMIN_MEDIA_CARD_PREVIEW_WIDTH } from '~~/shared/constants/admin-media-preview'
import { adminMediaPreviewUrl } from '~/utils/admin-media-preview'
import {
  PUBLICATION_STATUS_LABELS,
  WORK_PURPOSE_LABELS,
} from '~/utils/work-labels'
import type { FeaturedMove } from '~/utils/featured-order'

const props = defineProps<{
  error: string | null
  items: WorkListItemDto[]
  pendingId: string | null
  removingId: string | null
  status: 'error' | 'loading' | 'ready'
}>()

const emit = defineEmits<{
  move: [id: string, direction: FeaturedMove]
  reload: []
  remove: [work: WorkListItemDto]
}>()

const PUBLICATION_TONES = {
  draft: 'warning',
  published: 'success',
  unpublished: 'neutral',
} as const

function thumbAssetId(work: WorkListItemDto) {
  return work.primaryAssetId
    ?? (work.purpose === 'adoption' ? work.adoptionCoverAssetId : null)
}

function publicRank(index: number) {
  if (props.items[index]?.publicationStatus !== 'published') {
    return null
  }
  return props.items.slice(0, index + 1).filter(
    item => item.publicationStatus === 'published',
  ).length
}
</script>

<template>
  <section class="featured-order" aria-labelledby="featured-order-title">
    <header class="featured-order__header">
      <div>
        <h2 id="featured-order-title" class="featured-order__title">首页精选顺序</h2>
        <p class="featured-order__intro">
          使用按钮直接调整，系统会一次保存完整顺序。首页只展示排序最前的
          {{ PUBLIC_FEATURED_LIMIT }} 件已发布作品。
        </p>
      </div>
      <span v-if="status === 'ready'" class="featured-order__count">
        {{ items.length }} 件精选
      </span>
    </header>

    <div v-if="status === 'loading'" class="featured-order__state" role="status">
      正在加载首页精选…
    </div>
    <div v-else-if="status === 'error'" class="featured-order__state featured-order__state--error">
      <p role="alert">首页精选加载失败，请检查网络后重试。</p>
      <AdminAction size="small" @click="emit('reload')">重试</AdminAction>
    </div>
    <div v-else-if="items.length === 0" class="featured-order__state">
      <p>还没有首页精选作品。</p>
      <p>请在“全部作品”中勾选“加入首页精选”，新作品会自动排在末尾。</p>
    </div>

    <template v-else>
      <p v-if="error" class="featured-order__error" role="alert">{{ error }}</p>
      <TransitionGroup name="featured-list" tag="ol" class="featured-order__list">
        <li
          v-for="(work, index) in items"
          :key="work.id"
          class="featured-order__item"
          :data-work-id="work.id"
        >
          <span class="featured-order__position" :aria-label="`当前第 ${index + 1} 位`">
            {{ index + 1 }}
          </span>
          <span class="featured-order__thumb">
            <img
              v-if="thumbAssetId(work)"
              :src="adminMediaPreviewUrl(thumbAssetId(work)!, ADMIN_MEDIA_CARD_PREVIEW_WIDTH)"
              alt=""
              loading="lazy"
              referrerpolicy="same-origin"
            >
            <span v-else aria-hidden="true">无图</span>
          </span>
          <div class="featured-order__identity">
            <NuxtLink :to="`/admin/works/${work.id}`" class="featured-order__name">
              {{ work.characterName }}
            </NuxtLink>
            <span class="featured-order__meta">
              {{ work.species }} · {{ WORK_PURPOSE_LABELS[work.purpose] }}
            </span>
          </div>
          <div class="featured-order__visibility">
            <AdminStatusBadge
              :tone="PUBLICATION_TONES[work.publicationStatus]"
              :label="PUBLICATION_STATUS_LABELS[work.publicationStatus]"
            />
            <span
              v-if="publicRank(index) !== null && publicRank(index)! <= PUBLIC_FEATURED_LIMIT"
              class="featured-order__public featured-order__public--yes"
            >公开第 {{ publicRank(index) }} 位</span>
            <span v-else-if="work.publicationStatus === 'published'" class="featured-order__public">
              超出公开前 {{ PUBLIC_FEATURED_LIMIT }}
            </span>
            <span v-else class="featured-order__public">发布后才进入首页</span>
          </div>
          <div class="featured-order__actions" aria-label="精选顺序操作">
            <AdminAction
              class="featured-order__action"
              size="small"
              :disabled="index === 0 || pendingId !== null || removingId !== null"
              :aria-label="`将 ${work.characterName} 置顶`"
              @click="emit('move', work.id, 'top')"
            >置顶</AdminAction>
            <AdminAction
              class="featured-order__action"
              size="small"
              :disabled="index === 0 || pendingId !== null || removingId !== null"
              :aria-label="`将 ${work.characterName} 上移`"
              @click="emit('move', work.id, 'up')"
            >上移</AdminAction>
            <AdminAction
              class="featured-order__action"
              size="small"
              :disabled="index === items.length - 1 || pendingId !== null || removingId !== null"
              :aria-label="`将 ${work.characterName} 下移`"
              @click="emit('move', work.id, 'down')"
            >下移</AdminAction>
            <AdminAction
              class="featured-order__action"
              size="small"
              :disabled="index === items.length - 1 || pendingId !== null || removingId !== null"
              :aria-label="`将 ${work.characterName} 置底`"
              @click="emit('move', work.id, 'bottom')"
            >置底</AdminAction>
            <AdminAction
              class="featured-order__remove"
              size="small"
              variant="danger"
              :disabled="pendingId !== null || removingId !== null"
              :aria-label="`将 ${work.characterName} 移出首页精选`"
              @click="emit('remove', work)"
            >移出精选</AdminAction>
          </div>
          <span v-if="pendingId === work.id || removingId === work.id" class="featured-order__saving" role="status">
            保存中…
          </span>
        </li>
      </TransitionGroup>
    </template>
  </section>
</template>

<style scoped>
.featured-order {
  display: grid;
  gap: var(--admin-space-4);
}

.featured-order__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--admin-space-4);
}

.featured-order__title,
.featured-order__intro,
.featured-order__state p,
.featured-order__error {
  margin: 0;
}

.featured-order__title {
  font-size: var(--admin-font-md);
}

.featured-order__intro,
.featured-order__count {
  margin-top: var(--admin-space-1);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.featured-order__state {
  display: grid;
  gap: var(--admin-space-2);
  justify-items: center;
  padding: var(--admin-space-8);
  border: 1px dashed var(--admin-border-primary);
  border-radius: var(--admin-radius-lg);
  background: var(--admin-bg-primary);
  color: var(--admin-text-secondary);
  text-align: center;
}

.featured-order__state--error,
.featured-order__error {
  color: var(--admin-status-error);
}

.featured-order__error {
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  font-size: var(--admin-font-sm);
}

.featured-order__list {
  display: grid;
  gap: var(--admin-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.featured-order__item {
  position: relative;
  display: grid;
  grid-template-columns: 2.5rem 4.5rem minmax(10rem, 1fr) minmax(9rem, auto) minmax(19rem, auto);
  align-items: center;
  gap: var(--admin-space-3);
  min-width: 0;
  padding: var(--admin-space-3);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  background: var(--admin-bg-primary);
}

.featured-order__position {
  font-size: var(--admin-font-lg);
  font-weight: 700;
  color: var(--admin-accent-primary);
  text-align: center;
}

.featured-order__thumb {
  width: 4.5rem;
  height: 4.5rem;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-subtle);
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
}

.featured-order__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.featured-order__identity,
.featured-order__visibility {
  display: grid;
  gap: var(--admin-space-1);
  min-width: 0;
}

.featured-order__name {
  color: var(--admin-text-primary);
  font-weight: 700;
  text-decoration: none;
}

.featured-order__meta,
.featured-order__public,
.featured-order__saving {
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
}

.featured-order__public--yes {
  color: var(--admin-status-success);
  font-weight: 600;
}

.featured-order__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--admin-space-1);
  flex-wrap: wrap;
}

.featured-order__saving {
  position: absolute;
  right: var(--admin-space-3);
  bottom: var(--admin-space-1);
}

.featured-list-move {
  transition: transform var(--admin-duration-normal) var(--admin-easing);
}

@media (max-width: 1100px) {
  .featured-order__item {
    grid-template-columns: 2.25rem 4rem minmax(0, 1fr);
  }

  .featured-order__visibility,
  .featured-order__actions {
    grid-column: 3;
    justify-content: flex-start;
  }

  .featured-order__thumb {
    width: 4rem;
    height: 4rem;
  }
}

@media (max-width: 520px) {
  .featured-order__header {
    align-items: start;
    flex-direction: column;
  }

  .featured-order__item {
    grid-template-columns: 2rem minmax(0, 1fr);
  }

  .featured-order__thumb {
    grid-column: 1;
    grid-row: 2;
    width: 2rem;
    height: 2rem;
  }

  .featured-order__identity,
  .featured-order__visibility,
  .featured-order__actions {
    grid-column: 2;
  }

  .featured-order__action,
  .featured-order__remove {
    min-height: var(--admin-touch-target);
  }
}

@media (prefers-reduced-motion: reduce) {
  .featured-list-move {
    transition: none;
  }
}
</style>
