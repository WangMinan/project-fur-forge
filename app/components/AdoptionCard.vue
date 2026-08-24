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
      <!--
        名称·物种、价格与状态同一行：价格紧跟在状态之前，
        窄屏由整行折行而不是让价格单独占一行。
      -->
      <span class="adoption-card__heading">
        <span class="adoption-card__title">
          <WorkIdentityLabel
            :character-name="adoption.work.characterName"
            :species="adoption.work.species"
          />
        </span>
        <span class="adoption-card__meta">
          <span v-if="price" class="adoption-card__price">{{ price }}</span>
          <span
            class="adoption-card__status"
            :data-status="adoption.work.adoptionStatus"
          >
            {{ ADOPTION_STATUS_LABELS[adoption.work.adoptionStatus] }}
          </span>
        </span>
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

.adoption-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
}

.adoption-card__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-3);
}

.adoption-card__title {
  min-width: 0;
}

/* 价格与状态成一组贴右端；两者中线对齐，宋体价格不会看起来偏高。 */
.adoption-card__meta {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-3);
}

.adoption-card__price {
  color: var(--public-text-primary);
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
  line-height: var(--line-height-heading);
}

.adoption-card__status {
  flex: none;
  color: var(--public-status-neutral);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-heading);
}

.adoption-card__status[data-status='available'] {
  color: var(--public-status-open);
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
