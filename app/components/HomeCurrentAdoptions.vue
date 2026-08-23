<script setup lang="ts">
import type { PublicAdoptionListItemDto } from '~~/shared/types/contracts'
import WorkIdentityLabel from '~/components/WorkIdentityLabel.vue'
import { ADOPTION_STATUS_LABELS } from '~/utils/work-labels'
import { useMotionEntrance } from '~/composables/useMotionEntrance'

/**
 * T34-F2 当前领养：入口与状态已合并到 HomeBusinessEntries，本区只保留真实领养。
 * 聚合投影标记该区块不可用时整区隐藏，不显示服务端错误详情。
 *
 * R4-E：名称·物种与领养状态合并到同一行；不展示价格（价格逐单在官方 QQ 确认）。
 * 领养营业状态已退役，本幕不再展示状态组件；能否领取由角色自己的领养状态表达。
 */
const props = defineProps<{
  adoptions: PublicAdoptionListItemDto[]
  available: boolean
  lead: string | null
}>()

const currentAdoption = computed(() => (
  props.adoptions.find(item => item.work.adoptionStatus === 'available') ?? null
))
const rootRef = useTemplateRef<HTMLElement>('root')
const mediaRef = useTemplateRef<HTMLElement>('media')
const introRef = useTemplateRef<{ root: HTMLElement | null }>('intro')
const detailTo = computed(() => currentAdoption.value
  ? {
      path: currentAdoption.value.href,
      query: { from: 'adoptions', view: 'home-adoption' },
    }
  : '/adoptions',
)

useMotionEntrance(rootRef, ({ reduced, tokens }) => {
  const media = mediaRef.value
  const caption = introRef.value?.root ?? null
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
    class="home-scene home-adoptions"
    aria-labelledby="home-adoptions-title"
    data-home-scroll-scene
    data-testid="home-current-adoptions"
  >
    <article
      class="home-scene__stage home-scene__stage--media-end home-adoption-poster"
      :data-work-slug="currentAdoption.work.slug"
    >
      <HomeSceneIntro
        ref="intro"
        class="home-scene__text"
        eyebrow="CURRENT ADOPTION"
        title="设定领养"
        title-id="home-adoptions-title"
        :lead="lead"
      >
        <template #meta>
          <!--
            名称·物种与领养状态同一行；两者保持独立文本节点，
            读屏仍可分别识别。
          -->
          <p class="home-adoption-poster__identity">
            <span class="home-adoption-poster__name">
              <WorkIdentityLabel
                :character-name="currentAdoption.work.characterName"
                :species="currentAdoption.work.species"
              />
            </span>
            <span class="home-adoption-poster__state">
              {{ ADOPTION_STATUS_LABELS[currentAdoption.work.adoptionStatus] }}
            </span>
          </p>
        </template>

        <template #actions>
          <PublicAction to="/adoptions" variant="secondary">
            浏览设定领养
          </PublicAction>
          <PublicAction :to="detailTo">
            查看当前角色
          </PublicAction>
        </template>
      </HomeSceneIntro>

      <div class="home-scene__media home-scene__media-framed">
        <div
          ref="media"
          class="home-adoption-poster__media"
          :style="{ viewTransitionName: 'home-adoption-media' }"
        >
          <ResponsivePicture
            :sources="currentAdoption.cover.sources"
            :alt="currentAdoption.cover.alt"
            sizes="(min-width: 1024px) 52vw, 100vw"
          />
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
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

@media (min-width: 1024px) {
  /* 画幅已吃下整段媒体高度；图片填满 inset 后的剩余空间，空隙留给引导线。 */
  .home-adoption-poster__media {
    height: 100%;
  }
}

@media (hover: hover) and (pointer: fine) {
  .home-adoption-poster__media {
    transition: box-shadow var(--motion-duration-state) var(--motion-ease-standard);
  }

  /* 与 /works 卡片同一套 hover 观感（T6）。 */
  .home-adoption-poster__media:hover {
    box-shadow: var(--shadow-card-hover);
  }

  .home-adoption-poster__media:hover :deep(.responsive-picture__image) {
    transform: scale(var(--image-hover-scale));
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-adoption-poster__media,
  .home-adoption-poster__media :deep(.responsive-picture__image) {
    transition: none;
  }

  .home-adoption-poster__media:hover :deep(.responsive-picture__image) {
    transform: none;
  }
}

/* 名称与状态同一行：名称为主、状态为辅，靠字号与颜色分级而不是换行。 */
.home-adoption-poster__identity {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-4);
  margin: 0;
}

.home-adoption-poster__name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
  font-weight: 600;
  line-height: var(--line-height-heading);
}

.home-adoption-poster__state {
  color: var(--public-status-open);
  font-size: var(--font-size-sm);
  font-weight: 700;
  letter-spacing: var(--letter-spacing-label);
}
</style>
