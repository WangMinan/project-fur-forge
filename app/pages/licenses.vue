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
</script>

<template>
  <div class="public-page">
    <PublicPageIntro title="开源软件声明" />

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
          本站在工作室服务器容器中使用 FFmpeg 处理图片，网页不提供单独的 FFmpeg 下载入口。当前发布流程会把包含 FFmpeg 的容器镜像发布到公开 Docker Hub，因此按二进制分发场景维护声明。
        </p>
        <p class="license-entry__note">
          当前只确认 npm 包 {{ ffmpegPackage?.name }}@{{ ffmpegPackage?.version }}（{{ ffmpegPackage?.license }}）的安装事实。Linux 发布镜像内实际二进制的版本、SHA-256、对应源码 revision、补丁和构建配置尚未从发布产物提取；完成部署阶段 registry 前，本页不声称任何具体 FFmpeg 二进制构建事实。
        </p>

        <!-- 原生 details：无 JavaScript 可用、键盘可达，不需要自制折叠组件。 -->
        <details class="license-full">
          <summary class="license-full__summary">
            GNU General Public License v3 标准全文
          </summary>
          <pre class="license-full__text">{{ gplText }}</pre>
        </details>
      </section>

      <h2 class="licenses__title">第三方字体与授权资产</h2>
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

      <h2 class="licenses__title">npm 生产依赖声明</h2>
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
    </div>
  </div>
</template>

<style scoped>
.licenses {
  max-width: var(--public-content-article);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-7);
}

.licenses__lead {
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
}

/* 唯一的 copyleft 依赖：用左侧竖线标出，与下面的等宽清单区分。 */
.license-entry {
  margin-top: var(--space-6);
  padding-left: var(--space-5);
  border-left: 2px solid var(--public-accent-primary);
}

.license-entry__head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.license-entry__name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-heading);
}

.license-entry__license {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: var(--letter-spacing-label);
}

.license-entry__text {
  margin-top: var(--space-3);
  line-height: var(--line-height-relaxed);
}

.license-entry__facts {
  margin-top: var(--space-4);
}

.license-entry__fact {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--public-border-secondary);
  font-size: var(--font-size-sm);
}

.license-entry__fact dt {
  min-width: 7rem;
  color: var(--public-text-secondary);
}

.license-entry__fact dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.license-entry__note {
  margin-top: var(--space-4);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.license-full {
  margin-top: var(--space-4);
}

.license-full__summary {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  color: var(--public-text-link);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.license-full__summary:focus-visible {
  outline: 2px solid var(--public-accent-primary);
  outline-offset: 2px;
}

/* 许可证正文按原文换行呈现，限制高度以免顶开整页。 */
.license-full__text {
  max-height: 30rem;
  margin-top: var(--space-3);
  padding: var(--space-4);
  overflow: auto;
  background: var(--public-bg-secondary);
  border-radius: var(--radius-sm);
  color: var(--public-text-secondary);
  font-family: var(--font-public-mono, monospace);
  font-size: var(--font-size-xs);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.licenses__title {
  margin-top: var(--space-8);
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
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
  grid-template-columns: 1fr auto;
  gap: var(--space-1) var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--public-border-secondary);
}

.licenses__name {
  font-weight: 600;
}

.licenses__purpose {
  grid-column: 1;
  margin: 0;
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

/* 许可证名右对齐、等宽：一列扫一眼就能对照。 */
.licenses__license {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  margin: 0;
  color: var(--public-text-tertiary);
  font-family: var(--font-public-mono, monospace);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.licenses__row--summary {
  grid-template-columns: minmax(0, 1fr) auto;
}

.licenses__license-count {
  margin: 0;
  color: var(--public-text-secondary);
  font-variant-numeric: tabular-nums;
}

@media (min-width: 768px) {
  .licenses__row {
    grid-template-columns: 12rem 1fr auto;
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
  }
}
</style>
