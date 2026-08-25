<script setup lang="ts">
import type {
  PublicAdoptionListItemDto,
  PublicSiteBusinessStatusDto,
} from '~~/shared/types/contracts'
import HomeBusinessStatus from '~/components/HomeBusinessStatus.vue'
import { formatCnyMinorUnits } from '~/utils/format'
import { ADOPTION_STATUS_LABELS } from '~/utils/work-labels'
import { useMotionEntrance } from '~/composables/useMotionEntrance'

/**
 * T34-F2 当前领养：入口与状态已合并到 HomeBusinessEntries，本区只保留真实领养。
 * 聚合投影标记该区块不可用时整区隐藏，不显示服务端错误详情。
 */
const props = defineProps<{
  adoptions: PublicAdoptionListItemDto[]
  available: boolean
  status: PublicSiteBusinessStatusDto | null
}>()

const visibleAdoptions = computed(() => props.adoptions
  .filter(item => item.work.adoptionStatus === 'available')
  .slice(0, 3),
)
const activeIndex = ref(0)
const hasMultipleAdoptions = computed(() => visibleAdoptions.value.length > 1)
const currentAdoption = computed(() => visibleAdoptions.value[activeIndex.value] ?? null)
const hasLongCharacterName = computed(() => (
  (currentAdoption.value?.work.characterName.length ?? 0) >= 7
))
const price = computed(() => currentAdoption.value?.work.price
  ? formatCnyMinorUnits(currentAdoption.value.work.price.minorUnits)
  : null,
)
const rootRef = useTemplateRef<HTMLElement>('root')
const mediaRef = useTemplateRef<HTMLElement>('media')
const captionRef = useTemplateRef<HTMLElement>('caption')
const detailTo = computed(() => currentAdoption.value
  ? {
      path: currentAdoption.value.href,
      query: { from: 'adoptions', view: 'home-adoption' },
    }
  : '/adoptions',
)

watch(
  () => visibleAdoptions.value.map(item => item.work.slug).join('|'),
  () => {
    activeIndex.value = 0
  },
)

function formatFolio(index: number) {
  return String(index + 1).padStart(2, '0')
}

function selectAdoption(index: number) {
  if (index < 0 || index >= visibleAdoptions.value.length) {
    return
  }
  activeIndex.value = index
}

function selectPreviousAdoption() {
  const count = visibleAdoptions.value.length
  if (count > 1) {
    activeIndex.value = (activeIndex.value - 1 + count) % count
  }
}

function selectNextAdoption() {
  const count = visibleAdoptions.value.length
  if (count > 1) {
    activeIndex.value = (activeIndex.value + 1) % count
  }
}

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
        {
          clipPath: 'inset(0 0 8% 0 round 12px)',
          opacity: 0.72,
          transform: 'scale(0.99)',
        },
        {
          clipPath: 'inset(0 0 0 0 round 12px)',
          opacity: 1,
          transform: 'scale(1)',
        },
      ],
      { duration: tokens.media, easing: tokens.easing, fill: 'both' },
    ),
    caption.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: tokens.content, delay: 100, easing: tokens.easing, fill: 'both' },
    ),
  ]
})
</script>

