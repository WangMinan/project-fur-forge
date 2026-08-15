import type Database from 'better-sqlite3'
import type {
  AnalyticsActionKey,
  AnalyticsEntityType,
  AnalyticsEventType,
  AnalyticsRouteKey,
} from '../../../shared/types/contracts'

export interface StoredAnalyticsEvent {
  occurredAt: number
  eventType: AnalyticsEventType
  routeKey: AnalyticsRouteKey
  entityType: AnalyticsEntityType | null
  entityId: string | null
  actionKey: AnalyticsActionKey | null
  sessionHmac: string
}

export interface AnalyticsRangeCounts {
  pageViews: number
  approximateSessions: number
  contactActions: number
}

export function insertAnalyticsEvent(
  sqlite: Database.Database,
  event: StoredAnalyticsEvent,
) {
  sqlite.prepare(`
    INSERT INTO analytics_events (
      occurred_at, event_type, route_key,
      entity_type, entity_id, action_key, session_hmac
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.occurredAt,
    event.eventType,
    event.routeKey,
    event.entityType,
    event.entityId,
    event.actionKey,
    event.sessionHmac,
  )
}

export function deleteAnalyticsEventsBefore(
  sqlite: Database.Database,
  cutoff: number,
) {
  return sqlite.prepare(`
    DELETE FROM analytics_events WHERE occurred_at < ?
  `).run(cutoff).changes
}

/**
 * 公开实体必须仍处于公开业务状态。媒体完整性仍由公开读取链负责；这里拒绝
 * 不存在、草稿或已下架 ID，避免任意 UUID 污染内容排行。
 */
export function analyticsEntityIsPublic(
  sqlite: Database.Database,
  entityType: AnalyticsEntityType,
  entityId: string,
) {
  return sqlite.prepare(`
    SELECT 1 FROM works
    WHERE id = ? AND publication_status = 'published'
  `).pluck().get(entityId) === 1
}

export function analyticsRangeCounts(
  sqlite: Database.Database,
  since: number,
): AnalyticsRangeCounts {
  const row = sqlite.prepare(`
    SELECT
      count(CASE WHEN event_type = 'page_view' THEN 1 END) AS pageViews,
      count(DISTINCT CASE
        WHEN event_type = 'page_view' THEN session_hmac
      END) AS approximateSessions,
      count(CASE WHEN event_type = 'contact_action' THEN 1 END) AS contactActions
    FROM analytics_events
    WHERE occurred_at >= ?
  `).get(since) as AnalyticsRangeCounts

  return {
    pageViews: Number(row.pageViews),
    approximateSessions: Number(row.approximateSessions),
    contactActions: Number(row.contactActions),
  }
}

export function topAnalyticsPages(
  sqlite: Database.Database,
  since: number,
) {
  return sqlite.prepare(`
    SELECT route_key AS routeKey, count(*) AS views
    FROM analytics_events
    WHERE occurred_at >= ? AND event_type = 'page_view'
    GROUP BY route_key
    ORDER BY views DESC, route_key
    LIMIT 10
  `).all(since) as Array<{
    routeKey: AnalyticsRouteKey
    views: number
  }>
}

export function topAnalyticsWorks(
  sqlite: Database.Database,
  since: number,
) {
  return sqlite.prepare(`
    SELECT
      work.id,
      work.character_name AS label,
      work.slug,
      count(*) AS views
    FROM analytics_events AS event
    JOIN works AS work
      ON work.id = event.entity_id
      AND work.publication_status = 'published'
    WHERE event.occurred_at >= ?
      AND event.event_type = 'page_view'
      AND event.entity_type = 'work'
      AND event.route_key = 'work_detail'
    GROUP BY work.id, work.character_name, work.slug
    ORDER BY views DESC, work.id
    LIMIT 10
  `).all(since) as Array<{
    id: string
    label: string
    slug: string
    views: number
  }>
}

export function analyticsContactActions(
  sqlite: Database.Database,
  since: number,
) {
  return sqlite.prepare(`
    SELECT action_key AS actionKey, count(*) AS count
    FROM analytics_events
    WHERE occurred_at >= ?
      AND event_type = 'contact_action'
      AND action_key IS NOT NULL
    GROUP BY action_key
    ORDER BY count DESC, action_key
  `).all(since) as Array<{
    actionKey: AnalyticsActionKey
    count: number
  }>
}
