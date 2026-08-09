import type { H3Event } from 'h3'
import { createApiError } from '../api-error'
import { getRuntimeConfig } from '../runtime-config'

export function assertPublicAnalyticsOrigin(event: H3Event) {
  const expected = new URL(getRuntimeConfig().publicBaseUrl).origin
  const origin = getHeader(event, 'origin')

  if (origin !== expected) {
    throw createApiError(403, 'FORBIDDEN', 'Request was rejected.')
  }
}

export function assertAnalyticsJsonContentType(event: H3Event) {
  const contentType = getHeader(event, 'content-type')
  if (contentType?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Request body is invalid.',
    )
  }
}
