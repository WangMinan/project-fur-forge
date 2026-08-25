<script setup lang="ts">
import type { PublicHomeEntryCardDto } from '~~/shared/types/contracts'
import { useMotionEntrance } from '~/composables/useMotionEntrance'

const props = defineProps<{
  entries: {
    adoption: PublicHomeEntryCardDto | null
    commission: PublicHomeEntryCardDto | null
  }
}>()

const commission = computed(() => props.entries.commission)
const rootRef = useTemplateRef<HTMLElement>('root')
const mediaRef = useTemplateRef<HTMLElement>('media')
const bodyRef = useTemplateRef<HTMLElement>('body')

const commissionTo = {
  path: '/commission',
  query: { view: 'home-commission' },
} as const

useMotionEntrance(rootRef, ({ reduced, tokens }) => {
  const media = mediaRef.value
  const body = bodyRef.value
  if (!media || !body) {
    return []
  }
  if (reduced) {
    return [media, body].map(element => element.animate(
      [{ opacity: 0.72 }, { opacity: 1 }],
      { duration: tokens.state, easing: tokens.easing, fill: 'both' },
    ))
  }
  return [
    media.animate(
      [
        { opacity: 0.72, transform: 'translateY(16px) scale(0.99)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      { duration: tokens.content, easing: tokens.easing, fill: 'both' },
    ),
    body.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: tokens.content, delay: 90, easing: tokens.easing, fill: 'both' },
    ),
  ]
})
</script>

<template>
  <section
    v-if="commission"
    ref="root"
    class="home-commission"
    aria-labelledby="home-entries-title"
    data-home-scroll-scene
    data-testid="home-business-entries"
  >
    <header class="home-commission__heading">
      <h2 id="home-entries-title" class="home-commission__title">自设委托</h2>
    </header>

    <article
      class="home-commission__stage"
      :data-entry-kind="commission.kind"
      data-testid="home-business-entry"
    >
      <div class="home-commission__display" aria-hidden="true">
        <span>CUSTOM</span>
        <span>COMMISSION</span>
      </div>

      <div
        ref="media"
        class="home-commission__media"
        :style="{ viewTransitionName: 'home-commission-media' }"
      >
        <ResponsivePicture
          :sources="commission.sources"
          :alt="commission.alt"
          sizes="(min-width: 1024px) 64vw, 100vw"
        />
      </div>

      <div ref="body" class="home-commission__narrative">
        <div class="home-commission__service-heading">
          <h3 class="home-commission__promise">
            <span>从角色设定</span>
            <span>出发</span>
          </h3>
        </div>
        <div class="home-commission__service-facts">
          <PublicBusinessStatus
            v-if="commission.status"
            :status="commission.status"
          />
          <p class="home-commission__process">
            先通过站内表单提交。工作室评估后优先使用官方 QQ 私聊沟通。
          </p>
        </div>
        <div class="home-commission__actions">
          <PublicAction to="/commission/apply">
            提交委托申请
          </PublicAction>
          <PublicAction :to="commissionTo" variant="secondary">
            了解自设委托
          </PublicAction>
        </div>
      </div>
    </article>

    <div class="home-commission__wayfinding" aria-hidden="true">
      <span>下一幕</span>
      <span class="home-commission__wayfinding-rule" />
      <span>设定领养</span>
    </div>
  </section>
</template>

<style scoped>
.home-commission {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0.75rem;
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0.75rem var(--public-page-padding);
  overflow: clip;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
  isolation: isolate;
}

.home-commission__heading {
  position: relative;
  z-index: 4;
  width: min(100%, 32rem);
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--public-text-primary);
}

.home-commission__wayfinding {
  font-family: var(--font-public-mono);
  font-size: 0.6875rem;
  line-height: 1.2;
}

.home-commission__title {
  margin-top: 0.35rem;
  font-family: var(--font-public-display);
  font-size: 2rem;
  font-weight: 600;
  line-height: 1;
}

.home-commission__stage {
  position: relative;
  display: grid;
  align-content: start;
  min-width: 0;
  min-height: 0;
}

.home-commission__display {
  position: absolute;
  inset: 0.15rem -0.25rem auto;
  z-index: 0;
  display: grid;
  color: var(--public-background-type);
  font-family: var(--font-public-body);
  font-size: 3.55rem;
  font-weight: 800;
  line-height: 0.76;
  pointer-events: none;
  user-select: none;
}

