<template>
  <div class="admin-layout">
    <a href="#admin-main" class="skip-link">跳到主要内容</a>
    <slot />
  </div>
</template>

<!--
  管理端专用布局：不继承公开站 Header/Footer，也不创建 <main>。
  唯一 main landmark 由 AdminShell（#admin-main）持有；登录页使用 layout: false 独立呈现。
-->
<style scoped>
.admin-layout {
  min-height: 100vh;
  background: #f6f7f9;
}
</style>
