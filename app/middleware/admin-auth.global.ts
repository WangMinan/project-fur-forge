// 管理端客户端路由保护：/admin/** 全部为 CSR（routeRules ssr:false）。
// 非登录管理路由等待 Session 结论后再放行；guest 直接进入登录页，
// error 仍由布局呈现持久错误而非误判为未登录。
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
  const resolved = await ensureSession({ revalidate: true })
  if (resolved === 'guest') {
    return navigateTo(
      {
        path: '/admin/login',
        query: { redirect: to.fullPath },
      },
      { replace: true },
    )
  }
})
