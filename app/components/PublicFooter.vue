<script setup lang="ts">
import {
  PROJECT_ENGLISH_NAME,
  PROJECT_NAME,
} from "~~/shared/constants/project";
import { publicSiteMetaResponseSchema } from "~~/shared/schemas/site-meta";

/**
 * `brandOnly` 隐藏页脚导航，只留品牌与法务/备案信息。
 * 管理端登录页用它：备案信息要保留，访客导航不进登录流程。
 */
withDefaults(
  defineProps<{
    brandOnly?: boolean;
  }>(),
  {
    brandOnly: false,
  },
);

const shanghaiYear = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  timeZone: "Asia/Shanghai",
}).format(new Date());
const { data: filings } = await useFetch("/api/site-meta", {
  key: "public-site-meta",
  default: () => ({ icp: null, police: null }),
  transform: (raw) => publicSiteMetaResponseSchema.parse(raw).data.filings,
});
</script>

<template>
  <footer class="public-footer" data-testid="public-footer">
    <div class="public-footer__inner">
      <div class="public-footer__brand">
        <img
          class="public-footer__logo"
          src="/brand/logo-mark.png"
          alt=""
          width="1600"
          height="1600"
        >
        <div>
          <p class="public-footer__name">
            {{ PROJECT_NAME }}
          </p>
          <p class="public-footer__sub">
            {{ PROJECT_ENGLISH_NAME }}
          </p>
        </div>
      </div>

      <nav v-if="!brandOnly" class="public-footer__nav" aria-label="页脚导航">
        <NuxtLink
          v-for="item in PUBLIC_NAV_ITEMS"
          :key="item.href"
          :to="item.href"
          class="public-footer__link"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <p
        v-if="filings.icp || filings.police"
        class="public-footer__filings"
        aria-label="网站备案信息"
      >
          <template v-if="filings.icp">
            <a
              :href="filings.icp.url"
              target="_blank"
              rel="noopener noreferrer"
              >{{ filings.icp.number }}</a
            >
          </template>
          <template v-if="filings.police">
            <span v-if="filings.icp" aria-hidden="true">｜</span>
            <a
              :href="filings.police.url"
              class="public-footer__police-filing"
              target="_blank"
              rel="noopener noreferrer"
              ><img
                src="/filings/police-filing.png"
                alt=""
                width="18"
                height="20"
                aria-hidden="true"
              ><span>{{ filings.police.number }}</span></a
            >
        </template>
      </p>

      <p class="public-footer__copyright">
        © 2026-{{ shanghaiYear }}
        <span>{{ PROJECT_NAME }}. {{ PROJECT_ENGLISH_NAME }}.</span>
        All Rights Reserved.
      </p>

      <p class="public-footer__legal-links">
        <NuxtLink to="/service">服务条款</NuxtLink>
        <span aria-hidden="true">｜</span>
        <NuxtLink to="/privacy">隐私政策</NuxtLink>
        <span aria-hidden="true">｜</span>
        <NuxtLink to="/licenses">开源软件声明</NuxtLink>
        <span aria-hidden="true">｜</span>
        <span>
          Design by
          <!-- Jece 暂无公开主页链接，先以纯文本署名；拿到链接后再补 <a>。 -->
          <span>Jece</span>
          &amp;
          <a
            href="https://github.com/wangminan"
            target="_blank"
            rel="noopener noreferrer"
            >Arktouros</a
          >
          &amp;
          <a
            href="https://github.com/lingxunfurry"
            target="_blank"
            rel="noopener noreferrer"
            >LingXun</a
          >
        </span>
      </p>
    </div>
  </footer>
</template>

<style scoped>
.public-footer {
  padding: calc(var(--space-4) + var(--space-1)) var(--public-page-padding)
    var(--space-4);
  background: var(--public-bg-secondary);
  border-top: 1px solid var(--public-border-secondary);
}

/* 五个块在同一个网格里，导航/© 与备案/法务链接各自共享一条行轨，
   两侧才真的落在同一水平线上；分列嵌套时两列各自排版，行高不同就会错开。 */
.public-footer__inner {
  display: grid;
  gap: var(--space-2) var(--space-4);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  grid-template-areas:
    'brand'
    'nav'
    'filings'
    'copyright'
    'legal';
}

.public-footer__brand {
  grid-area: brand;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

/* 高度写死成两行文字的高度。不能用 align-self: stretch：图片本身
   1600×1600，容器高度又由最高的子项决定，会循环回落到内在尺寸而撑爆页脚。 */
.public-footer__logo {
  flex: none;
  width: auto;
  height: 3.5rem;
  object-fit: contain;
}

.public-footer__nav {
  grid-area: nav;
}

.public-footer__filings {
  grid-area: filings;
}

.public-footer__copyright {
  grid-area: copyright;
}

.public-footer__legal-links {
  grid-area: legal;
}

.public-footer__name {
  font-family: var(--font-brand-display);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-heading);
}

.public-footer__sub {
  margin-top: var(--space-2);
  color: var(--public-text-secondary);
  font-family: var(--font-brand-display);
  font-size: var(--font-size-sm);
}

.public-footer__nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-4);
}

.public-footer__link {
  color: var(--public-text-primary);
  font-size: var(--font-size-sm);
}

.public-footer__link:hover {
  color: var(--public-accent-primary);
}

.public-footer__filings {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-xs);
  overflow-wrap: anywhere;
}

.public-footer__filings a {
  color: inherit;
}

.public-footer__police-filing {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.public-footer__police-filing img {
  flex: none;
  width: 1.125rem;
  height: 1.25rem;
  object-fit: contain;
}

.public-footer__filings a:hover {
  color: var(--public-accent-primary);
}

/* © 行保持正文字体：只有左侧品牌名与英文名换拼贴字体。 */
.public-footer__copyright,
.public-footer__legal-links {
  color: var(--public-text-secondary);
  font-size: var(--font-size-xs);
}

.public-footer__legal-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  overflow-wrap: anywhere;
}

.public-footer__legal-links a {
  color: inherit;
}

.public-footer__legal-links a:hover {
  color: var(--public-accent-primary);
}

/* 窄屏一行放不下时，「｜」会落在行尾变成孤立的竖线，看着像排版坏了。
   这些分隔符只在单行的桌面布局里有意义，换行布局改用间距分组。 */
@media (max-width: 1199px) {
  .public-footer__filings > span[aria-hidden='true'],
  .public-footer__legal-links > span[aria-hidden='true'] {
    display: none;
  }

  .public-footer__filings,
  .public-footer__legal-links {
    gap: var(--space-2) var(--space-4);
  }
}

@media (min-width: 1200px) {
  .public-footer__inner {
    grid-template-columns: max-content minmax(0, 1fr) max-content;
    /* 第一行：导航 ↔ ©；第二行：备案 ↔ 法务链接。基线对齐让两侧字号不同时
       也落在同一条水平线上。品牌块跨两行，自己居中。 */
    grid-template-areas:
      'brand nav copyright'
      'brand filings legal';
    align-items: baseline;
    column-gap: clamp(var(--space-5), 3vw, var(--space-8));
  }

  .public-footer__brand {
    align-self: center;
    margin-bottom: 0;
  }

  .public-footer__nav,
  .public-footer__filings {
    justify-content: center;
  }

  .public-footer__copyright,
  .public-footer__legal-links {
    justify-self: end;
    text-align: right;
    white-space: nowrap;
  }

  .public-footer__legal-links {
    flex-wrap: nowrap;
  }
}
</style>