.home-commission__display span:last-child {
  justify-self: end;
}

.home-commission__media {
  position: relative;
  z-index: 1;
  justify-self: end;
  display: block;
  width: calc(100% - 1rem);
  height: min(28svh, 16.25rem);
  margin-top: 4.75rem;
  overflow: hidden;
  border-radius: var(--radius-image);
  background: var(--image-placeholder);
}

.home-commission__media :deep(.responsive-picture),
.home-commission__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.home-commission__media :deep(.responsive-picture__image) {
  object-fit: cover;
  transition: transform var(--motion-duration-state) var(--motion-ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .home-commission__media:hover :deep(.responsive-picture__image) {
    transform: scale(1.025) rotate(0.35deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-commission__media :deep(.responsive-picture__image) {
    transition: none;
  }

  .home-commission__media:hover :deep(.responsive-picture__image) {
    transform: none;
  }
}

.home-commission__narrative {
  position: relative;
  z-index: 3;
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 0.85rem;
  width: calc(100% - 1.75rem);
  max-width: 32rem;
  margin-top: 1rem;
  margin-left: 1.75rem;
}

.home-commission__service-heading,
.home-commission__service-facts {
  display: grid;
  justify-items: start;
}

.home-commission__service-heading {
  gap: 0.35rem;
}

.home-commission__service-facts {
  gap: 0.6rem;
}

.home-commission__promise {
  font-family: var(--font-public-display);
  font-size: 2.35rem;
  font-weight: 600;
  line-height: 0.98;
}

.home-commission__promise span {
  display: block;
}

.home-commission__process {
  max-width: 27rem;
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.55;
}

.home-commission__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.home-commission__wayfinding {
  position: relative;
  z-index: 4;
  display: grid;
  grid-template-columns: auto minmax(2rem, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  color: var(--public-text-secondary);
}

.home-commission__wayfinding-rule {
  height: 1px;
  background: var(--public-border-primary);
}

.home-commission__heading {
  padding-bottom: 0.45rem;
}

.home-commission__title {
  margin-top: 0.2rem;
  font-size: 1.75rem;
}

.home-commission__process {
  line-height: 1.45;
}

.home-commission__actions {
  gap: var(--space-2);
}

.home-commission__wayfinding {
  gap: 0.5rem;
  font-size: 0.625rem;
}

@media (min-width: 768px) {
  .home-commission {
    height: calc(100svh - var(--public-anchor-offset));
    min-height: 0;
    padding-top: 1.5rem;
    padding-bottom: 1.25rem;
  }

  .home-commission__stage {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: minmax(0, 1fr);
    align-items: stretch;
    column-gap: clamp(1.25rem, 2.5vw, 2.75rem);
    height: 100%;
  }

  .home-commission__display {
    inset: 0.25rem -0.5rem auto;
    font-size: 7.5rem;
  }

  .home-commission__media {
    grid-column: 1 / 9;
    grid-row: 1;
    align-self: center;
    justify-self: start;
    width: calc(100% - clamp(0.75rem, 1.5vw, 1.25rem));
    height: min(58svh, 34rem);
    min-height: 0;
    margin-top: 3.5rem;
  }

  .home-commission__narrative {
    grid-column: 9 / 13;
    grid-row: 1;
    align-self: center;
    width: calc(100% + clamp(1.5rem, 2.5vw, 2.5rem));
    max-width: none;
    margin: 3.5rem 0 0 clamp(-2.5rem, -2.5vw, -1.5rem);
    padding-left: clamp(0.25rem, 1vw, 1rem);
    background: transparent;
  }

  .home-commission__promise {
    font-size: clamp(2.75rem, 5.4vw, 3.8rem);
  }

  .home-commission__process {
    max-width: 23rem;
    font-size: var(--font-size-base);
    line-height: var(--line-height-normal);
  }
}

@media (min-width: 1024px) {
  .home-commission {
    height: calc(100svh - var(--public-header-height));
  }

  .home-commission__media {
    height: min(59svh, 35rem);
  }

  .home-commission__narrative {
    gap: 1.25rem;
    padding-left: clamp(0.75rem, 2vw, 2rem);
  }
}

@media (min-width: 1200px) {
  .home-commission__display {
    font-size: 10rem;
  }
}

@media (prefers-contrast: more) {
  .home-commission__display {
    color: var(--public-border-secondary);
  }
}
</style>
