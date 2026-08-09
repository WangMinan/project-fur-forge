import type { AnalyticsOverviewDto } from '~~/shared/types/contracts'
import { analyticsOverviewResponseSchema } from '~~/shared/schemas/analytics'

export function useAdminAnalytics() {
  const analytics = shallowRef<AnalyticsOverviewDto | null>(null)
  const pageStatus = shallowRef<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const adminApi = useAdminApi()

  async function load() {
    if (pageStatus.value === 'loading') {
      return
    }

    pageStatus.value = 'loading'

    try {
      const response = await adminApi('/api/admin/v1/analytics', {
        schema: analyticsOverviewResponseSchema,
      })
      analytics.value = response.data
      pageStatus.value = 'ready'
    }
    catch {
      pageStatus.value = 'error'
    }
  }

  return {
    analytics: readonly(analytics),
    load,
    pageStatus: readonly(pageStatus),
  }
}
