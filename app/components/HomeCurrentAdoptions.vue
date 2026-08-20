<script setup lang="ts">
import type {
  PublicAdoptionListItemDto,
  PublicSiteBusinessStatusDto,
} from '~~/shared/types/contracts'
import WorkIdentityLabel from '~/components/WorkIdentityLabel.vue'
import HomeBusinessStatus from '~/components/HomeBusinessStatus.vue'
import { formatCnyMinorUnits } from '~/utils/format'
import { ADOPTION_STATUS_LABELS } from '~/utils/work-labels'

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
const detailTo = computed(() => currentAdoption.value
  ? {
      path: currentAdoption.value.href,
      query: { from: 'adoptions' },
    }
  : '/adoptions',
)
</script>

<template>
  <section
    v-if="available && currentAdoption"
    class="home-adoptions"
    aria-labelledby="home-adoptions-title"
    data-testid="home-current-adoptions"
  >
    <header class="home-adoptions__header">
      <div>
        <p class="home-adoptions__eyebrow">CURRENT ADOPTION</p>
        <h2 id="home-adoptions-title" class="home-adoptions__title">设定领养</h2>
      </div>
    </header>

    <article class="home-adoption-poster" :data-work-slug="currentAdoption.work.slug">
      <div class="home-adoption-poster__media">
        <ResponsivePicture
          :sources="currentAdoption.cover.sources"
          :alt="currentAdoption.cover.alt"
          sizes="(min-width: 1024px) 68vw, 100vw"
        />
      </div>
      <div class="home-adoption-poster__caption">
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

.home-adoptions__header {
  display: grid;
}

.home-adoptions__header > div {
  display: grid;
  gap: var(--space-2);
}

.home-adoptions__eyebrow {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.16em;
}

.home-adoptions__title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
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
  .home-adoption-poster {
    grid-template-columns: minmax(0, 2.2fr) minmax(18rem, 0.8fr);
    align-items: stretch;
  }

}
</style>
