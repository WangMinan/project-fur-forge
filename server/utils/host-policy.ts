import type { RuntimeConfig } from './runtime-config'

export type HostDecision
  = | { action: 'allow' }
    | { action: 'redirect', location: string }
    | {
      action: 'reject'
      code: 'HOST_NOT_ALLOWED' | 'NOT_FOUND'
      statusCode: 404 | 421
    }

const publicBlockedPrefixes = [
  '/admin',
  '/api/admin',
  '/api/auth',
  '/preview',
] as const

const adminAllowedPrefixes = [
  '/admin',
  '/api/admin',
  '/api/auth',
  '/preview',
  '/api/health',
  '/_nuxt',
  '/__nuxt',
  '/__nuxt_error',
  '/@vite',
  '/_loading',
] as const

function isAtOrBelow(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function normalizeHost(host: string) {
  try {
    return new URL(`http://${host}`).host.toLowerCase()
  }
  catch {
    return ''
  }
}

export function decideHostAccess(
  host: string,
  pathname: string,
  config: RuntimeConfig,
): HostDecision {
  const normalizedHost = normalizeHost(host)
  const publicHost = new URL(config.publicBaseUrl).host.toLowerCase()
  const adminHost = new URL(config.adminBaseUrl).host.toLowerCase()

  if (normalizedHost === publicHost) {
    return publicBlockedPrefixes.some(prefix => isAtOrBelow(pathname, prefix))
      ? {
          action: 'reject',
          code: 'NOT_FOUND',
          statusCode: 404,
        }
      : { action: 'allow' }
  }

  if (normalizedHost === adminHost) {
    if (pathname === '/') {
      return {
        action: 'redirect',
        location: '/admin/login',
      }
    }

    return (
      pathname === '/favicon.ico'
      || adminAllowedPrefixes.some(prefix => isAtOrBelow(pathname, prefix))
    )
      ? { action: 'allow' }
      : {
          action: 'reject',
          code: 'NOT_FOUND',
          statusCode: 404,
        }
  }

  return {
    action: 'reject',
    code: 'HOST_NOT_ALLOWED',
    statusCode: 421,
  }
}
