import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  analyticsEventRequestSchema,
  analyticsEventResponseSchema,
} from '../../shared/schemas/analytics'
import {
  analyticsSessionHmac,
  ANALYTICS_HMAC_DOMAIN,
} from '../../server/utils/service/analytics'
import {
  analyticsContactEventForPath,
  analyticsPageEventForPath,
  sendPublicAnalyticsEvent,
} from '../../app/utils/public-analytics'

const SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WORK_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('T46 analytics contract', () => {
  it('accepts only the event whitelist and rejects tracking-shaped extras', () => {
    const event = {
      eventType: 'page_view',
      routeKey: 'work_detail',
      entityType: 'work',
      entityId: WORK_ID,
      actionKey: null,
      sessionId: SESSION_ID,
    } as const

    expect(analyticsEventRequestSchema.parse(event)).toEqual(event)

    for (const forbidden of [
      'ip',
      'userAgent',
      'referer',
      'url',
      'query',
      'cookie',
      'contact',
      'fingerprint',
    ]) {
      expect(analyticsEventRequestSchema.safeParse({
        ...event,
        [forbidden]: 'must-not-be-accepted',
      }).success).toBe(false)
    }

    expect(analyticsEventRequestSchema.safeParse({
      ...event,
      routeKey: 'search',
    }).success).toBe(false)
    expect(analyticsEventRequestSchema.safeParse({
      ...event,
      routeKey: 'home',
    }).success).toBe(false)
    expect(analyticsEventResponseSchema.parse({
      data: { accepted: true },
    })).toEqual({ data: { accepted: true } })
    expect(analyticsEventResponseSchema.safeParse({
      data: { accepted: true, sessionId: SESSION_ID },
    }).success).toBe(false)
  })

  it('uses a stable domain-separated HMAC without exposing the raw session UUID', () => {
    const secret = 's'.repeat(32)
    const digest = analyticsSessionHmac(SESSION_ID, secret)

    expect(digest).toMatch(/^[0-9a-f]{64}$/u)
    expect(digest).not.toContain(SESSION_ID)
    expect(analyticsSessionHmac(SESSION_ID, secret)).toBe(digest)
    expect(analyticsSessionHmac(
      SESSION_ID,
      secret,
      `${ANALYTICS_HMAC_DOMAIN}:other`,
    )).not.toBe(digest)
  })

  it('maps only canonical public paths and verified detail entity markers', () => {
    expect(analyticsPageEventForPath('/')).toMatchObject({
      routeKey: 'home',
      entityId: null,
    })
    expect(analyticsPageEventForPath('/updates')).toEqual({
      eventType: 'page_view',
      routeKey: 'updates',
      entityType: null,
      entityId: null,
      actionKey: null,
    })
    expect(analyticsPageEventForPath('/works/sample', {
      id: WORK_ID,
      type: 'work',
    })).toMatchObject({
      routeKey: 'work_detail',
      entityId: WORK_ID,
    })
    expect(analyticsPageEventForPath('/works/sample?draft=true', {
      id: WORK_ID,
      type: 'work',
    })).toBeNull()
    expect(analyticsPageEventForPath('/works/sample', {
      id: WORK_ID,
      type: 'return_character',
    })).toBeNull()
    expect(analyticsContactEventForPath('/about', 'email_copy')).toMatchObject({
      routeKey: 'about',
      actionKey: 'email_copy',
    })
    expect(analyticsContactEventForPath('/works', 'email_open')).toBeNull()
  })

  it('sends only the allowlisted event and session UUID with privacy-tight fetch options', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }))
    const storage = new Map<string, string>()

    await expect(sendPublicAnalyticsEvent({
      eventType: 'page_view',
      routeKey: 'home',
      entityType: null,
      entityId: null,
      actionKey: null,
    }, {
      fetchImpl: fetchImpl as typeof fetch,
      randomUUID: () => SESSION_ID,
      storage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => void storage.set(key, value),
      },
    })).resolves.toBeUndefined()

    expect(fetchImpl).toHaveBeenCalledOnce()
    const [path, options] = fetchImpl.mock.calls[0]!
    expect(path).toBe('/api/public/v1/analytics/events')
    expect(options).toMatchObject({
      cache: 'no-store',
      credentials: 'omit',
      keepalive: true,
      referrerPolicy: 'no-referrer',
    })
    expect(JSON.parse(String(options?.body))).toEqual({
      eventType: 'page_view',
      routeKey: 'home',
      entityType: null,
      entityId: null,
      actionKey: null,
      sessionId: SESSION_ID,
    })
  })

  it('swallows transport failures so analytics never blocks public actions', async () => {
    await expect(sendPublicAnalyticsEvent({
      eventType: 'contact_action',
      routeKey: 'commission',
      entityType: null,
      entityId: null,
      actionKey: 'email_open',
    }, {
      fetchImpl: vi.fn(async () => {
        throw new Error('offline')
      }) as typeof fetch,
      randomUUID: () => SESSION_ID,
      storage: {
        getItem: () => null,
        setItem: () => undefined,
      },
    })).resolves.toBeUndefined()
  })
})
