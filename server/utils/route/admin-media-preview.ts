import {
  ADMIN_MEDIA_PREVIEW_WIDTHS,
} from '../../../shared/constants/admin-media-preview'
import type {
  AdminMediaPreviewWidth,
} from '../../../shared/constants/admin-media-preview'
import { ServiceError } from '../service-error'
import { sendRedirect, setResponseHeaders } from 'h3'
import type { H3Event } from 'h3'
import { adminMediaSignedUrlResponseSchema } from '../../../shared/schemas/admin-media-preview'
import type { AdminMediaSignedUrl } from '../../../shared/schemas/admin-media-preview'
import { PRIVATE_RESPONSE_HEADERS } from '../private-response'

export function parseAdminMediaDelivery(query: Record<string, unknown>) {
  if (Object.keys(query).some(key => !['w', 'original', 'delivery'].includes(key))
    || (query.delivery !== undefined && query.delivery !== 'url')) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Preview delivery is invalid.')
  }
  return query.delivery === 'url' ? 'url' : 'redirect'
}

export function sendAdminMediaLink(event: H3Event, signed: AdminMediaSignedUrl, delivery: 'url' | 'redirect') {
  setResponseHeaders(event, { ...PRIVATE_RESPONSE_HEADERS, 'referrer-policy': 'no-referrer' })
  const response = adminMediaSignedUrlResponseSchema.parse({ data: signed })
  return delivery === 'url' ? response : sendRedirect(event, signed.url, 302)
}

export type AdminMediaPreviewRequest =
  | { mode: 'original' }
  | { mode: 'preview', width: AdminMediaPreviewWidth }

function singleQueryValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

/**
 * 永久原图与缩略预览使用显式、互斥模式。缺参和拼错宽度都直接拒绝，
 * 防止调用方本想请求小图却意外把多 MB 原图传给浏览器。
 */
export function parseAdminMediaPreviewQuery(
  query: Record<string, unknown>,
): AdminMediaPreviewRequest {
  parseAdminMediaDelivery(query)
  if ((query.original !== undefined && typeof query.original !== 'string')
    || (query.w !== undefined && typeof query.w !== 'string')) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Preview parameters must be single values.')
  }
  const original = singleQueryValue(query.original)
  const requestedWidth = singleQueryValue(query.w)

  if (original === '1' && requestedWidth === undefined) {
    return { mode: 'original' }
  }

  if (original !== undefined || requestedWidth === undefined) {
    throw new ServiceError(
      400,
      'VALIDATION_ERROR',
      'Choose a supported preview width or explicitly request the original.',
    )
  }

  const numericWidth = Number(requestedWidth)
  const width = ADMIN_MEDIA_PREVIEW_WIDTHS.find(
    candidate => candidate === numericWidth,
  )
  if (width === undefined || String(width) !== requestedWidth) {
    throw new ServiceError(
      400,
      'VALIDATION_ERROR',
      'Preview width is not supported.',
    )
  }
  return { mode: 'preview', width }
}
