export const ADMIN_MEDIA_CARD_PREVIEW_WIDTH = 320
export const ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH = 640
export const ADMIN_MEDIA_SIGNED_URL_TTL_MS = 10 * 60 * 1_000

export const ADMIN_MEDIA_PREVIEW_WIDTHS = [
  ADMIN_MEDIA_CARD_PREVIEW_WIDTH,
  ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH,
] as const

export type AdminMediaPreviewWidth = typeof ADMIN_MEDIA_PREVIEW_WIDTHS[number]

export function isAdminMediaReadPath(path: string) {
  return /^\/api\/admin\/v1\/(?:media\/assets\/[0-9a-f-]+\/preview|commissions\/[0-9a-f-]+\/design-reference|site\/hero-collections\/[^/]+\/[^/]+\/items\/[0-9a-f-]+\/preview)$/u.test(path)
}
