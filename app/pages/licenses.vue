<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import gplText from '~/assets/licenses/gpl-3.0.txt?raw'

/**
 * 开源软件声明。
 *
 * 内容写死在代码里，不进文案编辑：这是许可证义务，不该被后台改错。
 *
 * 分两类处理，因为义务不同：
 * - copyleft（GPL）依赖必须随分发提供许可证全文与源码获取途径，
 *   因此这里内嵌完整正文（`app/assets/licenses/gpl-3.0.txt`，
 *   原样取自我们实际分发的 FFmpeg 二进制所带的 LICENSE）；
 * - MIT / Apache-2.0 依赖给出项目地址即可，许可证正文在其仓库内。
 *
 * 升级依赖时同步本页：清单对应 `package.json` 的运行时依赖。
 */
useSeoMeta({
  title: `开源软件声明 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}网站使用的开源软件及其许可证。`,
  robots: 'index, nofollow',
})

/**
 * 我们实际分发的 FFmpeg 构建事实，取自 `ffmpeg-static` 随包的
 * `ffmpeg.exe.README`：版本、许可证与对应上游源码提交。
 */
const FFMPEG = {
  build: 'FFmpeg 6.1.1-essentials_build（www.gyan.dev 静态构建）',
  license: 'GPL-3.0-or-later',
  packageUrl: 'https://github.com/eugeneware/ffmpeg-static',
  sourceUrl: 'https://github.com/FFmpeg/FFmpeg/commit/e38092ef93',
  upstreamUrl: 'https://www.ffmpeg.org/legal.html',
}

interface Dependency {
  license: string
  name: string
  purpose: string
  url: string
}

/** 直接运行时依赖，与 `package.json` 的 dependencies 对应。 */
const RUNTIME: Dependency[] = [
  {
    license: 'MIT',
    name: 'Nuxt',
    purpose: '网站框架',
    url: 'https://github.com/nuxt/nuxt',
  },
  {
    license: 'MIT',
    name: 'H3',
    purpose: '服务端请求处理',
    url: 'https://github.com/h3js/h3',
  },
  {
    license: 'MIT',
    name: 'Vue',
    purpose: '界面渲染',
    url: 'https://github.com/vuejs/core',
  },
  {
    license: 'MIT',
    name: 'Vue Router',
    purpose: '页面路由',
    url: 'https://github.com/vuejs/router',
  },
  {
    license: 'MIT',
    name: 'better-sqlite3',
    purpose: '数据库读写',
    url: 'https://github.com/WiseLibs/better-sqlite3',
  },
  {
    license: 'Apache-2.0',
    name: 'Drizzle ORM',
    purpose: '数据库结构与迁移',
    url: 'https://github.com/drizzle-team/drizzle-orm',
  },
  {
    license: 'MIT',
    name: 'ali-oss',
    purpose: '图片存储',
    url: 'https://github.com/ali-sdk/ali-oss',
  },
  {
    license: 'Apache-2.0',
    name: 'Alibaba Cloud ESA SDK for TypeScript',
    purpose: 'ESA 精确缓存刷新与任务查询',
    url: 'https://github.com/aliyun/alibabacloud-typescript-sdk',
  },
  {
    license: 'ISC',
    name: 'Alibaba Cloud OpenAPI Core',
    purpose: '阿里云 SDK 运行配置',
    url: 'https://github.com/aliyun/darabonba-openapi',
  },
  {
    license: 'MIT',
    name: 'nuxt-auth-utils',
    purpose: '管理端登录会话',
    url: 'https://github.com/atinux/nuxt-auth-utils',
  },
  {
    license: 'MIT',
    name: 'Zod',
    purpose: '数据校验',
    url: 'https://github.com/colinhacks/zod',
  },
]
</script>

<template>
  <div class="public-page">
    <PublicPageIntro title="开源软件声明" />

    <div class="licenses">
      <p class="licenses__lead">
        本站基于以下开源软件构建。各软件的版权与许可证归其作者所有。
      </p>

      <!--
        FFmpeg 单独成节并附全文：它是本站唯一的 copyleft 依赖，
        义务与其余 MIT / Apache 依赖不同。混在清单里会让唯一
        需要注意的那一条消失。
      -->
      <section class="license-entry" aria-labelledby="license-ffmpeg">
        <div class="license-entry__head">
          <h2 id="license-ffmpeg" class="license-entry__name">FFmpeg</h2>
          <p class="license-entry__license">{{ FFMPEG.license }}</p>
        </div>

        <p class="license-entry__text">
          本站使用 FFmpeg 生成适配尺寸的图片。分发的构建为
          {{ FFMPEG.build }}，以 GNU 通用公共许可证第 3 版或更新版本发布。
          本站未修改 FFmpeg。
        </p>

        <dl class="license-entry__facts">
          <div class="license-entry__fact">
            <dt>对应源代码</dt>
            <dd>
              <a :href="FFMPEG.sourceUrl" target="_blank" rel="noopener noreferrer">
                FFmpeg/FFmpeg@e38092ef93
              </a>
            </dd>
          </div>
          <div class="license-entry__fact">
            <dt>分发方式</dt>
            <dd>
              <a :href="FFMPEG.packageUrl" target="_blank" rel="noopener noreferrer">
                eugeneware/ffmpeg-static
              </a>
            </dd>
          </div>
          <div class="license-entry__fact">
            <dt>上游许可说明</dt>
            <dd>
              <a :href="FFMPEG.upstreamUrl" target="_blank" rel="noopener noreferrer">
                ffmpeg.org/legal.html
              </a>
            </dd>
          </div>
        </dl>

        <p class="license-entry__note">
          FFmpeg 上游以 LGPL-2.1 或更新版本为基线；启用了 GPL 部件的构建
          （如本站使用的这一版）整体适用 GPL。
        </p>

        <!-- 原生 details：无 JavaScript 可用、键盘可达，不需要自制折叠组件。 -->
        <details class="license-full">
          <summary class="license-full__summary">
            GNU General Public License v3 全文
          </summary>
          <pre class="license-full__text">{{ gplText }}</pre>
        </details>
      </section>

      <h2 class="licenses__title">其他开源组件</h2>
      <p class="licenses__subtitle">
        以下组件以 MIT 或 Apache-2.0 发布，许可证全文见各自项目仓库。
      </p>
      <dl class="licenses__list">
        <div v-for="item in RUNTIME" :key="item.name" class="licenses__row">
          <dt class="licenses__name">
            <a :href="item.url" target="_blank" rel="noopener noreferrer">
              {{ item.name }}
            </a>
          </dt>
          <dd class="licenses__purpose">{{ item.purpose }}</dd>
          <dd class="licenses__license">{{ item.license }}</dd>
        </div>
      </dl>
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

@media (min-width: 768px) {
  .licenses__row {
    grid-template-columns: 12rem 1fr auto;
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
