<script setup lang="ts">
import type {
  PublicHeroPlacementDto,
  PublicSiteBusinessStatusDto,
} from '~~/shared/types/contracts'

const props = defineProps<{
  description?: string | undefined
  hero: PublicHeroPlacementDto
  status?: PublicSiteBusinessStatusDto | null | undefined
}>()

const landscape = computed(() => props.hero.landscape[0])
const portrait = computed(() => props.hero.portrait[0])
const sources = computed(() => landscape.value?.sources ?? portrait.value?.sources)
const portraitActive = shallowRef(false)
const alt = computed(() => (
  (portraitActive.value ? portrait.value?.alt : landscape.value?.alt)
  ?? landscape.value?.alt
  ?? portrait.value?.alt
  ?? '委托代表作品'
))
let orientationQuery: MediaQueryList | null = null

function onOrientationChange(event: MediaQueryListEvent) {
  portraitActive.value = event.matches
}

onMounted(() => {
  orientationQuery = window.matchMedia('(orientation: portrait)')
  portraitActive.value = orientationQuery.matches
  orientationQuery.addEventListener('change', onOrientationChange)
})

onBeforeUnmount(() => {
  orientationQuery?.removeEventListener('change', onOrientationChange)
})
</script>

<template>
  <section
    class="commission-lead"
    :class="{ 'commission-lead--without-media': !sources }"
    aria-labelledby="commission-lead-title"
  >
    <div class="commission-lead__display" aria-hidden="true">
      <span>CUSTOM</span>
      <span>COMMISSION</span>
    </div>

    <div
      v-if="sources"
      class="commission-lead__media"
    >
      <ResponsivePicture
        :sources="sources"
        :portrait-sources="portrait?.sources"
        :alt="alt"
        sizes="(min-width: 1024px) 64vw, calc(100vw - 2rem)"
        loading="eager"
        fetchpriority="high"
      />
    </div>

    <div class="commission-lead__content">
      <div class="commission-lead__identity">
        <h1 id="commission-lead-title" class="commission-lead__title">自设委托</h1>
      </div>

      <div class="commission-lead__narrative">
        <div v-if="status" class="commission-lead__status" aria-label="当前委托营业状态">
          <PublicBusinessStatus :status="status" />
        </div>
        <p class="commission-lead__description">
          {{ description || '先看设定，再一起确认做法、价格和排期。' }}
        </p>
      </div>

      <div class="commission-lead__actions">
        <PublicAction to="/commission/apply">提交委托申请</PublicAction>
        <PublicAction variant="text" to="/about#contact">查看其他联系方式 →</PublicAction>
      </div>
    </div>

    <NuxtLink
      class="commission-lead__continuation"
      to="#commission-details"
      aria-label="继续查看制作范围和估价联系"
    >
      <span>继续查看</span>
      <span class="commission-lead__continuation-rule" aria-hidden="true" />
      <span class="commission-lead__continuation-destination">制作范围与估价 ↓</span>
    </NuxtLink>
  </section>
</template>

<style scoped>
.commission-lead {
  position: relative;
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 1rem;
  min-width: 0;
  overflow: hidden;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
  isolation: isolate;
}

.commission-lead__display {
  position: absolute;
  inset: 3.2rem 1rem auto;
  z-index: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--public-background-type);
  font-family: var(--font-role-display-sans);
  font-size: clamp(1.25rem, 6vw, 1.75rem);
  font-weight: 800;
  line-height: 0.9;
  letter-spacing: -0.04em;
  pointer-events: none;
  user-select: none;
}

.commission-lead__display span:last-child {
  margin-left: auto;
}

.commission-lead__media {
  position: relative;
  z-index: 1;
  width: calc(100% - 1rem);
  height: min(56svh, 34rem);
  margin-top: 5rem;
  overflow: hidden;
  border-radius: var(--radius-image);
  background: #191f2a;
}

.commission-lead__media :deep(.responsive-picture),
.commission-lead__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.commission-lead__media :deep(.responsive-picture__image) {
  object-fit: cover;
}

.commission-lead__content {
  position: relative;
  z-index: 3;
  display: grid;
  gap: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--public-text-primary);
}

