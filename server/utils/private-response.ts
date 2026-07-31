export const PRIVATE_RESPONSE_HEADERS = {
  'cache-control': 'no-store, max-age=0',
  pragma: 'no-cache',
  vary: 'Cookie, Origin',
  'x-robots-tag': 'noindex, nofollow, noarchive',
} as const

export function isPrivateResponsePath(pathname: string) {
  return pathname === '/api/auth'
    || pathname.startsWith('/api/auth/')
    || pathname === '/api/admin'
    || pathname.startsWith('/api/admin/')
    || pathname === '/preview'
    || pathname.startsWith('/preview/')
}
