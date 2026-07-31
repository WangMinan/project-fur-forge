import type { H3Event } from 'h3'
import { createApiError } from './api-error'

export const ADMIN_JSON_BODY_MAX_BYTES = 64 * 1_024

export async function readAdminJsonBody(event: H3Event): Promise<unknown> {
  const contentLength = getHeader(event, 'content-length')
  if (
    contentLength
    && Number.isFinite(Number(contentLength))
    && Number(contentLength) > ADMIN_JSON_BODY_MAX_BYTES
  ) {
    throw createApiError(
      413,
      'VALIDATION_ERROR',
      'Request body is too large.',
    )
  }

  const raw = await readRawBody(event, 'utf8')
  if (!raw || Buffer.byteLength(raw) > ADMIN_JSON_BODY_MAX_BYTES) {
    throw createApiError(
      raw ? 413 : 400,
      'VALIDATION_ERROR',
      raw ? 'Request body is too large.' : 'Request body is invalid.',
    )
  }

  try {
    return JSON.parse(raw) as unknown
  }
  catch {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Request body is invalid.',
    )
  }
}
