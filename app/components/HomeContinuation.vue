<script setup lang="ts">
import type {
  PublicAdoptionListItemDto,
  PublicHomeEntriesDto,
  PublicSiteContentDto,
} from '~~/shared/types/contracts'

const props = defineProps<{
  adoptions: PublicAdoptionListItemDto[]
  entries: PublicHomeEntriesDto
  statuses: PublicSiteContentDto['statuses']
}>()

const currentAdoptions = computed(() => props.adoptions.slice(0, 2))
const visibleStatuses = computed(() => [
  props.statuses.commission,
  props.statuses.adoption,
].filter(status => status !== null))
</script>

<template>
  <div class="home-continuation">
    <section
      v-if="entries.commission || entries.adoption"
      class="home-entry-grid"
      aria-label="委托与领养"
      data-testid="home-image-entries"
    >
      <NuxtLink
        v-if="entries.commission"
        :to="entries.commission.href"
        class="home-entry"
      >
        <ResponsivePicture
          class="home-entry__media"
          :sources="entries.commission.sources"
          :alt="entries.commission.alt"
          sizes="(min-width: 768px) 50vw, 100vw"
        />
        <span class="home-entry__shade" aria-hidden="true" />
        <span class="home-entry__label">自设委托 <span aria-hidden="true">→</span></span>
      </NuxtLink>

      <NuxtLink
        v-if="entries.adoption"
        :to="entries.adoption.href"
        class="home-entry"
      >
        <ResponsivePicture
          class="home-entry__media"
          :sources="entries.adoption.sources"
          :alt="entries.adoption.alt"
          sizes="(min-width: 768px) 50vw, 100vw"
        />
        <span class="home-entry__shade" aria-hidden="true" />
        <span class="home-entry__label">角色领养 <span aria-hidden="true">→</span></span>
      </NuxtLink>
    </section>

    <section
      v-if="visibleStatuses.length > 0"
      class="home-statuses"
      aria-labelledby="home-statuses-title"
      data-testid="home-business-statuses"
    >
      <h2 id="home-statuses-title" class="home-section-title">当前状态</h2>
      <div class="home-statuses__grid">
        <NuxtLink
          v-for="status in visibleStatuses"
          :key="status.kind"
          :to="status.href"
          class="home-statuses__item"
        >
          <PublicBusinessStatus :status="status" />
        </NuxtLink>
      </div>
    </section>

    <section
      v-if="currentAdoptions.length > 0"
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
        <li v-for="adoption in currentAdoptions" :key="adoption.work.id">
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

.home-entry-grid,
.home-statuses__grid,
.home-adoptions__grid {
  display: grid;
  gap: var(--space-6);
}

.home-entry {
  position: relative;
  display: grid;
  min-height: 16rem;
  overflow: hidden;
  color: var(--public-text-inverse);
  background: var(--image-placeholder);
  border-radius: var(--radius-md);
}

.home-entry__media,
.home-entry__shade,
.home-entry__label {
  grid-area: 1 / 1;
}

.home-entry__media,
.home-entry__media :deep(.responsive-picture),
.home-entry__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.home-entry__media :deep(.responsive-picture__image) {
  object-fit: cover;
  transition: transform var(--duration-section) var(--easing-standard);
}

.home-entry__shade {
  background: linear-gradient(to top, rgb(17 20 25 / 0.62), transparent 60%);
}

.home-entry__label {
  z-index: 1;
  align-self: end;
  padding: var(--space-6);
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.home-entry:hover {
  color: var(--public-text-inverse);
}

.home-entry:hover .home-entry__media :deep(.responsive-picture__image) {
  transform: scale(var(--image-hover-scale));
}

.home-section-title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

.home-statuses,
.home-adoptions {
  display: grid;
  gap: var(--space-5);
}

.home-statuses__item {
  padding: var(--space-5);
  color: var(--public-text-primary);
  background: var(--public-bg-secondary);
  border-radius: var(--radius-md);
}

.home-statuses__item:hover {
  color: var(--public-text-primary);
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
  .home-entry-grid,
  .home-statuses__grid,
  .home-adoptions__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-entry-grid > :only-child,
  .home-statuses__grid > :only-child {
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-entry__media :deep(.responsive-picture__image) {
    transition: none;
  }

  .home-entry:hover .home-entry__media :deep(.responsive-picture__image) {
    transform: none;
  }
}
</style>
