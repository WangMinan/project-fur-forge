<script setup lang="ts">
import type {
  PublicAdoptionListItemDto,
  PublicHomepageDto,
} from '~~/shared/types/contracts'

const props = defineProps<{
  adoptions: PublicAdoptionListItemDto[]
  entries: PublicHomepageDto['entries']
}>()

const visibleEntries = computed(() => [
  props.entries.commission,
  props.entries.adoption,
].filter(entry => entry !== null))
</script>

<template>
  <div class="home-continuation">
    <section
      v-if="visibleEntries.length > 0"
      class="home-business"
      aria-labelledby="home-business-title"
      data-testid="home-business-entries"
    >
      <header class="home-business__header">
        <p class="home-business__eyebrow">制作与领养</p>
        <h2 id="home-business-title" class="home-section-title">找到适合你的入口</h2>
      </header>

      <div class="home-business__grid">
        <NuxtLink
          v-for="entry in visibleEntries"
          :key="entry.kind"
          :to="entry.href"
          class="home-business-card"
          :data-entry-kind="entry.kind"
        >
          <ResponsivePicture
            class="home-business-card__media"
            :sources="entry.sources"
            :alt="entry.alt"
            sizes="(min-width: 768px) 50vw, 100vw"
          />
          <span class="home-business-card__shade" aria-hidden="true" />
          <span class="home-business-card__content">
            <span class="home-business-card__title-row">
              <span class="home-business-card__title">{{ entry.title }}</span>
              <span aria-hidden="true">→</span>
            </span>
            <PublicBusinessStatus
              v-if="entry.status"
              class="home-business-card__status"
              :status="entry.status"
            />
          </span>
        </NuxtLink>
      </div>
    </section>

    <section
      v-if="adoptions.length > 0"
      class="home-adoptions"
      aria-labelledby="home-adoptions-title"
      data-testid="home-current-adoptions"
    >
      <header class="home-adoptions__header">
        <h2 id="home-adoptions-title" class="home-section-title">当前领养</h2>
        <NuxtLink to="/adoptions" class="home-adoptions__more">
          查看全部 <span aria-hidden="true">→</span>
        </NuxtLink>
      </header>
      <ul class="home-adoptions__grid" role="list">
        <li v-for="adoption in adoptions" :key="adoption.work.id">
          <AdoptionCard :adoption="adoption" />
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.home-continuation {
  display: grid;
  gap: var(--space-9);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-9) var(--public-page-padding) 0;
}

.home-business,
.home-adoptions {
  display: grid;
  gap: var(--space-5);
}

.home-business__header {
  display: grid;
  gap: var(--space-2);
}

.home-business__eyebrow {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: var(--letter-spacing-label);
}

.home-section-title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

.home-business__grid,
.home-adoptions__grid {
  display: grid;
  gap: var(--space-6);
}

.home-business-card {
  position: relative;
  display: grid;
  min-height: clamp(18rem, 38vw, 30rem);
  overflow: hidden;
  color: var(--public-text-inverse);
  background: var(--image-placeholder);
  border-radius: var(--radius-md);
}

.home-business-card__media,
.home-business-card__shade,
.home-business-card__content {
  grid-area: 1 / 1;
}

.home-business-card__media,
.home-business-card__media :deep(.responsive-picture),
.home-business-card__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.home-business-card__media :deep(.responsive-picture__image) {
  object-fit: cover;
  transition: transform var(--duration-section) var(--easing-standard);
}

.home-business-card__shade {
  background: linear-gradient(
    to top,
    rgb(17 20 25 / 0.76),
    rgb(17 20 25 / 0.16) 62%,
    transparent
  );
}

.home-business-card__content {
  z-index: 1;
  align-self: end;
  display: grid;
  gap: var(--space-3);
  padding: clamp(1.5rem, 4vw, 2.5rem);
}

.home-business-card__title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
}

.home-business-card__title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.home-business-card__status {
  color: rgb(255 255 255 / 0.92);
}

.home-business-card__status :deep(.business-status__detail) {
  color: rgb(255 255 255 / 0.78);
}

.home-business-card:hover {
  color: var(--public-text-inverse);
}

.home-business-card:hover .home-business-card__media :deep(.responsive-picture__image) {
  transform: scale(var(--image-hover-scale));
}

.home-adoptions__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
}

.home-adoptions__more {
  flex: none;
  font-size: var(--font-size-sm);
}

.home-adoptions__more:hover {
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

.home-adoptions__grid {
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 768px) {
  .home-business__grid,
  .home-adoptions__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-business__grid > :only-child {
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-business-card__media :deep(.responsive-picture__image) {
    transition: none;
  }

  .home-business-card:hover .home-business-card__media :deep(.responsive-picture__image) {
    transform: none;
  }
}
</style>
