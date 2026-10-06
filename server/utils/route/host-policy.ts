import type { RuntimeConfig } from '../runtime-config'
import { BlockList } from 'node:net'

const developmentNetworks = new BlockList()
developmentNetworks.addSubnet('10.0.0.0', 8)
developmentNetworks.addSubnet('172.16.0.0', 12)
developmentNetworks.addSubnet('192.168.0.0', 16)

function isDevelopmentPublicHost(host: string, config: RuntimeConfig) {
  if (config.appEnv !== 'development') return false
  try {
    const url = new URL(`http://${host}`)
    return url.port === new URL(config.publicBaseUrl).port
      && url.host !== new URL(config.adminBaseUrl).host
      && url.host !== new URL(config.mediaBaseUrl).host
      && developmentNetworks.check(url.hostname, 'ipv4')
  }
  catch {
    return false
  }
}

export function isPublicRequestOrigin(origin: string | undefined, requestUrl: URL, config: RuntimeConfig) {
  const publicUrl = new URL(config.publicBaseUrl)
  return origin === publicUrl.origin
    || (origin === requestUrl.origin
      && requestUrl.protocol === publicUrl.protocol
      && isDevelopmentPublicHost(requestUrl.host, config))
}

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

  if (normalizedHost === publicHost || isDevelopmentPublicHost(normalizedHost, config)) {
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
      || pathname === '/api/site-meta'
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
