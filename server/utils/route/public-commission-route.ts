import type { H3Event } from 'h3'
import { createApiError } from '../api-error'
import { getRuntimeConfig } from '../runtime-config'

export function assertPublicCommissionOrigin(event: H3Event) {
  const expected = new URL(getRuntimeConfig().publicBaseUrl).origin
  if (getHeader(event, 'origin') !== expected) {
    throw createApiError(403, 'FORBIDDEN', 'Request was rejected.')
  }
}

export function assertCommissionJsonContentType(event: H3Event) {
  const contentType = getHeader(event, 'content-type')
  if (contentType?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }
}

export function commissionUploadBearerToken(event: H3Event) {
  const authorization = getHeader(event, 'authorization')
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/u.exec(authorization ?? '')
  if (!match) {
    throw createApiError(404, 'NOT_FOUND', 'Commission upload was not found.')
  }
  return match[1]!
}
