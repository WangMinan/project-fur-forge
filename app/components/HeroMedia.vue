<script setup lang="ts">
import { heroFixture } from '~~/shared/fixtures/visual-home'

const hero = heroFixture
</script>

<template>
  <section
    class="hero-media"
    aria-label="代表作品"
    data-testid="public-hero"
  >
    <div class="hero-media__backdrop" aria-hidden="true">
      <ResponsiveAsset
        class="hero-media__image"
        :src="hero.media.src"
        :alt="hero.media.alt"
        :width="hero.media.width"
        :height="hero.media.height"
        :focal-desktop="hero.media.focal.desktop"
        :focal-mobile="hero.media.focal.mobile"
        loading="eager"
        fetchpriority="high"
        sizes="100vw"
      />
    </div>

    <div class="hero-media__scrim" aria-hidden="true" />

    <div class="hero-media__content">
      <p class="hero-media__eyebrow">
        {{ hero.englishName }}
      </p>
      <h1 class="hero-media__title">
        {{ hero.studioName }}
      </h1>
      <p class="hero-media__tagline">
        {{ hero.tagline }}
      </p>
      <NuxtLink :to="hero.action.href" class="hero-media__action">
        {{ hero.action.label }}
      </NuxtLink>
    </div>

    <p class="hero-media__scroll-hint">
      <span class="hero-media__scroll-line" aria-hidden="true" />
      {{ hero.scrollHint }}
    </p>
  </section>
</template>

<style scoped>
.hero-media {
  position: relative;
  display: flex;
  min-height: var(--hero-min-height);
  color: var(--public-text-inverse);
  overflow: hidden;
  flex-direction: column;
  justify-content: flex-end;
}

.hero-media__backdrop,
.hero-media__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hero-media__scrim {
  position: absolute;
  inset: 0;
  /* 确定性对比度保护：顶部导航区与左下文字安全区各自一条受控渐变，
     对任意正式图片成立（最不利纯白底图上白字仍 ≥ 4.5:1），不做整页黑蒙版。 */
  background:
    linear-gradient(
      to bottom,
      rgb(17 20 25 / 0.64) 0%,
      rgb(17 20 25 / 0.62) 6%,
      rgb(17 20 25 / 0.3) 12%,
      rgb(17 20 25 / 0) 19%
    ),
    linear-gradient(
      to bottom,
      rgb(17 20 25 / 0) 40%,
      rgb(17 20 25 / 0.62) 52%,
      rgb(17 20 25 / 0.68) 100%
    );
}

.hero-media__content {
  position: relative;
  width: 100%;
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-9);
}

.hero-media__eyebrow {
  font-size: var(--font-size-sm);
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.hero-media__title {
  margin-top: var(--space-3);
  font-family: var(--font-public-display);
  font-size: var(--font-size-hero);
  font-weight: 600;
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-tight);
}

.hero-media__tagline {
  max-width: 32rem;
  margin-top: var(--space-4);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

.hero-media__action {
  display: inline-flex;
  align-items: center;
  min-height: 3rem;
  margin-top: var(--space-6);
  padding: var(--space-3) var(--space-6);
  color: var(--public-text-inverse);
  font-size: var(--font-size-base);
  background: var(--public-accent-primary);
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast) var(--easing-standard);
}

.hero-media__action:hover {
  color: var(--public-text-inverse);
  background: var(--public-accent-hover);
}

.hero-media__scroll-hint {
  position: absolute;
  right: var(--public-page-padding);
  bottom: var(--space-5);
  display: none;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--font-size-xs);
  letter-spacing: var(--letter-spacing-label);
}

.hero-media__scroll-line {
  width: 2.5rem;
  height: 1px;
  background: currentcolor;
}

@media (min-width: 1024px) {
  .hero-media__scroll-hint {
    display: inline-flex;
  }
}
</style>
