<script setup lang="ts">
import type { PublicWorkSummaryDto } from '~~/shared/types/contracts'
import { PUBLIC_FEATURED_LIMIT } from '~~/shared/constants/featured'

const props = defineProps<{
  available: boolean
  lead: string | null
  works: PublicWorkSummaryDto[]
}>()

const works = computed(() => (
  props.available ? props.works.slice(0, PUBLIC_FEATURED_LIMIT) : []
))

function workTo(work: PublicWorkSummaryDto) {
  return { path: work.href, query: { view: 'home-featured' } }
}
</script>

<template>
  <section
    v-if="works.length > 0"
    class="home-scene featured-works"
    aria-labelledby="featured-works-title"
    data-testid="featured-works"
    data-home-scroll-scene
  >
    <div class="home-scene__stage home-scene__stage--media-end">
      <!--
        DOM 顺序固定为文字块在前：桌面靠 grid 定位调换视觉左右，
        Tab 焦点不会在幕间来回跳。
      -->
      <HomeSceneIntro
        class="home-scene__text"
        eyebrow="SELECTED WORKS"
        title="代表作品"
        title-id="featured-works-title"
        :lead="lead"
      >
        <template #actions>
          <PublicAction to="/works">浏览作品展示</PublicAction>
        </template>
      </HomeSceneIntro>

      <div class="home-scene__media featured-works__media-grid">
        <article
          v-for="work in works"
          :key="work.work.id"
          class="featured-work"
        >
          <NuxtLink
            :to="workTo(work)"
            class="featured-work__media"
            :data-work-slug="work.work.slug"
          >
            <ResponsivePicture
              :sources="work.card.sources"
              :alt="work.card.alt"
              sizes="(min-width: 1024px) 23vw, (min-width: 768px) 44vw, 46vw"
            />
          </NuxtLink>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.featured-works__media-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.featured-work {
  min-width: 0;
}

.featured-work__media {
  display: block;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: var(--image-placeholder);
  border-radius: var(--radius-image);
}

.featured-work__media :deep(.responsive-picture),
.featured-work__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.featured-work__media :deep(.responsive-picture__image) {
  object-fit: cover;
  transition: transform var(--motion-duration-state) var(--motion-ease-standard);
}

@media (min-width: 1024px) {
  /**
   * 第二幕内部：双图各自 3:4，靠图片间距吸收本幕与第三/四幕单图的差异，
   * 使三幕左右边界完全等宽。栏比与 gap 由 .home-scene__stage 统一提供。
   */
  .featured-works__media-grid {
    gap: var(--space-5);
  }

  .featured-work__media {
    aspect-ratio: auto;
    height: var(--home-scene-media-height);
  }
}

@media (hover: hover) and (pointer: fine) {
  /* 与三/四幕及 /works 卡片共用同一套 hover 观感。 */
  .featured-work__media {
    transition: box-shadow var(--motion-duration-state) var(--motion-ease-standard);
  }

  .featured-work__media:hover {
    box-shadow: var(--shadow-card-hover);
  }

  .featured-work__media:hover :deep(.responsive-picture__image) {
    transform: scale(var(--image-hover-scale));
  }
}

@media (prefers-reduced-motion: reduce) {
  .featured-work__media,
  .featured-work__media :deep(.responsive-picture__image) {
    transition: none;
  }

  .featured-work__media:hover :deep(.responsive-picture__image) {
    transform: none;
  }
}
</style>
