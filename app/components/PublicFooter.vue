<script setup lang="ts">
import { contactChannels } from '~~/shared/fixtures/visual-home'

const year = new Date().getFullYear()
</script>

<template>
  <footer class="public-footer" data-testid="public-footer">
    <div class="public-footer__inner">
      <div class="public-footer__brand">
        <p class="public-footer__name">
          有点小狗工作室
        </p>
        <p class="public-footer__sub">
          dite dog · 兽装制作工作室
        </p>
      </div>

      <nav class="public-footer__nav" aria-label="页脚导航">
        <NuxtLink
          v-for="item in PUBLIC_NAV_ITEMS"
          :key="item.href"
          :to="item.href"
          class="public-footer__link"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <address class="public-footer__contact">
        <p>
          业务邮箱
          <a :href="`mailto:${contactChannels.email}`">{{ contactChannels.email }}</a>
        </p>
        <p>QQ {{ contactChannels.qq }} · 抖音 {{ contactChannels.douyin }}</p>
      </address>
    </div>

    <p class="public-footer__legal">
      © {{ year }} 有点小狗工作室 · 网站内容以工作室官方渠道确认为准
    </p>
  </footer>
</template>

<style scoped>
.public-footer {
  margin-top: var(--space-9);
  padding: var(--space-8) var(--public-page-padding) var(--space-6);
  background: var(--public-bg-secondary);
  border-top: 1px solid var(--public-border-secondary);
}

.public-footer__inner {
  display: grid;
  gap: var(--space-6);
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

.public-footer__contact {
  display: grid;
  gap: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  font-style: normal;
}

.public-footer__legal {
  max-width: var(--public-content-wide);
  margin: var(--space-7) auto 0;
  padding-top: var(--space-4);
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  border-top: 1px solid var(--public-border-secondary);
}

@media (min-width: 768px) {
  .public-footer__inner {
    grid-template-columns: 1.2fr 1fr 1fr;
    align-items: start;
  }
}
</style>
