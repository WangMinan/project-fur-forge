<script setup lang="ts">
import type { PublicWorkSummaryDto } from '~~/shared/types/contracts'
import WorkIdentityLabel from '~/components/WorkIdentityLabel.vue'

/**
 * 首页精选轨道：人工顺序由服务端聚合投影保证。
 * T34-F2 起由首页聚合传入，不再自行请求，精选异常不再放大为整页 500。
 */
const props = defineProps<{
  available: boolean
  works: PublicWorkSummaryDto[]
}>()

const works = computed(() => (props.available ? props.works : []))
const lead = computed(() => works.value[0] ?? null)
const secondary = computed(() => works.value.slice(1))
</script>

<template>
  <section
    v-if="lead"
    class="featured-works"
    aria-labelledby="featured-works-title"
    data-testid="featured-works"
  >
    <header class="featured-works__header">
      <div>
        <p class="featured-works__eyebrow">SELECTED WORK</p>
        <h2 id="featured-works-title" class="featured-works__title">代表作品</h2>
      </div>
    </header>

    <article class="featured-lead" :data-orientation="lead.cardOrientation">
      <div class="featured-lead__media">
        <ResponsivePicture
          :sources="lead.card.sources"
          :alt="lead.card.alt"
          sizes="(min-width: 1024px) 68vw, 100vw"
        />
      </div>
      <div class="featured-lead__caption">
        <p class="featured-lead__number">01</p>
        <h3 class="featured-lead__name">
          <WorkIdentityLabel
            :character-name="lead.work.characterName"
            :species="lead.work.species"
          />
        </h3>
        <div class="featured-lead__actions">
          <PublicAction to="/works" variant="secondary">
            浏览作品展示
          </PublicAction>
          <PublicAction :to="lead.href">
            查看当前作品
          </PublicAction>
        </div>
      </div>
    </article>

    <div v-if="secondary.length > 0" class="featured-works__secondary">
      <header class="featured-works__secondary-head">
        <h3>继续浏览</h3>
      </header>
      <FeaturedTrack :works="secondary" />
    </div>
    <PublicAction v-else to="/works" variant="text" class="featured-works__all">
      查看全部作品 <span aria-hidden="true">→</span>
    </PublicAction>
  </section>
</template>

<style scoped>
.featured-works {
  display: grid;
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-6) var(--public-page-padding) 0;
}

.featured-works__header {
  display: grid;
  margin-bottom: var(--space-6);
}

.featured-works__header > div {
  display: grid;
  gap: var(--space-2);
}

.featured-works__eyebrow,
.featured-lead__number {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.16em;
}

.featured-works__title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

.featured-lead {
  display: grid;
  gap: var(--space-6);
}

.featured-lead__media {
  display: grid;
  height: var(--home-scene-media-height);
  overflow: hidden;
  background: var(--public-bg-secondary);
  border-radius: var(--radius-image);
  place-items: center;
}

.featured-lead__media :deep(.responsive-picture),
.featured-lead__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.featured-lead__media :deep(.responsive-picture__image) {
  object-fit: contain;
}

.featured-lead__caption {
  display: grid;
  align-content: end;
  justify-items: start;
  gap: var(--space-3);
  max-width: 28rem;
}

.featured-lead__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.featured-lead__name {
  margin: 0;
  font-family: var(--font-public-display);
  font-size: clamp(1.75rem, 3vw, 3rem);
  font-weight: 600;
  line-height: var(--line-height-heading);
}

.featured-works__secondary {
  position: relative;
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  margin-top: var(--space-6);
}

.featured-works__secondary-head {
  padding-right: 6.5rem;
}

.featured-works__secondary :deep(.featured-track__controls) {
  position: absolute;
  top: -0.5rem;
  right: 0;
  margin: 0;
}

.featured-works__secondary-head h3 {
  margin: 0;
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.featured-works__all {
  justify-self: end;
  margin-top: var(--space-5);
}

@media (max-width: 767px) {
  .featured-lead__media {
    height: var(--home-scene-media-height);
  }
}

@media (min-width: 1024px) {
  .featured-lead {
    grid-template-columns: minmax(0, 2.35fr) minmax(18rem, 0.65fr);
    align-items: stretch;
  }

  .featured-lead__caption {
    padding: var(--space-6) 0 var(--space-4);
  }
}
</style>
