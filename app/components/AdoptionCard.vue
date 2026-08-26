<script setup lang="ts">
import { formatCnyMinorUnits } from '~/utils/format'
import type { PublicAdoptionListItemDto } from '~~/shared/types/contracts'

const props = defineProps<{
  adoption: PublicAdoptionListItemDto
  folio: number
}>()

const hasLongCharacterName = computed(() => (
  props.adoption.work.characterName.length >= 10
))
const folioLabel = computed(() => String(props.folio).padStart(2, '0'))
const priceLabel = computed(() => (
  props.adoption.work.price
    ? formatCnyMinorUnits(props.adoption.work.price.minorUnits)
    : null
))
const mediaOrientation = computed(() => {
  const image = props.adoption.cover.sources.fallback.at(-1)
  return image && image.height > image.width ? 'portrait' : 'landscape'
})
const adoptionTo = computed(() => ({
  path: props.adoption.href,
  query: { from: 'adoptions' },
}))
</script>

<template>
  <NuxtLink
    :to="adoptionTo"
    class="adoption-card"
    :data-work-slug="adoption.work.slug"
    :aria-label="`查看领养角色：${adoption.work.characterName}`"
  >
    <span class="adoption-card__record">
      <span
        class="adoption-card__canvas"
        :data-orientation="mediaOrientation"
      >
        <ResponsivePicture
          :sources="adoption.cover.sources"
          :alt="adoption.cover.alt"
          sizes="(min-width: 1024px) 30vw, (min-width: 768px) 58vw, 92vw"
        />
      </span>

      <span class="adoption-card__profile">
        <span class="adoption-card__folio" aria-hidden="true">{{ folioLabel }}</span>

        <span class="adoption-card__identity">
          <span
            class="adoption-card__title"
            :class="{ 'adoption-card__title--long': hasLongCharacterName }"
          >{{ adoption.work.characterName }}</span>
        </span>

        <span class="adoption-card__facts" aria-label="角色简要信息">
          <span>{{ adoption.work.species }}</span>
          <span v-if="priceLabel">{{ priceLabel }}</span>
        </span>

        <span class="adoption-card__action">
          <span>查看当前角色</span>
          <span aria-hidden="true">→</span>
        </span>
      </span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.adoption-card {
  display: block;
  min-width: 0;
  padding: 0 0 var(--space-6);
  color: var(--public-text-primary);
}

.adoption-card:hover {
  color: var(--public-text-primary);
}

.adoption-card:focus-visible {
  outline: 2px solid var(--public-border-focus);
  outline-offset: 4px;
}

.adoption-card__record {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border-radius: var(--radius-image);
  background: color-mix(in srgb, var(--public-media-canvas) 46%, white);
}

/** 完整设定图优先；媒体画布只留白，不以 cover 统一裁切角色内容。 */
.adoption-card__canvas {
  display: grid;
  min-width: 0;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  padding: var(--space-2);
  background: var(--public-media-canvas);
  place-items: center;
}

.adoption-card__canvas :deep(.responsive-picture),
.adoption-card__canvas :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.adoption-card__canvas :deep(.responsive-picture__image) {
  border-radius: calc(var(--radius-image) - 4px);
  object-fit: contain;
  transition: none;
}

.adoption-card__canvas :deep(.responsive-picture) {
  overflow: hidden;
  border-radius: calc(var(--radius-image) - 4px);
}

.adoption-card__profile,
.adoption-card__identity,
.adoption-card__action {
  display: flex;
}

.adoption-card__profile {
  position: relative;
  isolation: isolate;
  flex-direction: column;
  min-width: 0;
  padding: var(--space-5);
}

.adoption-card__identity,
.adoption-card__facts,
.adoption-card__action {
  position: relative;
  z-index: 1;
}

.adoption-card__folio {
  position: absolute;
  inset: auto -0.45rem -0.85rem auto;
  z-index: 0;
  color: color-mix(in srgb, var(--public-text-primary) 21%, transparent);
  font-family: var(--font-role-display-rounded);
  font-size: clamp(4.75rem, 19vw, 7rem);
  font-weight: 600;
  line-height: 0.8;
  letter-spacing: var(--type-display-letter-spacing);
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  user-select: none;
}

.adoption-card__title {
  max-width: 11ch;
  font-family: var(--font-role-display);
  font-size: clamp(2rem, 8vw, 2.75rem);
  font-weight: 500;
  line-height: 1.06;
  letter-spacing: var(--type-display-letter-spacing);
  overflow-wrap: anywhere;
}

.adoption-card__title--long {
  font-size: clamp(1.75rem, 7vw, 2.375rem);
}

.adoption-card__facts {
  display: grid;
  width: min(100%, 8rem);
  min-width: 0;
  gap: var(--space-4);
  margin-top: var(--space-4);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.adoption-card__facts > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.adoption-card__facts > span::before {
  content: "·";
  margin-inline-end: var(--space-2);
  color: var(--public-text-primary);
  font-weight: 700;
}

.adoption-card__action {
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-2);
  min-height: 2.75rem;
  margin-top: var(--space-6);
  margin-bottom: var(--space-4);
  padding-top: var(--space-3);
  color: var(--public-text-primary);
  border-top: 1px solid var(--public-border-primary);
  font-weight: 600;
}

@media (max-width: 767px) {
  .adoption-card {
    padding-bottom: var(--space-4);
  }

  .adoption-card__canvas {
    aspect-ratio: 16 / 9;
  }

  .adoption-card__profile {
    padding: var(--space-4);
  }

  .adoption-card__title {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    font-size: clamp(1.625rem, 7vw, 2rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .adoption-card__title--long {
    font-size: clamp(1.4rem, 6vw, 1.75rem);
  }

  .adoption-card__facts {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    gap: var(--space-2) var(--space-5);
    margin-top: var(--space-2);
  }

  .adoption-card__facts > span {
    white-space: nowrap;
  }

  .adoption-card__action {
    margin-top: var(--space-4);
    margin-bottom: 0;
  }
}

@media (min-width: 768px) {
  .adoption-card__record {
    grid-template-columns: minmax(0, 2.05fr) minmax(10.75rem, 0.95fr);
    min-height: clamp(20rem, 25vw, 22rem);
  }

  .adoption-card__canvas {
    height: 100%;
    aspect-ratio: auto;
    border-radius: var(--radius-image) 0 0 var(--radius-image);
  }

  .adoption-card__profile {
    padding: clamp(1.25rem, 2vw, 2rem) clamp(1rem, 1.6vw, 1.5rem);
  }

  .adoption-card__folio {
    inset: auto -0.45rem -0.85rem auto;
    font-size: clamp(4.5rem, 6.5vw, 6.25rem);
  }

  .adoption-card__title {
    font-size: clamp(1.75rem, 2.35vw, 2.375rem);
  }

  .adoption-card__title--long {
    font-size: clamp(1.5rem, 2vw, 2rem);
  }

  .adoption-card__action {
    margin-top: auto;
    margin-bottom: var(--space-5);
  }
}
</style>
