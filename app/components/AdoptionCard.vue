<script setup lang="ts">
import type { PublicAdoptionListItemDto } from '~~/shared/types/contracts'
import WorkIdentityLabel from '~/components/WorkIdentityLabel.vue'
import { formatCnyMinorUnits } from '~/utils/format'
import { ADOPTION_STATUS_LABELS } from '~/utils/work-labels'

const props = defineProps<{
  adoption: PublicAdoptionListItemDto
}>()

const price = computed(() => props.adoption.work.price
  ? formatCnyMinorUnits(props.adoption.work.price.minorUnits)
  : null,
)

</script>

<template>
  <NuxtLink
    :to="{
      path: adoption.href,
      query: { from: 'adoptions' },
    }"
    class="adoption-card"
    :data-work-slug="adoption.work.slug"
  >
    <span class="adoption-card__canvas">
      <ResponsivePicture
        :sources="adoption.cover.sources"
        :alt="adoption.cover.alt"
        sizes="(min-width: 1024px) 44vw, 100vw"
      />
    </span>
    <span class="adoption-card__body">
      <span class="adoption-card__heading">
        <span class="adoption-card__title">
          <WorkIdentityLabel
            :character-name="adoption.work.characterName"
            :species="adoption.work.species"
          />
        </span>
        <span
          class="adoption-card__status"
          :data-status="adoption.work.adoptionStatus"
        >
          {{ ADOPTION_STATUS_LABELS[adoption.work.adoptionStatus] }}
        </span>
      </span>
      <span v-if="price" class="adoption-card__details">
        <span class="adoption-card__price">{{ price }}</span>
      </span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.adoption-card {
  display: block;
  color: var(--public-text-primary);
  transition: transform var(--motion-duration-state) var(--motion-ease-standard);
}

.adoption-card:hover {
  color: var(--public-text-primary);
}

/**
 * 领养卡固定使用独立横版封面；不以设定图或出厂照自动替代。
 */
.adoption-card__canvas {
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-image);
  background: var(--image-placeholder);
  transition: box-shadow var(--motion-duration-state) var(--motion-ease-standard);
}

.adoption-card__canvas :deep(.responsive-picture),
.adoption-card__canvas :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.adoption-card__canvas :deep(.responsive-picture__image) {
  object-fit: cover;
  transition: transform var(--motion-duration-state) var(--motion-ease-standard);
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

.adoption-card__title {
  min-width: 0;
}

.adoption-card__status {
  flex: none;
  color: var(--public-status-neutral);
  font-size: var(--font-size-sm);
}

.adoption-card__status[data-status='available'] {
  color: var(--public-status-open);
}

.adoption-card__details {
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
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
