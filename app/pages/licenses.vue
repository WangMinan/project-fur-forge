<script setup lang="ts">
import gplText from '~/assets/licenses/gpl-3.0.txt?raw'
import generatedSummary from '~/assets/licenses/third-party-summary.json'
const { t } = usePublicI18n()

usePublicSeo('licenses')
useSeoMeta({ robots: 'index, nofollow' })

interface AssetNotice {
  homepage: string | null
  license: string
  name: string
  noticeText: string | null
  usage: string
  version: string
}

interface NoticeSummary {
  assets: AssetNotice[]
  ffmpegPackage: {
    license: string
    name: string
    version: string
  } | null
  generatorScope: 'installed-production-snapshot'
  licenseCounts: Array<{ count: number, license: string }>
  packageCount: number
}

const summary = generatedSummary as NoticeSummary
const assets = summary.assets
const ffmpegPackage = summary.ffmpegPackage
const documentMeta = computed(() => t('licenses.meta', { assets: assets.length, packages: summary.packageCount }))
</script>

<template>
  <div id="document-top" class="public-page">
    <PublicPageIntro :title="t('ui.licenses')" :meta="documentMeta" variant="document" />

    <div class="licenses-layout">
      <nav class="licenses-nav" :aria-label="t('legal.contents', { title: t('ui.licenses') })">
        <div class="licenses-nav__heading">
          <p class="licenses-nav__label">{{ t('ui.chapters') }}</p>
          <p class="licenses-nav__count">{{ t('legal.sectionCount', { count: '03' }) }}</p>
        </div>
        <ol class="licenses-nav__list">
          <li>
            <a class="licenses-nav__link" href="#license-ffmpeg">
              <span>01</span><span>FFmpeg</span>
            </a>
          </li>
          <li>
            <a class="licenses-nav__link" href="#license-assets">
              <span>02</span><span>{{ t('ui.thirdPartyAssets') }}</span>
            </a>
          </li>
          <li>
            <a class="licenses-nav__link" href="#license-npm">
              <span>03</span><span>{{ t('ui.npmNotices') }}</span>
            </a>
          </li>
        </ol>
      </nav>

      <div class="licenses">
        <p class="licenses__lead">
          {{ t('ui.licenseIntro') }}
        </p>

        <section class="license-entry" aria-labelledby="license-ffmpeg">
          <div class="license-entry__head">
            <h2 id="license-ffmpeg" class="license-entry__name">FFmpeg</h2>
            <p class="license-entry__license">{{ ffmpegPackage?.license ?? t('ui.pendingNotice') }}</p>
          </div>

          <p class="license-entry__text">
            {{ t('ui.ffmpegNotice') }}
          </p>
          <p class="license-entry__note">
            {{ t('licenses.ffmpegSource', { name: ffmpegPackage?.name ?? '', version: ffmpegPackage?.version ?? '' }) }} <a href="https://github.com/FFmpeg/FFmpeg/tree/n7.0.2" target="_blank" rel="noopener noreferrer">{{ t('licenses.repository') }}</a>{{ t('licenses.ffmpegUpdate') }}
          </p>

          <!-- 原生 details：无 JavaScript 可用、键盘可达，不需要自制折叠组件。 -->
          <details class="license-full">
            <summary class="license-full__summary">
              {{ t('ui.gplFull') }}
            </summary>
            <pre class="license-full__text">{{ gplText }}</pre>
          </details>
        </section>

        <section class="licenses__section" aria-labelledby="license-assets">
          <h2 id="license-assets" class="licenses__title">{{ t('ui.thirdPartyAssets') }}</h2>
          <dl class="licenses__list">
            <div v-for="item in assets" :key="`${item.name}@${item.version}`" class="licenses__row">
              <dt class="licenses__name">
                <a v-if="item.homepage" :href="item.homepage" target="_blank" rel="noopener noreferrer">
                  {{ item.name }}
                </a>
                <template v-else>{{ item.name }}</template>
              </dt>
              <dd class="licenses__purpose" lang="zh-CN">
                {{ item.usage }}<template v-if="item.noticeText"> {{ item.noticeText }}</template>
              </dd>
              <dd class="licenses__license">{{ item.license }}</dd>
            </div>
          </dl>
        </section>

        <section class="licenses__section" aria-labelledby="license-npm">
          <h2 id="license-npm" class="licenses__title">{{ t('ui.npmNotices') }}</h2>
          <p class="licenses__subtitle">
            {{ t('licenses.snapshot', { packages: summary.packageCount, licenses: summary.licenseCounts.length }) }} <a href="/THIRD_PARTY_NOTICES.txt" download>{{ t('ui.downloadNotices') }}</a>。
          </p>
          <details class="license-full">
            <summary class="license-full__summary">{{ t('ui.licenseStatistics') }}</summary>
            <dl class="licenses__list">
              <div v-for="item in summary.licenseCounts" :key="item.license" class="licenses__row licenses__row--summary">
                <dt class="licenses__name">{{ item.license }}</dt>
                <dd class="licenses__license-count">{{ t('licenses.records', { count: item.count }) }}</dd>
              </div>
            </dl>
          </details>
        </section>

        <a class="licenses__back-to-top" href="#document-top">
          {{ t('ui.backTop') }} <span aria-hidden="true">↑</span>
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.licenses-layout {
  display: grid;
  gap: var(--space-8);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-6) var(--public-page-padding) var(--space-9);
}

