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
  '/api/_auth',
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
  const mediaHost = new URL(config.mediaBaseUrl).host.toLowerCase()

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

    // E2E fake OSS 端点只在 test 环境存在（handler 仅在 test 构建注册）；
    // 生产与开发环境保持 404。
    const e2eFakeAllowed = config.appEnv === 'test'
      && (
        isAtOrBelow(pathname, '/api/e2e-fake-oss')
        || isAtOrBelow(pathname, '/api/e2e-fake-media-control')
      )

    return (
      pathname === '/favicon.ico'
      || e2eFakeAllowed
      || adminAllowedPrefixes.some(prefix => isAtOrBelow(pathname, prefix))
    )
      ? { action: 'allow' }
      : {
          action: 'reject',
          code: 'NOT_FOUND',
          statusCode: 404,
        }
  }

  if (normalizedHost === mediaHost) {
    return config.appEnv === 'test'
      && (
        isAtOrBelow(pathname, '/api/e2e-fake-oss')
        || isAtOrBelow(pathname, '/test')
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
