import type {
  AnalyticsActionKey,
  AnalyticsEntityType,
  AnalyticsEventRequest,
  AnalyticsRouteKey,
} from '~~/shared/types/contracts'

const ANALYTICS_ENDPOINT = '/api/public/v1/analytics/events'
const ANALYTICS_SESSION_STORAGE_KEY = 'fur-forge.analytics-session.v1'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

const STATIC_ROUTE_KEYS: Readonly<Record<string, AnalyticsRouteKey>> = {
  '/': 'home',
  '/works': 'works',
  '/returns': 'returns',
  '/commission': 'commission',
  '/adoptions': 'adoptions',
  '/about': 'about',
  '/service': 'service',
  '/privacy': 'privacy',
  '/licenses': 'licenses',
}

export interface PublicAnalyticsEntity {
  type: AnalyticsEntityType
  id: string
}

type EventWithoutSession = Omit<AnalyticsEventRequest, 'sessionId'>

export function analyticsPageEventForPath(
  pathname: string,
  entity: PublicAnalyticsEntity | null = null,
): EventWithoutSession | null {
  const staticRouteKey = STATIC_ROUTE_KEYS[pathname]
  if (staticRouteKey) {
    return {
      eventType: 'page_view',
      routeKey: staticRouteKey,
      entityType: null,
      entityId: null,
      actionKey: null,
    }
  }

  const expectedType = /^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(pathname)
    ? 'work'
    : /^\/returns\/[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(pathname)
      ? 'return_character'
      : null
  if (!expectedType || entity?.type !== expectedType || !UUID_PATTERN.test(entity.id)) {
    return null
  }

  return {
    eventType: 'page_view',
    routeKey: expectedType === 'work' ? 'work_detail' : 'return_character',
    entityType: expectedType,
    entityId: entity.id,
    actionKey: null,
  }
}

export function analyticsContactEventForPath(
  pathname: string,
  actionKey: AnalyticsActionKey,
): EventWithoutSession | null {
  const routeKey = STATIC_ROUTE_KEYS[pathname]
  if (routeKey !== 'about' && routeKey !== 'commission') {
    return null
  }

  return {
    eventType: 'contact_action',
    routeKey,
    entityType: null,
    entityId: null,
    actionKey,
  }
}

interface AnalyticsTransportOptions {
  fetchImpl?: typeof fetch
  randomUUID?: () => string
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

let memorySessionId: string | null = null

function analyticsSessionId(options: AnalyticsTransportOptions) {
  const createId = options.randomUUID ?? (() => crypto.randomUUID())
  const storage = options.storage ?? sessionStorage

  try {
    const stored = storage.getItem(ANALYTICS_SESSION_STORAGE_KEY)
    if (stored && UUID_PATTERN.test(stored)) {
      memorySessionId = stored
      return stored
    }
  }
  catch {
    // 某些隐私模式禁用 sessionStorage；退回当前页面进程内会话。
  }

  memorySessionId ??= createId()
  try {
    storage.setItem(ANALYTICS_SESSION_STORAGE_KEY, memorySessionId)
  }
  catch {
    // best effort：存储不可用不影响页面，也不改用 Cookie/localStorage。
  }
  return memorySessionId
}

/**
 * 同源最佳努力上报。调用方无需 await：内部吞掉网络、限流和服务端失败。
 * `credentials: omit` 与 `no-referrer` 进一步收敛请求；body 不含 URL/query。
 */
export async function sendPublicAnalyticsEvent(
  event: EventWithoutSession,
  options: AnalyticsTransportOptions = {},
) {
  try {
    const fetchImpl = options.fetchImpl ?? fetch
    await fetchImpl(ANALYTICS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({
        ...event,
        sessionId: analyticsSessionId(options),
      }),
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      referrerPolicy: 'no-referrer',
    })
  }
  catch {
    // 统计失败绝不影响页面加载、导航、联系行动或用户可见状态。
  }
}

export function trackPublicContactAction(
  pathname: string,
  actionKey: AnalyticsActionKey,
) {
  const event = analyticsContactEventForPath(pathname, actionKey)
  if (event) {
    void sendPublicAnalyticsEvent(event)
  }
}
