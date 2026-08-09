<script setup lang="ts">
import {
  PROJECT_ENGLISH_NAME,
  PROJECT_NAME,
} from '~~/shared/constants/project'
import { publicSiteMetaResponseSchema } from '~~/shared/schemas/site-meta'

/**
 * `brandOnly` 隐藏页脚导航，只留品牌与法务/备案信息。
 * 管理端登录页用它：备案信息要保留，访客导航不进登录流程。
 */
withDefaults(defineProps<{
  brandOnly?: boolean
}>(), {
  brandOnly: false,
})

const year = new Date().getFullYear()
const { data: filings } = await useFetch('/api/site-meta', {
  key: 'public-site-meta',
  default: () => ({ icp: null, police: null }),
  transform: raw => publicSiteMetaResponseSchema.parse(raw).data.filings,
})
</script>

<template>
  <footer class="public-footer" data-testid="public-footer">
    <div
      class="public-footer__inner"
      :class="{ 'public-footer__inner--brand-only': brandOnly }"
    >
      <div class="public-footer__brand">
        <p class="public-footer__name">
          {{ PROJECT_NAME }}
        </p>
        <p class="public-footer__sub">
          {{ PROJECT_ENGLISH_NAME }} · 兽装制作工作室
        </p>
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

      <div class="public-footer__legal">
        <p>© {{ year }} 有点小狗工作室</p>
        <p class="public-footer__legal-links">
          <NuxtLink to="/service">服务条款</NuxtLink>
          <span aria-hidden="true">|</span>
          <NuxtLink to="/privacy">隐私政策</NuxtLink>
          <span aria-hidden="true">|</span>
          <span>
            Design by
            <a href="https://github.com/wangminan" target="_blank" rel="noopener noreferrer">Arktouros</a>
          </span>
        </p>
        <p class="public-footer__legal-links">
          <template v-if="filings.icp">
            <a :href="filings.icp.url" target="_blank" rel="noopener noreferrer">{{ filings.icp.number }}</a>
            <span aria-hidden="true">|</span>
          </template>
          <template v-if="filings.police">
            <a :href="filings.police.url" target="_blank" rel="noopener noreferrer">{{ filings.police.number }}</a>
            <span aria-hidden="true">|</span>
          </template>
          <NuxtLink to="/licenses">开源软件声明</NuxtLink>
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.public-footer {
  /**
   * 只留一段小的呼吸间距。首页需要更空的收尾，那份留白由首页自己的
   * padding-bottom 提供，内页因此不会继承一段过大的空白。
   */
  margin-top: var(--space-6);
  padding: var(--space-4) var(--public-page-padding);
  background: var(--public-bg-secondary);
  border-top: 1px solid var(--public-border-secondary);
}

.public-footer__inner {
  display: grid;
  gap: var(--space-4);
  max-width: var(--public-content-wide);
  margin: 0 auto;
}

.public-footer__name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-heading);
}

.public-footer__sub {
  margin-top: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.public-footer__nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-5);
}

.public-footer__link {
  color: var(--public-text-primary);
  font-size: var(--font-size-sm);
}

.public-footer__link:hover {
  color: var(--public-accent-primary);
}

.public-footer__legal {
  display: grid;
  gap: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-xs);
}

.public-footer__legal-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  overflow-wrap: anywhere;
}

.public-footer__legal a {
  color: inherit;
}

.public-footer__legal a:hover {
  color: var(--public-accent-primary);
}

@media (min-width: 768px) {
  .public-footer__inner {
    grid-template-columns: 1.2fr 1fr 1fr;
    align-items: stretch;
  }

  /* 没有导航列时收成两列，法务信息仍靠右对齐。 */
  .public-footer__inner--brand-only {
    grid-template-columns: 1fr auto;
  }

  .public-footer__legal {
    align-self: end;
    justify-items: end;
    text-align: right;
  }
}
</style>