<template>
  <section
    v-if="available && currentAdoption"
    ref="root"
    class="home-adoptions"
    aria-labelledby="home-adoptions-title"
    data-home-scroll-scene
    data-testid="home-current-adoptions"
  >
    <header class="home-adoptions__heading">
      <h2 id="home-adoptions-title" class="home-adoptions__title">设定领养</h2>
    </header>

    <article
      class="home-adoption-poster"
      :class="{ 'home-adoption-poster--multiple': hasMultipleAdoptions }"
      :data-work-slug="currentAdoption.work.slug"
    >
      <div class="home-adoption-poster__display" aria-hidden="true">
        <span>ADOPTIONS</span>
      </div>

      <NuxtLink
        ref="media"
        class="home-adoption-poster__media"
        :to="detailTo"
        :aria-label="`查看${currentAdoption.work.characterName}领养详情`"
        data-testid="home-adoption-media-link"
        :style="{ viewTransitionName: 'home-adoption-media' }"
      >
        <ResponsivePicture
          :sources="currentAdoption.cover.sources"
          :alt="currentAdoption.cover.alt"
          sizes="(min-width: 1024px) 68vw, 100vw"
        />
      </NuxtLink>

      <nav
        v-if="hasMultipleAdoptions"
        class="home-adoption-poster__selector"
        aria-label="首页领养角色选择"
        data-testid="home-adoption-selector"
        :style="{ gridTemplateColumns: `repeat(${visibleAdoptions.length}, minmax(0, 1fr))` }"
      >
        <button
          v-for="(adoption, index) in visibleAdoptions"
          :key="adoption.work.id"
          class="home-adoption-poster__selector-item"
          :class="{ 'home-adoption-poster__selector-item--active': index === activeIndex }"
          type="button"
          :aria-current="index === activeIndex ? 'true' : undefined"
          :data-work-slug="adoption.work.slug"
          @click="selectAdoption(index)"
        >
          <span>{{ formatFolio(index) }}</span>
          <strong>{{ adoption.work.characterName }}</strong>
        </button>
      </nav>

      <div ref="caption" class="home-adoption-poster__caption" aria-live="polite">
        <p class="home-adoption-poster__folio">
          <span>角色选择</span>
          <strong v-if="hasMultipleAdoptions">
            {{ formatFolio(activeIndex) }} / {{ formatFolio(visibleAdoptions.length - 1) }}
          </strong>
        </p>

        <div
          v-if="hasMultipleAdoptions"
          class="home-adoption-poster__stepper"
          aria-label="切换领养角色"
          data-testid="home-adoption-stepper"
        >
          <button
            type="button"
            aria-label="上一个领养角色"
            @click="selectPreviousAdoption"
          >
            <span aria-hidden="true">←</span> 上一个
          </button>
          <span class="home-adoption-poster__stepper-rule" aria-hidden="true" />
          <button
            type="button"
            aria-label="下一个领养角色"
            @click="selectNextAdoption"
          >
            下一个 <span aria-hidden="true">→</span>
          </button>
        </div>

        <div
          class="home-adoption-poster__identity"
          :class="{ 'home-adoption-poster__identity--long-name': hasLongCharacterName }"
        >
          <h3>{{ currentAdoption.work.characterName }}</h3>
          <p class="home-adoption-poster__species">{{ currentAdoption.work.species }}</p>
        </div>

        <dl class="home-adoption-poster__facts">
          <div>
            <dt>角色状态</dt>
            <dd>{{ ADOPTION_STATUS_LABELS[currentAdoption.work.adoptionStatus] }}</dd>
          </div>
          <div v-if="price">
            <dt>领养价格</dt>
            <dd>{{ price }}</dd>
          </div>
        </dl>

        <HomeBusinessStatus v-if="status" :status="status" />

        <div class="home-adoption-poster__actions">
          <PublicAction :to="detailTo">
            查看领养详情
          </PublicAction>
          <PublicAction to="/adoptions" variant="text">
            浏览全部角色 →
          </PublicAction>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.home-adoptions {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.75rem;
  min-height: calc(100svh - var(--public-header-height));
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0.75rem var(--public-page-padding) 1rem;
  overflow: clip;
  isolation: isolate;
}

.home-adoptions__heading {
  position: relative;
  z-index: 4;
  width: min(100%, 32rem);
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--public-text-primary);
}

.home-adoption-poster__folio,
.home-adoption-poster__facts dt {
  color: var(--public-text-secondary);
  font-family: var(--font-public-mono);
  font-size: 0.6875rem;
  line-height: 1.2;
}

.home-adoptions__title {
  margin-top: 0.35rem;
  font-family: var(--font-public-display);
  font-size: 2rem;
  font-weight: 600;
  line-height: 1;
}

.home-adoption-poster {
  position: relative;
  display: grid;
  align-content: center;
  min-width: 0;
  min-height: 0;
}

.home-adoption-poster__display {
  position: absolute;
  inset: 0.15rem -0.3rem auto;
  z-index: 0;
  display: grid;
  color: var(--public-background-type);
  font-family: var(--font-public-body);
  font-size: clamp(4.25rem, 15vw, 13rem);
  font-weight: 700;
  line-height: 0.68;
  letter-spacing: -0.08em;
  pointer-events: none;
  user-select: none;
}

.home-adoption-poster__media {
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 0;
  overflow: hidden;
  padding: clamp(0.5rem, 1.5vw, 1.5rem);
  background: var(--public-media-canvas);
  border-radius: var(--radius-image);
  color: inherit;
  place-items: center;
}

.home-adoption-poster__media:focus-visible {
  outline: 2px solid var(--public-border-focus);
  outline-offset: 4px;
}

