import { decideHostAccess } from '../utils/host-policy'
import { createApiError } from '../utils/api-error'
import { getRuntimeConfig } from '../utils/runtime-config'

export default defineEventHandler((event) => {
  const decision = decideHostAccess(
    getRequestHost(event),
    getRequestURL(event).pathname,
    getRuntimeConfig(),
  )

  if (decision.action === 'redirect') {
    return sendRedirect(event, decision.location, 302)
  }

  if (decision.action === 'reject') {
    throw createApiError(
      decision.statusCode,
      decision.code,
      decision.statusCode === 421
        ? 'Host is not allowed.'
        : 'Resource was not found.',
    )
  }
})
