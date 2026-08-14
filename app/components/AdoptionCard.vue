<script setup lang="ts">
import type { PublicAdoptionListItemDto } from '~~/shared/types/contracts'
import { formatCnyMinorUnits } from '~/utils/format'
import {
  BUSINESS_STATUS_LABELS,
  SUIT_TYPE_LABELS,
} from '~/utils/work-labels'

const props = defineProps<{
  adoption: PublicAdoptionListItemDto
}>()

const price = computed(() => props.adoption.work.price
  ? formatCnyMinorUnits(props.adoption.work.price.minorUnits)
  : null,
)

/** T37：只有展会掉落显示类型标签与展会信息，常规领养不出现空字段。 */
const eventDrop = computed(() => (
  props.adoption.work.adoptionMethod === 'event_drop'
    ? {
        name: props.adoption.work.eventName,
        time: props.adoption.work.eventTime,
      }
    : null
))
</script>

<template>
  <NuxtLink
    :to="adoption.href"
    class="adoption-card"
    :data-work-slug="adoption.work.slug"
  >
    <span class="adoption-card__canvas">
      <ResponsivePicture
        :sources="adoption.designSheet.sources"
        :alt="adoption.designSheet.alt"
        sizes="(min-width: 1024px) 44vw, 100vw"
      />
    </span>
    <span class="adoption-card__body">
      <span class="adoption-card__heading">
        <span class="adoption-card__name">{{ adoption.work.characterName }}</span>
        <span class="adoption-card__status">
          {{ BUSINESS_STATUS_LABELS[adoption.work.businessStatus] }}
        </span>
      </span>
      <span class="adoption-card__details">
        <span class="adoption-card__meta">
          {{ adoption.work.species }} · {{ SUIT_TYPE_LABELS[adoption.work.suitType] }}
        </span>
        <span v-if="eventDrop" class="adoption-card__event">
          <span class="adoption-card__event-tag">展会掉落</span>
          <span v-if="eventDrop.name" class="adoption-card__event-name">
            {{ eventDrop.name }}
          </span>
          <span v-if="eventDrop.time" class="adoption-card__event-time">
            {{ eventDrop.time }}
          </span>
        </span>
        <span v-if="price" class="adoption-card__price">{{ price }}</span>
      </span>
      <span v-if="adoption.work.featureTags.length > 0" class="adoption-card__tags">
        <span v-for="tag in adoption.work.featureTags" :key="tag">{{ tag }}</span>
      </span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.adoption-card {
  display: block;
  color: var(--public-text-primary);
  transition: transform var(--duration-normal) var(--easing-standard);
}

.adoption-card:hover {
  color: var(--public-text-primary);
}

/* 展会信息在元信息带内受控折行，不再独占多行并放大整行卡片高度。 */
.adoption-card__event {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-2);
  overflow-wrap: anywhere;
}

.adoption-card__event-tag {
  flex: none;
  padding: 0.05rem 0.5rem;
  border: 1px solid var(--public-accent-tint);
  border-radius: var(--radius-full);
  color: var(--public-accent-primary);
  font-size: var(--font-size-xs);
}

.adoption-card__event-name {
  color: var(--public-text-primary);
}

.adoption-card__event-time {
  color: var(--public-text-secondary);
}

/**
 * 设定图外框：圆角矩形 + 固定比例。
 *
 * 固定比例是为了让并排的两张卡对齐——设定图各自比例不同，
 * 高度自适应时右边卡的文字会比左边高出一截。`contain` 保证
 * 设定图完整可见、不裁切，多余空间由留白承担。
 */
.adoption-card__canvas {
  display: block;
  aspect-ratio: var(--ratio-design-sheet);
  overflow: hidden;
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-image);
  background: var(--image-placeholder);
  transition: box-shadow var(--duration-normal) var(--easing-standard);
}

.adoption-card__canvas :deep(.responsive-picture),
.adoption-card__canvas :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.adoption-card__canvas :deep(.responsive-picture__image) {
  object-fit: contain;
  transition: transform var(--duration-section) var(--easing-standard);
}

@media (hover: hover) and (pointer: fine) {
  .adoption-card:hover {
    transform: translateY(-0.25rem);
  }

  .adoption-card:hover .adoption-card__canvas {
    box-shadow: 0 1rem 2.25rem rgb(17 20 25 / 0.12);
  }

  .adoption-card:hover .adoption-card__canvas :deep(.responsive-picture__image) {
    transform: scale(var(--image-hover-scale));
  }
}

.adoption-card__body,
.adoption-card__heading,
.adoption-card__details,
.adoption-card__tags {
  display: flex;
}

.adoption-card__body {
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
}

.adoption-card__heading {
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.adoption-card__name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
  line-height: var(--line-height-heading);
}

.adoption-card__status {
  flex: none;
  color: var(--public-status-open);
  font-size: var(--font-size-sm);
}

.adoption-card__details {
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.adoption-card__meta {
  flex: none;
  color: var(--public-text-secondary);
}

.adoption-card__tags {
  flex-wrap: wrap;
  gap: var(--space-2);
}

.adoption-card__tags span {
  padding: var(--space-1) var(--space-3);
  color: var(--public-text-secondary);
  font-size: var(--font-size-xs);
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-full);
}

.adoption-card__price {
  margin-inline-start: auto;
  color: var(--public-text-primary);
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
}

@media (prefers-reduced-motion: reduce) {
  .adoption-card,
  .adoption-card__canvas,
  .adoption-card__canvas :deep(.responsive-picture__image) {
    transition: none;
  }

  .adoption-card:hover,
  .adoption-card:hover .adoption-card__canvas :deep(.responsive-picture__image) {
    transform: none;
  }
}
</style>
