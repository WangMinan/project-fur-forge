import { createHmac } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  ANALYTICS_ACTION_LABELS,
  ANALYTICS_ROUTE_LABELS,
  analyticsOverviewDtoSchema,
} from '../../../shared/schemas/analytics'
import type {
  AnalyticsEventRequest,
  AnalyticsOverviewDto,
} from '../../../shared/types/contracts'
import {
  analyticsContactActions,
  analyticsEntityIsPublic,
  analyticsRangeCounts,
  deleteAnalyticsEventsBefore,
  insertAnalyticsEvent,
  topAnalyticsPages,
  topAnalyticsWorks,
} from '../repository/analytics-repository'
import { ServiceError } from '../service-error'

export const ANALYTICS_HMAC_DOMAIN = 'fur-forge:analytics-session:v1'
export const ANALYTICS_RETENTION_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1_000
const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1_000

export function analyticsSessionHmac(
  sessionId: string,
  secret: string,
  domain = ANALYTICS_HMAC_DOMAIN,
) {
  return createHmac('sha256', secret)
    .update(domain)
    .update('\0')
    .update(sessionId)
    .digest('hex')
}

/** “今日”按中国标准时间自然日计算，不依赖容器本地时区。 */
export function analyticsChinaDayStart(now: number) {
  return Math.floor((now + CHINA_TIME_OFFSET_MS) / DAY_MS) * DAY_MS
    - CHINA_TIME_OFFSET_MS
}

export function cleanupExpiredAnalyticsEvents(
  sqlite: Database.Database,
  now = Date.now(),
) {
  return deleteAnalyticsEventsBefore(
    sqlite,
    now - ANALYTICS_RETENTION_DAYS * DAY_MS,
  )
}

export function recordAnalyticsEvent(
  sqlite: Database.Database,
  input: AnalyticsEventRequest,
  sessionSecret: string | undefined,
  now = Date.now(),
) {
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new ServiceError(
      503,
      'INTERNAL_ERROR',
      'Analytics is unavailable.',
    )
  }

  if (
    input.entityType !== null
    && input.entityId !== null
    && !analyticsEntityIsPublic(sqlite, input.entityType, input.entityId)
  ) {
    throw new ServiceError(
      400,
      'VALIDATION_ERROR',
      'Analytics event is invalid.',
    )
  }

  sqlite.transaction(() => {
    cleanupExpiredAnalyticsEvents(sqlite, now)
    insertAnalyticsEvent(sqlite, {
      occurredAt: now,
      eventType: input.eventType,
      routeKey: input.routeKey,
      entityType: input.entityType,
      entityId: input.entityId,
      actionKey: input.actionKey,
      sessionHmac: analyticsSessionHmac(input.sessionId, sessionSecret),
    })
  })()

  return { accepted: true as const }
}

export function getAnalyticsOverview(
  sqlite: Database.Database,
  now = Date.now(),
): AnalyticsOverviewDto {
  const today = analyticsChinaDayStart(now)
  const sevenDays = today - 6 * DAY_MS
  const thirtyDays = today - 29 * DAY_MS

  return analyticsOverviewDtoSchema.parse({
    generatedAt: now,
    timeZone: 'Asia/Shanghai',
    retentionDays: ANALYTICS_RETENTION_DAYS,
    ranges: {
      today: analyticsRangeCounts(sqlite, today),
      sevenDays: analyticsRangeCounts(sqlite, sevenDays),
      thirtyDays: analyticsRangeCounts(sqlite, thirtyDays),
    },
    topPages: topAnalyticsPages(sqlite, thirtyDays).map(row => ({
      routeKey: row.routeKey,
      label: ANALYTICS_ROUTE_LABELS[row.routeKey],
      views: Number(row.views),
    })),
    topWorks: topAnalyticsWorks(sqlite, thirtyDays).map(row => ({
      id: row.id,
      label: row.label,
      href: `/works/${row.slug}`,
      views: Number(row.views),
    })),
    contactActions: analyticsContactActions(sqlite, thirtyDays).map(row => ({
      actionKey: row.actionKey,
      label: ANALYTICS_ACTION_LABELS[row.actionKey],
      count: Number(row.count),
    })),
  })
}
