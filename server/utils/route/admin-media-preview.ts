import {
  ADMIN_MEDIA_PREVIEW_WIDTHS,
} from '../../../shared/constants/admin-media-preview'
import type {
  AdminMediaPreviewWidth,
} from '../../../shared/constants/admin-media-preview'
import { ServiceError } from '../service-error'

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
