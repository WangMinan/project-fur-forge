<script setup lang="ts">
import type { PublicHomeEntryCardDto } from '~~/shared/types/contracts'
import HomeBusinessStatus from '~/components/HomeBusinessStatus.vue'
import { useMotionEntrance } from '~/composables/useMotionEntrance'

const props = defineProps<{
  entries: {
    adoption: PublicHomeEntryCardDto | null
    commission: PublicHomeEntryCardDto | null
  }
  lead: string | null
}>()

const commission = computed(() => props.entries.commission)
const rootRef = useTemplateRef<HTMLElement>('root')
const mediaRef = useTemplateRef<HTMLElement>('media')
const introRef = useTemplateRef<{ root: HTMLElement | null }>('intro')

const commissionTo = {
  path: '/commission',
  query: { view: 'home-commission' },
} as const

useMotionEntrance(rootRef, ({ reduced, tokens }) => {
  const media = mediaRef.value
  const body = introRef.value?.root ?? null
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
    class="home-scene home-commission"
    aria-labelledby="home-entries-title"
    data-home-scroll-scene
    data-testid="home-business-entries"
  >
    <article
      class="home-scene__stage home-scene__stage--media-start"
      :data-entry-kind="commission.kind"
      data-testid="home-business-entry"
    >
      <HomeSceneIntro
        ref="intro"
        class="home-scene__text"
        eyebrow="CUSTOM COMMISSION"
        title="自设委托"
        title-id="home-entries-title"
        heading-align="center"
        :lead="lead"
      >
        <template v-if="commission.status" #status>
          <HomeBusinessStatus :status="commission.status" />
        </template>
        <template #actions>
          <PublicAction :to="commissionTo" variant="secondary">
            了解自设委托
          </PublicAction>
          <PublicAction to="/commission/apply">
            提交委托申请
          </PublicAction>
        </template>
      </HomeSceneIntro>

      <!-- 主图只承担展示与共享对象连续性，不作为整图链接（SPEC 5.3）。 -->
      <div class="home-scene__media home-scene__media-framed">
        <div
          ref="media"
          class="home-commission__media"
          :style="{ viewTransitionName: 'home-commission-media' }"
        >
          <ResponsivePicture
            :sources="commission.sources"
            :alt="commission.alt"
            sizes="(min-width: 1024px) 52vw, 100vw"
          />
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.home-commission__media {
  display: block;
  height: var(--home-scene-media-height);
  overflow: hidden;
  background: var(--image-placeholder);
  border-radius: var(--radius-image);
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

@media (min-width: 1024px) {
  /**
   * 画幅已经用 min-height 吃下整段媒体高度（border-box 含 padding），
   * 图片改为填满 inset 之后的剩余空间 —— 这就是「缩小图片」的实现，
   * 缩出来的一圈空隙留给 L 形引导线。
   * scoped 选择器带 data 属性，特异性高于全局规则，必须在这里覆盖。
   */
  .home-commission__media {
    height: 100%;
  }
}

@media (hover: hover) and (pointer: fine) {
  .home-commission__media {
    transition: box-shadow var(--motion-duration-state) var(--motion-ease-standard);
  }

  /* 与 /works 卡片同一套 hover 观感（T6）。 */
  .home-commission__media:hover {
    box-shadow: var(--shadow-card-hover);
  }

  .home-commission__media:hover :deep(.responsive-picture__image) {
    transform: scale(var(--image-hover-scale));
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-commission__media,
  .home-commission__media :deep(.responsive-picture__image) {
    transition: none;
  }

  .home-commission__media:hover :deep(.responsive-picture__image) {
    transform: none;
  }
}
</style>
