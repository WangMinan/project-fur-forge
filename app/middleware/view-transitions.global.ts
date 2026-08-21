export default defineNuxtRouteMiddleware((to, from) => {
  const marker = typeof to.query.view === 'string' ? to.query.view : null
  const fromHome = from.path === '/'
  const workDetail = /^\/works\/[^/]+$/u.test(to.path)
  const enabled = fromHome && (
    (workDetail && marker === 'home-adoption')
    || (to.path === '/commission' && marker === 'home-commission')
  )
  to.meta.viewTransition = enabled
})
