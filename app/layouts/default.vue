<template>
  <div class="public-layout">
    <a href="#main-content" class="skip-link">跳到主要内容</a>
    <PublicHeader />
    <main id="main-content" class="public-layout__content">
      <slot />
    </main>
    <PublicFooter />
  </div>
</template>

<style scoped>
.public-layout {
  min-height: 100vh;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
}

.public-layout__content {
  min-height: 60vh;
}
</style>