.licenses-nav {
  padding-block: var(--space-3);
  border-top: 2px solid var(--public-text-primary);
  border-bottom: 1px solid var(--public-border-primary);
}

.licenses-nav__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.licenses-nav__label {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.licenses-nav__count {
  color: var(--public-text-tertiary);
  font-family: var(--font-role-metadata);
  font-size: var(--font-size-xs);
}

.licenses-nav__list {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

.licenses-nav__link {
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr);
  align-items: center;
  min-height: 2.75rem;
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  text-underline-offset: 0.2em;
}

.licenses-nav__link span:first-child {
  color: var(--public-text-tertiary);
  font-family: var(--font-role-metadata);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}

.licenses-nav__link:hover,
.licenses-nav__link:focus-visible {
  color: var(--public-text-link);
  text-decoration: underline;
}

.licenses {
  display: grid;
  min-width: 0;
  max-width: 46rem;
}

.licenses__lead {
  color: var(--public-text-secondary);
  font-size: var(--font-size-md);
  line-height: 1.82;
}

.license-entry {
  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: 1px solid var(--public-border-primary);
}

.license-entry__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: var(--space-3);
}

.license-entry__name {
  font-family: var(--font-role-display);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-heading);
}

.license-entry__license {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: var(--type-metadata-letter-spacing);
}

.license-entry__text {
  margin-top: var(--space-4);
  line-height: 1.88;
}

.license-entry__note {
  margin-top: var(--space-4);
  padding-left: var(--space-4);
  color: var(--public-text-secondary);
  border-left: 2px solid var(--public-border-primary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.license-full {
  margin-top: var(--space-4);
  border-block: 1px solid var(--public-border-secondary);
}

.license-full__summary {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr);
  align-items: center;
  width: 100%;
  min-height: 3rem;
  color: var(--public-text-link);
  font-size: var(--font-size-sm);
  cursor: pointer;
  list-style: none;
}

.license-full__summary::-webkit-details-marker {
  display: none;
}

.license-full__summary::before {
  content: "+";
  color: var(--public-text-tertiary);
  font-family: var(--font-role-ui);
}

.license-full[open] .license-full__summary::before {
  content: "−";
}

.license-full__summary:focus-visible {
  outline: 2px solid var(--public-accent-primary);
  outline-offset: 2px;
}

/* 许可证正文按原文换行呈现，限制高度以免顶开整页。 */
.license-full__text {
  min-width: 0;
  max-width: 100%;
  max-height: 30rem;
  margin: 0 0 var(--space-4);
  padding: var(--space-4);
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--public-bg-secondary);
  border-radius: var(--radius-sm);
  color: var(--public-text-secondary);
  font-family: var(--font-role-code);
  font-size: var(--font-size-xs);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.licenses__section {
  margin-top: var(--space-9);
  padding-top: var(--space-6);
  border-top: 1px solid var(--public-border-primary);
}

.licenses__title {
  font-family: var(--font-role-display);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-heading);
}

.licenses__subtitle {
  margin-top: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.licenses__list {
  margin: var(--space-4) 0 0;
  border-top: 1px solid var(--public-border-secondary);
}

.licenses__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-2);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--public-border-secondary);
}

.licenses__name {
  font-weight: 600;
}

.licenses__purpose {
  margin: 0;
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.licenses__license {
  margin: 0;
  color: var(--public-text-tertiary);
  font-family: var(--font-role-code);
  font-size: var(--font-size-xs);
  overflow-wrap: anywhere;
}

.licenses__row--summary {
  grid-template-columns: minmax(0, 1fr) auto;
}

.licenses__license-count {
  margin: 0;
  color: var(--public-text-secondary);
  font-variant-numeric: tabular-nums;
}

.licenses__back-to-top {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  min-height: 2.75rem;
  margin-top: var(--space-8);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.licenses__back-to-top:hover,
.licenses__back-to-top:focus-visible {
  color: var(--public-text-link);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

@media (min-width: 1024px) {
  .licenses-layout {
    grid-template-columns: minmax(13rem, 15rem) minmax(0, 46rem);
    justify-content: center;
    align-items: start;
    gap: var(--space-10);
    padding-top: var(--space-8);
  }

  .licenses-nav {
    position: sticky;
    top: calc(var(--public-header-height) + var(--space-5));
  }

  .licenses__row {
    grid-template-columns: 12rem 1fr auto;
    gap: var(--space-1) var(--space-4);
    padding: var(--space-3) 0;
  }

  .licenses__row--summary {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .licenses__purpose {
    grid-column: 2;
  }

  .licenses__license {
    grid-column: 3;
    grid-row: 1;
    align-self: center;
    white-space: nowrap;
  }
}
</style>
