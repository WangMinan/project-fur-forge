<script setup lang="ts">
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
        <p>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">ICP备案</a>
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.public-footer {
  margin-top: var(--space-9);
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

  .public-footer__legal {
    align-self: end;
    justify-items: end;
    text-align: right;
  }
}
</style>
