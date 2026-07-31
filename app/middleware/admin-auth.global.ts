// 管理端客户端路由保护：/admin/** 全部为 CSR（routeRules ssr:false）。
// 非登录管理路由不阻塞渲染——布局门禁在 Session 确认前只呈现克制的加载态，
// 受保护内容不会先渲染再跳转；guest 由布局 watcher 送往登录页，
// error 由布局呈现持久错误而非误判为未登录。
// 登录页则先确认 Session：已登录直接回作品区，避免表单闪现。
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }
  if (!to.path.startsWith('/admin')) {
    return
  }

  const { ensureSession } = useAdminAuth()

  if (to.path === '/admin/login') {
    const resolved = await ensureSession()
    if (resolved === 'ready') {
      return navigateTo(
        safeAdminRedirectTarget(to.query.redirect),
        { replace: true },
      )
    }
    return
  }

  // ensureSession 内部捕获全部错误，不会 reject；竞态由会话内去重吸收。
  void ensureSession({ revalidate: true })
})
