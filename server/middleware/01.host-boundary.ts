import { decideHostAccess } from '../utils/host-policy'
import { createApiError } from '../utils/api-error'
import {
  isPrivateResponsePath,
  PRIVATE_RESPONSE_HEADERS,
} from '../utils/private-response'
import { getRuntimeConfig } from '../utils/runtime-config'

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname

  if (isPrivateResponsePath(pathname)) {
    setResponseHeaders(event, PRIVATE_RESPONSE_HEADERS)
  }

  const decision = decideHostAccess(
    getRequestHost(event),
    pathname,
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
