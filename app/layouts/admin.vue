<template>
  <div class="admin-layout">
    <main class="admin-layout__content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
  color: #20242a;
  background: #f6f7f9;
}

.admin-layout__content {
  min-height: 100vh;
}
</style>
