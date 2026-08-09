import {
  analyticsEventRequestSchema,
  analyticsEventResponseSchema,
} from '../../../../../shared/schemas/analytics'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import {
  assertAnalyticsJsonContentType,
  assertPublicAnalyticsOrigin,
} from '../../../../utils/route/public-analytics-route'
import { readPublicAnalyticsJsonBody } from '../../../../utils/route/request-body'
import { assertRequestRateLimit } from '../../../../utils/route/request-rate-limit'
import { getRuntimeConfig as getAppRuntimeConfig } from '../../../../utils/runtime-config'
import {
  analyticsSessionHmac,
  recordAnalyticsEvent,
} from '../../../../utils/service/analytics'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  assertPublicAnalyticsOrigin(event)
  assertAnalyticsJsonContentType(event)

  const parsed = analyticsEventRequestSchema.safeParse(
    await readPublicAnalyticsJsonBody(event),
  )
  if (!parsed.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Analytics event is invalid.',
    )
  }

  const config = getAppRuntimeConfig()
  // 生产使用同一 SESSION_SECRET；本地/测试复用 nuxt-auth-utils
  // 已在使用的会话密钥，不为统计引入第二份 secret。
  const sessionSecret = config.sessionSecret
    ?? useRuntimeConfig(event).session?.password
  if (sessionSecret) {
    assertRequestRateLimit(event, 'analytics', {
      analyticsSession: analyticsSessionHmac(
        parsed.data.sessionId,
        sessionSecret,
      ),
    })
  }

  try {
    return analyticsEventResponseSchema.parse({
      data: recordAnalyticsEvent(
        getDatabase().sqlite,
        parsed.data,
        sessionSecret,
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})
