<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import gplText from '~/assets/licenses/gpl-3.0.txt?raw'
import generatedSummary from '~/assets/licenses/third-party-summary.json'

useSeoMeta({
  title: `开源软件声明 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}网站使用的开源软件及其许可证。`,
  robots: 'index, nofollow',
})

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
const documentMeta = `${assets.length} 项授权资产 · ${summary.packageCount} 条依赖记录`
</script>

<template>
  <div id="document-top" class="public-page">
    <PublicPageIntro title="开源软件声明" :meta="documentMeta" variant="document" />

    <div class="licenses-layout">
      <nav class="licenses-nav" aria-label="开源软件声明目录">
        <div class="licenses-nav__heading">
          <p class="licenses-nav__label">章节导航</p>
          <p class="licenses-nav__count">03 节</p>
        </div>
        <ol class="licenses-nav__list">
          <li>
            <a class="licenses-nav__link" href="#license-ffmpeg">
              <span>01</span><span>FFmpeg</span>
            </a>
          </li>
          <li>
            <a class="licenses-nav__link" href="#license-assets">
              <span>02</span><span>第三方字体与授权资产</span>
            </a>
          </li>
          <li>
            <a class="licenses-nav__link" href="#license-npm">
              <span>03</span><span>npm 生产依赖声明</span>
            </a>
          </li>
        </ol>
      </nav>

      <div class="licenses">
        <p class="licenses__lead">
          本站使用开源软件和经授权的第三方字体、工具。开源项目的版权与许可证归各自作者所有；“免费商用”资产不等同于开源软件。
        </p>

        <section class="license-entry" aria-labelledby="license-ffmpeg">
          <div class="license-entry__head">
            <h2 id="license-ffmpeg" class="license-entry__name">FFmpeg</h2>
            <p class="license-entry__license">{{ ffmpegPackage?.license ?? '待登记' }}</p>
          </div>

          <p class="license-entry__text">
            本站使用 FFmpeg 7.0.2-static 处理图片。该软件以 GNU GPL v3 或更高版本授权，并随本站公开发布的 Linux 容器镜像分发；网页不提供单独的 FFmpeg 下载。
          </p>
          <p class="license-entry__note">
            当前二进制由 {{ ffmpegPackage?.name }}@{{ ffmpegPackage?.version }} 提供，本站未对其进行修改。FFmpeg 项目与 7.0.2 源码可在<a href="https://github.com/FFmpeg/FFmpeg/tree/n7.0.2" target="_blank" rel="noopener noreferrer">官方仓库</a>查看，许可证全文见下方；使用版本或分发方式变化后，本页会同步更新。
          </p>

          <!-- 原生 details：无 JavaScript 可用、键盘可达，不需要自制折叠组件。 -->
          <details class="license-full">
            <summary class="license-full__summary">
              GNU General Public License v3 标准全文
            </summary>
            <pre class="license-full__text">{{ gplText }}</pre>
          </details>
        </section>

        <section class="licenses__section" aria-labelledby="license-assets">
          <h2 id="license-assets" class="licenses__title">第三方字体与授权资产</h2>
          <dl class="licenses__list">
            <div v-for="item in assets" :key="`${item.name}@${item.version}`" class="licenses__row">
              <dt class="licenses__name">
                <a v-if="item.homepage" :href="item.homepage" target="_blank" rel="noopener noreferrer">
                  {{ item.name }}
                </a>
                <template v-else>{{ item.name }}</template>
              </dt>
              <dd class="licenses__purpose">
                {{ item.usage }}<template v-if="item.noticeText"> {{ item.noticeText }}</template>
              </dd>
              <dd class="licenses__license">{{ item.license }}</dd>
            </div>
          </dl>
        </section>

        <section class="licenses__section" aria-labelledby="license-npm">
          <h2 id="license-npm" class="licenses__title">npm 生产依赖声明</h2>
          <p class="licenses__subtitle">
            当前生成环境的 production 安装快照包含 {{ summary.packageCount }} 条包/版本记录，共 {{ summary.licenseCounts.length }} 种许可证表达。平台可选包反映生成环境，不代表目标 Linux runtime closure。<a href="/THIRD_PARTY_NOTICES.txt" download>下载完整 TXT 声明</a>。
          </p>
          <details class="license-full">
            <summary class="license-full__summary">查看许可证表达统计</summary>
            <dl class="licenses__list">
              <div v-for="item in summary.licenseCounts" :key="item.license" class="licenses__row licenses__row--summary">
                <dt class="licenses__name">{{ item.license }}</dt>
                <dd class="licenses__license-count">{{ item.count }} 条</dd>
              </div>
            </dl>
          </details>
        </section>

        <a class="licenses__back-to-top" href="#document-top">
          返回页首 <span aria-hidden="true">↑</span>
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