.home-adoption-poster__media :deep(.responsive-picture),
.home-adoption-poster__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.home-adoption-poster__media :deep(.responsive-picture__image) {
  object-fit: contain;
  transition: transform var(--motion-duration-state) var(--motion-ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .home-adoption-poster__media:hover :deep(.responsive-picture__image) {
    transform: scale(1.025) rotate(0.35deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-adoption-poster__media :deep(.responsive-picture__image) {
    transition: none;
  }

  .home-adoption-poster__media:hover :deep(.responsive-picture__image) {
    transform: none;
  }
}

.home-adoption-poster__caption {
  position: relative;
  z-index: 2;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: var(--space-4);
  min-width: 0;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
}

.home-adoption-poster__selector {
  position: relative;
  z-index: 3;
  display: grid;
  min-width: 0;
  border-top: 1px solid var(--public-border-primary);
  border-bottom: 1px solid var(--public-border-primary);
}

.home-adoption-poster__selector-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.55rem var(--space-3);
  color: var(--public-text-secondary);
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.home-adoption-poster__selector-item + .home-adoption-poster__selector-item {
  border-left: 1px solid var(--public-border-primary);
}

.home-adoption-poster__selector-item span {
  font-family: var(--font-public-mono);
  font-size: 0.6875rem;
}

.home-adoption-poster__selector-item strong {
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-public-display);
  font-size: var(--font-size-sm);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-adoption-poster__selector-item--active {
  color: var(--public-text-primary);
  border-bottom-color: var(--public-text-primary);
}

.home-adoption-poster__selector-item:focus-visible {
  outline: 2px solid var(--public-focus-ring);
  outline-offset: -2px;
}

.home-adoption-poster__stepper {
  display: grid;
  grid-template-columns: auto minmax(1.5rem, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 2.75rem;
}

.home-adoption-poster__stepper button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  padding: 0;
  color: var(--public-text-primary);
  font-size: var(--font-size-sm);
  background: transparent;
  border: 0;
  cursor: pointer;
}

.home-adoption-poster__stepper button:focus-visible {
  outline: 2px solid var(--public-border-focus);
  outline-offset: 3px;
}

.home-adoption-poster__stepper-rule {
  height: 1px;
  background: var(--public-border-primary);
}

.home-adoption-poster__folio {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  width: 100%;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--public-border-primary);
}

.home-adoption-poster__folio strong {
  color: var(--public-text-primary);
  font-family: var(--font-public-mono);
  font-size: clamp(1.125rem, 1.5vw, 1.5rem);
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.04em;
}

.home-adoption-poster__identity {
  display: grid;
  gap: var(--space-2);
}

.home-adoption-poster__identity h3 {
  margin: 0;
  font-family: var(--font-public-display);
  font-size: clamp(2.5rem, 4.6vw, 4.75rem);
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: var(--letter-spacing-tight);
  overflow-wrap: anywhere;
}

.home-adoption-poster__identity--long-name h3 {
  font-size: clamp(2.25rem, 3.8vw, 4rem);
}

.home-adoption-poster__species {
  color: var(--public-text-secondary);
  font-size: var(--font-size-base);
}

.home-adoption-poster__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  margin: 0;
  border-top: 1px solid var(--public-border-primary);
}

.home-adoption-poster__facts div {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-3) 0 0;
}

.home-adoption-poster__facts div + div {
  padding-left: var(--space-3);
  border-left: 1px solid var(--public-border-primary);
}

.home-adoption-poster__facts dd {
  margin: 0;
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
}

.home-adoption-poster__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

@media (max-width: 767px) {
  .home-adoption-poster {
    grid-template-rows: auto auto auto;
    align-content: start;
    gap: 0.75rem;
  }

  .home-adoption-poster__media {
    height: min(34svh, 17rem);
    margin-top: clamp(3.5rem, 15vw, 5rem);
    padding: 0.5rem;
  }

  .home-adoption-poster--multiple .home-adoption-poster__media {
    height: min(28svh, 13.75rem);
  }

  .home-adoption-poster__selector-item {
    grid-template-columns: 1fr;
    align-content: center;
    gap: 0.1rem;
    min-height: 3rem;
    padding: 0.35rem 0.45rem;
  }

  .home-adoption-poster__selector-item strong {
    font-size: 0.75rem;
  }

  .home-adoption-poster__caption {
    gap: 0.65rem;
  }

  .home-adoption-poster__identity {
    gap: 0.35rem;
  }

  .home-adoption-poster__identity h3 {
    font-size: clamp(2.25rem, 11vw, 3.25rem);
  }

  .home-adoption-poster__identity--long-name h3 {
    font-size: clamp(2rem, 9vw, 2.75rem);
  }

  .home-adoption-poster__facts div {
    padding-top: 0.5rem;
  }

  .home-adoption-poster__actions {
    gap: var(--space-2);
  }

  .home-adoption-poster__actions :deep(.public-action) {
    min-height: 2.75rem;
    padding-inline: var(--space-4);
  }
}

@media (min-width: 1024px) {
  .home-adoption-poster {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: clamp(1.5rem, 2.5vw, 3rem);
  }

  .home-adoption-poster__media {
    grid-column: 4 / 12;
    grid-row: 1;
    height: min(64svh, 38rem);
    margin-top: clamp(2rem, 4vw, 4rem);
  }

  .home-adoption-poster__caption {
    grid-column: 1 / 5;
    grid-row: 1;
    padding: var(--space-4) var(--space-5) var(--space-4) 0;
  }

  .home-adoption-poster__selector {
    grid-column: 4 / 12;
    grid-row: 2;
    margin-top: var(--space-2);
  }
}
</style>
