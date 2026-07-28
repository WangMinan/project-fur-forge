<template>
  <div class="public-layout">
    <main class="public-layout__content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.public-layout {
  min-height: 100vh;
  color: #20242a;
  background: #fff;
}

.public-layout__content {
  min-height: 100vh;
}
</style>
