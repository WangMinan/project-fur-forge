<script setup lang="ts">
import type {
  PublicAdoptionListItemDto,
  PublicSiteBusinessStatusDto,
} from '~~/shared/types/contracts'
import WorkIdentityLabel from '~/components/WorkIdentityLabel.vue'
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

const currentAdoption = computed(() => (
  props.adoptions.find(item => item.work.adoptionStatus === 'available') ?? null
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
    <header class="home-scene-heading">
      <p class="home-scene-heading__eyebrow">CURRENT ADOPTION</p>
      <h2 id="home-adoptions-title" class="home-scene-heading__title">设定领养</h2>
    </header>

    <article class="home-adoption-poster" :data-work-slug="currentAdoption.work.slug">
      <div
        ref="media"
        class="home-adoption-poster__media"
        :style="{ viewTransitionName: 'home-adoption-media' }"
      >
        <ResponsivePicture
          :sources="currentAdoption.cover.sources"
          :alt="currentAdoption.cover.alt"
          sizes="(min-width: 1024px) 68vw, 100vw"
        />
      </div>
      <div ref="caption" class="home-adoption-poster__caption">
        <HomeBusinessStatus v-if="status" :status="status" />
        <p class="home-adoption-poster__status">
          {{ ADOPTION_STATUS_LABELS[currentAdoption.work.adoptionStatus] }}
        </p>
        <h3>
          <WorkIdentityLabel
            :character-name="currentAdoption.work.characterName"
            :species="currentAdoption.work.species"
          />
        </h3>
        <p v-if="price" class="home-adoption-poster__price">{{ price }}</p>
        <div class="home-adoption-poster__actions">
          <PublicAction to="/adoptions" variant="secondary">
            浏览设定领养
          </PublicAction>
          <PublicAction :to="detailTo">
            查看当前角色
          </PublicAction>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.home-adoptions {
  display: grid;
  gap: var(--space-6);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-6) var(--public-page-padding) 0;
}

.home-adoption-poster {
  display: grid;
  gap: var(--space-5);
}

.home-adoption-poster__media {
  display: grid;
  height: var(--home-scene-media-height);
  overflow: hidden;
  background: var(--image-placeholder);
  border-radius: var(--radius-image);
  place-items: center;
}

.home-adoption-poster__media :deep(.responsive-picture),
.home-adoption-poster__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.home-adoption-poster__media :deep(.responsive-picture__image) {
  object-fit: cover;
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
  display: grid;
  align-content: center;
  justify-items: start;
  gap: var(--space-3);
  max-width: 28rem;
}

.home-adoption-poster__caption h3 {
  margin: 0;
  font-family: var(--font-public-display);
  font-size: clamp(1.75rem, 3.5vw, 3.5rem);
  font-weight: 600;
  line-height: var(--line-height-heading);
}

.home-adoption-poster__status {
  color: var(--public-status-open);
  font-size: var(--font-size-sm);
  font-weight: 700;
  letter-spacing: var(--letter-spacing-label);
}

.home-adoption-poster__price {
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
}

.home-adoption-poster__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

@media (min-width: 1024px) {
  .home-adoptions {
    min-height: calc(100svh - var(--public-header-height));
    align-content: center;
    padding-block: var(--space-6);
  }
}

@media (min-width: 1024px) {
  .home-adoption-poster {
    grid-template-columns: minmax(0, 2.2fr) minmax(18rem, 0.8fr);
    align-items: stretch;
  }

}
</style>
