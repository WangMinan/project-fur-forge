export default defineNuxtRouteMiddleware((to) => {
  to.meta.viewTransition = false
  to.meta.pageTransition = !to.path.startsWith('/admin')
    ? { appear: true, name: 'public-page' }
    : false
})
