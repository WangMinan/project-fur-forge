import type { PublicAnalyticsEntity } from '~/utils/public-analytics'

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  let lastNavigationKey: string | null = null

  nuxtApp.hook('page:finish', () => {
    const route = router.currentRoute.value
    const marker = document.querySelector<HTMLElement>(
      '#main-content [data-analytics-entity-id][data-analytics-entity-type]',
    )
    const markerType = marker?.dataset.analyticsEntityType
    const entity: PublicAnalyticsEntity | null = (
      markerType === 'work' && marker?.dataset.analyticsEntityId
    )
      ? {
          type: markerType,
          id: marker.dataset.analyticsEntityId,
        }
      : null
    const event = analyticsPageEventForPath(route.path, entity)
    if (!event) {
      return
    }

    // fullPath 只在内存中区分分页/筛选导航，绝不进入请求或持久化。
    const navigationKey = `${route.fullPath}:${event.routeKey}:${event.entityId ?? ''}`
    if (navigationKey === lastNavigationKey) {
      return
    }
    lastNavigationKey = navigationKey
    void sendPublicAnalyticsEvent(event)
  })
})
