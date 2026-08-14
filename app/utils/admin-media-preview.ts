import type { AdminMediaPreviewWidth } from '~~/shared/constants/admin-media-preview'

export function adminMediaPreviewUrl(
  assetId: string,
  width: AdminMediaPreviewWidth,
) {
  return `/api/admin/v1/media/assets/${encodeURIComponent(assetId)}/preview?w=${width}`
}

export function adminMediaOriginalUrl(assetId: string) {
  return `/api/admin/v1/media/assets/${encodeURIComponent(assetId)}/preview?original=1`
}
