<script setup lang="ts">
import type {
  PublicHeroSlideDto,
  PublicSiteBusinessStatusDto,
} from '~~/shared/types/contracts'

const props = defineProps<{
  description?: string | undefined
  email?: string | null | undefined
  slide: PublicHeroSlideDto
  status?: PublicSiteBusinessStatusDto | null | undefined
}>()

const mailtoHref = computed(() => props.email
  ? `mailto:${props.email}?subject=${encodeURIComponent('自设委托估价咨询')}`
  : null)
</script>

<template>
  <section class="commission-lead" aria-labelledby="commission-lead-title">
    <div class="commission-lead__media">
      <ResponsivePicture
        :sources="slide.landscape"
        :portrait-sources="slide.portrait"
        :alt="slide.alt"
        sizes="(min-width: 1440px) 1440px, calc(100vw - 2rem)"
        loading="eager"
        fetchpriority="high"
      />
    </div>

    <div class="commission-lead__content">
      <div v-if="status" class="commission-lead__status" aria-label="当前委托营业状态">
        <PublicBusinessStatus :status="status" />
      </div>
      <p class="commission-lead__eyebrow">全装 · 半装</p>
      <h2 id="commission-lead-title" class="commission-lead__title">从角色设定出发</h2>
      <p class="commission-lead__description">
        {{ description || '根据角色细节与制作需求逐单沟通、人工估价。' }}
      </p>
      <div class="commission-lead__actions">
        <a class="commission-lead__action commission-lead__action--primary" href="#commission-details">
          了解制作范围
        </a>
        <a
          v-if="mailtoHref"
          class="commission-lead__action commission-lead__action--secondary"
          :href="mailtoHref"
        >邮件咨询估价</a>
      </div>
      <NuxtLink
        v-if="slide.linkedWorkHref"
        :to="slide.linkedWorkHref"
        class="commission-lead__work-link"
      >查看这件作品 <span aria-hidden="true">→</span></NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.commission-lead {
  position: relative;
  display: grid;
  min-height: clamp(30rem, 68svh, 36rem);
  overflow: hidden;
  isolation: isolate;
  border-radius: var(--radius-md);
  background: var(--image-placeholder);
}

.commission-lead::after {
  position: absolute;
  z-index: 0;
  inset: 0;
  content: '';
  background:
    linear-gradient(180deg, rgb(17 20 25 / 0.04) 20%, rgb(17 20 25 / 0.78) 100%),
    linear-gradient(90deg, rgb(17 20 25 / 0.5) 0%, transparent 68%);
}

.commission-lead__media {
  position: absolute;
  inset: 0;
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
  z-index: 1;
  align-self: end;
  display: grid;
  justify-items: start;
  gap: var(--space-3);
  max-width: 48rem;
  padding: clamp(1.5rem, 5vw, 4.5rem);
  color: var(--public-text-inverse);
}

.commission-lead__status {
  padding: var(--space-2) var(--space-3);
  border: 1px solid rgb(255 255 255 / 0.38);
  border-radius: var(--radius-lg);
  background: rgb(17 20 25 / 0.48);
}

.commission-lead__status :deep(.business-status__detail) {
  color: rgb(255 255 255 / 0.78);
}

.commission-lead__eyebrow {
  font-size: var(--font-size-sm);
  font-weight: 600;
  letter-spacing: var(--letter-spacing-label);
}

.commission-lead__title {
  font-family: var(--font-public-display);
  font-size: clamp(2.25rem, 7vw, 4.75rem);
  font-weight: 600;
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-tight);
}

.commission-lead__description {
  max-width: 34rem;
  color: rgb(255 255 255 / 0.9);
  line-height: var(--line-height-relaxed);
}

.commission-lead__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.commission-lead__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0 var(--space-5);
  border: 1px solid rgb(255 255 255 / 0.7);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.commission-lead__action--primary {
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
}

.commission-lead__action--primary:hover {
  color: var(--public-accent-active);
  background: var(--public-bg-secondary);
}

.commission-lead__action--secondary,
.commission-lead__action--secondary:hover {
  color: var(--public-text-inverse);
  background: rgb(17 20 25 / 0.3);
}

.commission-lead__action--secondary:hover {
  background: rgb(17 20 25 / 0.52);
}

.commission-lead__work-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  color: rgb(255 255 255 / 0.86);
  font-size: var(--font-size-sm);
}

.commission-lead__work-link:hover {
  color: var(--public-text-inverse);
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

@media (min-width: 768px) {
  .commission-lead {
    min-height: clamp(30rem, 48vw, 38rem);
  }
}
</style>