.commission-lead__identity,
.commission-lead__narrative,
.commission-lead__actions {
  display: grid;
  align-content: start;
  justify-items: start;
}

.commission-lead__identity {
  gap: 0.35rem;
}

.commission-lead__title {
  font-family: var(--font-role-display);
  font-size: 3.25rem;
  font-weight: 600;
  line-height: 0.94;
}

.commission-lead__narrative {
  gap: 0.75rem;
}

.commission-lead__description {
  max-width: 30rem;
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
}

.commission-lead__actions {
  gap: 0.5rem;
}

.commission-lead__continuation {
  position: relative;
  z-index: 4;
  display: grid;
  grid-template-columns: auto minmax(2rem, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.75rem;
  color: var(--public-text-secondary);
  font-family: var(--font-role-metadata);
  font-size: 0.6875rem;
  line-height: 1.2;
  text-decoration: none;
}

.commission-lead__continuation-rule {
  height: 1px;
  background: var(--public-border-primary);
}

.commission-lead__continuation-destination {
  color: var(--public-text-primary);
  font-family: var(--font-role-ui);
  font-size: 0.8125rem;
  font-weight: 600;
}

.commission-lead__continuation:hover {
  color: var(--public-text-primary);
}

.commission-lead__continuation:focus-visible {
  outline: 1px solid currentcolor;
  outline-offset: 4px;
}

@media (min-width: 768px) {
  .commission-lead__display {
    inset: 3.35rem -0.6rem auto;
    display: grid;
    gap: 0;
    font-size: 8rem;
    line-height: 0.76;
    letter-spacing: normal;
  }

  .commission-lead__display span:last-child {
    justify-self: end;
    margin-left: 0;
  }

  .commission-lead__media {
    justify-self: end;
    width: calc(100% - clamp(2rem, 8vw, 8rem));
    height: min(58svh, 38rem);
    margin-top: 3.5rem;
  }

  .commission-lead__content {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 1.5rem;
    padding-top: 1.5rem;
  }

  .commission-lead__identity {
    grid-column: 1 / 6;
  }

  .commission-lead__narrative {
    grid-column: 6 / 10;
  }

  .commission-lead__actions {
    grid-column: 10 / 13;
  }

  .commission-lead__title {
    font-size: clamp(3.75rem, 6vw, 5.75rem);
  }

  .commission-lead--without-media .commission-lead__content {
    margin-top: 8rem;
  }
}

@media (min-width: 1024px) {
  .commission-lead {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: auto minmax(34rem, auto) auto;
    column-gap: clamp(1.5rem, 2.5vw, 3rem);
  }

  .commission-lead__media {
    grid-column: 5 / 13;
    grid-row: 2;
    align-self: center;
    justify-self: stretch;
    width: auto;
    height: min(62svh, 38rem);
    margin-top: 4rem;
  }

  .commission-lead__content {
    grid-column: 1 / 5;
    grid-row: 2;
    align-self: center;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
    margin-top: 4rem;
    padding: 0 clamp(0.5rem, 1.5vw, 1.5rem) 0 0;
    border-top: 0;
  }

  .commission-lead__continuation {
    grid-column: 1 / 13;
    grid-row: 3;
  }

  .commission-lead__identity,
  .commission-lead__narrative,
  .commission-lead__actions {
    grid-column: 1;
    grid-row: auto;
  }

  .commission-lead__identity {
    gap: 0.65rem;
  }

  .commission-lead__title {
    font-size: clamp(3.75rem, 5.2vw, 4.8rem);
  }

  .commission-lead__description {
    max-width: 24rem;
  }

  .commission-lead--without-media {
    grid-template-rows: auto auto auto;
  }

  .commission-lead--without-media .commission-lead__content {
    grid-column: 1 / 8;
    margin-top: 8rem;
  }
}

@media (min-width: 1200px) {
  .commission-lead__display {
    font-size: 11rem;
  }
}

@media (orientation: portrait) and (max-width: 1023px) {
  .commission-lead__media {
    justify-self: center;
    width: min(100%, 27rem, 38svh);
    height: auto;
    aspect-ratio: 4 / 5;
  }
}

@media (prefers-contrast: more) {
  .commission-lead__display {
    color: var(--public-border-secondary);
  }
}
</style>
