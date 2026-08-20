<script setup lang="ts">
import type { PublicWorkSummaryDto } from '~~/shared/types/contracts'
import WorkIdentityLabel from '~/components/WorkIdentityLabel.vue'
import { useMotionEntrance } from '~/composables/useMotionEntrance'

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
const leadTo = computed(() => lead.value
  ? { path: lead.value.href, query: { view: 'home-featured' } }
  : '/works')
const rootRef = useTemplateRef<HTMLElement>('root')
const mediaRef = useTemplateRef<HTMLElement>('media')
const captionRef = useTemplateRef<HTMLElement>('caption')

useMotionEntrance(rootRef, ({ reduced, tokens }) => {
  const media = mediaRef.value
  const caption = captionRef.value
  if (!media || !caption) {
    return []
  }
  if (reduced) {
    return [media, caption].map(element => element.animate(
      [{ opacity: 0.72 }, { opacity: 1 }],
      { duration: tokens.state, easing: tokens.easing, fill: 'both' },
    ))
  }
  return [
    media.animate(
      [
        { opacity: 0.72, transform: 'translateY(12px) scale(0.99)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      { duration: tokens.content, easing: tokens.easing, fill: 'both' },
    ),
    caption.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: tokens.content, delay: 80, easing: tokens.easing, fill: 'both' },
    ),
  ]
})
</script>

<template>
  <section
    v-if="lead"
    ref="root"
    class="featured-works"
    aria-labelledby="featured-works-title"
    data-testid="featured-works"
  >
    <div class="featured-works__lead-scene" data-home-scroll-scene>
      <header class="featured-works__header">
        <div>
          <p class="featured-works__eyebrow">SELECTED WORK</p>
          <h2 id="featured-works-title" class="featured-works__title">代表作品</h2>
        </div>
      </header>

      <article class="featured-lead" :data-orientation="lead.cardOrientation">
        <div
          ref="media"
          class="featured-lead__media"
          :style="{ viewTransitionName: 'home-featured-media' }"
        >
          <ResponsivePicture
            :sources="lead.card.sources"
            :alt="lead.card.alt"
            sizes="(min-width: 1024px) 68vw, 100vw"
          />
        </div>
        <div ref="caption" class="featured-lead__caption">
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
            <PublicAction :to="leadTo">
              查看当前作品
            </PublicAction>
          </div>
        </div>
      </article>

      <PublicAction v-if="secondary.length === 0" to="/works" variant="text" class="featured-works__all">
        查看全部作品 <span aria-hidden="true">→</span>
      </PublicAction>
    </div>

    <div
      v-if="secondary.length > 0"
      class="featured-works__secondary"
      data-home-scroll-scene
    >
      <header class="featured-works__secondary-head">
        <h3>继续浏览</h3>
      </header>
      <FeaturedTrack :works="secondary" />
    </div>
  </section>
</template>

<style scoped>
.featured-works {
  display: grid;
  max-width: var(--public-content-wide);
  margin: 0 auto;
}

.featured-works__lead-scene,
.featured-works__secondary {
  padding: var(--space-6) var(--public-page-padding);
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
  transition: transform var(--motion-duration-state) var(--motion-ease-standard);
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
  .featured-works__lead-scene,
  .featured-works__secondary {
    display: grid;
    min-height: calc(100svh - var(--public-header-height));
    align-content: center;
  }

  .featured-works__secondary {
    --secondary-scene-padding-top: clamp(6rem, 13svh, 8rem);

    align-content: start;
    padding-top: var(--secondary-scene-padding-top);
  }

  .featured-works__secondary :deep(.featured-track__controls) {
    top: calc(var(--secondary-scene-padding-top) - 0.5rem);
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

@media (hover: hover) and (pointer: fine) {
  .featured-lead__media:hover :deep(.responsive-picture__image) {
    transform: scale(1.025) rotate(0.35deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .featured-lead__media :deep(.responsive-picture__image) {
    transition: none;
  }

  .featured-lead__media:hover :deep(.responsive-picture__image) {
    transform: none;
  }
}
</style>
