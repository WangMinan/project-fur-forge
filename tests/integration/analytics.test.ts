import {
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import {
  analyticsSessionHmac,
  cleanupExpiredAnalyticsEvents,
  getAnalyticsOverview,
  recordAnalyticsEvent,
} from '../../server/utils/service/analytics'
import { insertAnalyticsEvent } from '../../server/utils/repository/analytics-repository'

const NOW = Date.UTC(2026, 7, 9, 4, 0, 0)
const DAY_MS = 24 * 60 * 60 * 1_000
const SECRET = 'test-session-secret-for-t46-is-long-enough'
const WORK_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const PHOTO_ID = '33333333-3333-4333-8333-333333333333'
const ASSET_ID = '44444444-4444-4444-8444-444444444444'
const SESSION_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SESSION_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

let directory: string
let sqlite: Database.Database

function pageView(input: {
  entityId?: string
  entityType?: 'return_character' | 'work'
  routeKey: 'about' | 'home' | 'return_character' | 'work_detail' | 'works'
  sessionId?: string
}, occurredAt = NOW) {
  recordAnalyticsEvent(sqlite, {
    eventType: 'page_view',
    routeKey: input.routeKey,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    actionKey: null,
    sessionId: input.sessionId ?? SESSION_A,
  }, SECRET, occurredAt)
}

function contactAction(
  actionKey: 'email_copy' | 'email_open',
  occurredAt = NOW,
) {
  recordAnalyticsEvent(sqlite, {
    eventType: 'contact_action',
    routeKey: 'about',
    entityType: null,
    entityId: null,
    actionKey,
    sessionId: SESSION_A,
  }, SECRET, occurredAt)
}

function seedPublishedEntities() {
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, suit_type, purpose,
      owner_display, publication_status, published_at, created_at, updated_at
    ) VALUES (?, 'tuanzi', '团子', '犬科', 'full', 'showcase',
      '不公开', 'published', ?, ?, ?)
  `).run(WORK_ID, NOW, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO return_characters (
      id, slug, name, version, created_at, updated_at
    ) VALUES (?, 'tianmu', '天暮', 1, ?, ?)
  `).run(CHARACTER_ID, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, 'return_photo', 'READY', 'test/return/source.jpg', ?, 1024,
      'image/jpeg', 1200, 1800, ?, ?)
  `).run(ASSET_ID, 'a'.repeat(64), NOW, NOW)
  sqlite.prepare(`
    INSERT INTO return_photos (
      id, character_id, asset_id, alt, is_primary, publication_status,
      version, published_at, created_at, updated_at
    ) VALUES (?, ?, ?, '天暮返图', 1, 'published', 1, ?, ?, ?)
  `).run(PHOTO_ID, CHARACTER_ID, ASSET_ID, NOW, NOW, NOW)
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-analytics-'))
  const databaseFile = resolve(directory, 'analytics.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  seedPublishedEntities()
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('T46 analytics persistence and overview', () => {
  it('migrates the minimal table with bounded indexes and no tracking fields', () => {
    const columns = sqlite.prepare('PRAGMA table_info(analytics_events)')
      .all()
      .map(column => (column as { name: string }).name)
    const indexes = sqlite.prepare('PRAGMA index_list(analytics_events)')
      .all()
      .map(index => (index as { name: string }).name)

    expect(columns).toEqual([
      'id',
      'occurred_at',
      'event_type',
      'route_key',
      'entity_type',
      'entity_id',
      'action_key',
      'session_hmac',
    ])
    expect(columns).not.toEqual(expect.arrayContaining([
      'ip',
      'user_agent',
      'referer',
      'url',
      'query',
      'cookie',
      'contact',
      'fingerprint',
    ]))
    expect(indexes).toEqual(expect.arrayContaining([
      'analytics_events_occurred_idx',
      'analytics_events_type_occurred_idx',
      'analytics_events_route_occurred_idx',
      'analytics_events_entity_occurred_idx',
    ]))

    const plan = sqlite.prepare(`
      EXPLAIN QUERY PLAN
      SELECT count(*) FROM analytics_events WHERE occurred_at >= ?
    `).all(NOW - 29 * DAY_MS) as Array<{ detail: string }>
    expect(plan.some(row => row.detail.includes('analytics_events_occurred_idx')))
      .toBe(true)
  })

  it('stores only the HMAC session token and aggregates today, 7 and 30 days', () => {
    pageView({ routeKey: 'home' })
    pageView({ routeKey: 'home', sessionId: SESSION_B })
    pageView({
      entityId: WORK_ID,
      entityType: 'work',
      routeKey: 'work_detail',
    })
    pageView({
      entityId: CHARACTER_ID,
      entityType: 'return_character',
      routeKey: 'return_character',
    }, NOW - 5 * DAY_MS)
    pageView({ routeKey: 'works' }, NOW - 20 * DAY_MS)
    contactAction('email_copy')
    contactAction('email_open', NOW - 5 * DAY_MS)

    const stored = sqlite.prepare(`
      SELECT session_hmac AS sessionHmac FROM analytics_events ORDER BY id LIMIT 1
    `).get() as { sessionHmac: string }
    expect(stored.sessionHmac).toBe(analyticsSessionHmac(SESSION_A, SECRET))
    expect(stored.sessionHmac).not.toContain(SESSION_A)

    const overview = getAnalyticsOverview(sqlite, NOW)
    expect(overview.ranges).toEqual({
      today: {
        pageViews: 3,
        approximateSessions: 2,
        contactActions: 1,
      },
      sevenDays: {
        pageViews: 4,
        approximateSessions: 2,
        contactActions: 2,
      },
      thirtyDays: {
        pageViews: 5,
        approximateSessions: 2,
        contactActions: 2,
      },
    })
    expect(overview.topPages[0]).toMatchObject({
      routeKey: 'home',
      views: 2,
    })
    expect(overview.topWorks).toEqual([expect.objectContaining({
      id: WORK_ID,
      href: '/works/tuanzi',
      label: '团子',
      views: 1,
    })])
    expect(overview.topReturnCharacters).toEqual([expect.objectContaining({
      id: CHARACTER_ID,
      href: '/returns/tianmu',
      label: '天暮',
      views: 1,
    })])
    expect(overview.contactActions).toHaveLength(2)
  })

  it('deletes only events older than 90 days and remains idempotent', () => {
    pageView({ routeKey: 'home' }, NOW - 90 * DAY_MS - 1)
    pageView({ routeKey: 'works' }, NOW - 90 * DAY_MS)
    pageView({ routeKey: 'about' }, NOW)

    // 当前写入已在同一事务内清掉第一条；再直写一条过期 fixture 验证显式清理。
    expect(sqlite.prepare('SELECT route_key FROM analytics_events ORDER BY id')
      .pluck().all()).toEqual(['works', 'about'])
    insertAnalyticsEvent(sqlite, {
      occurredAt: NOW - 90 * DAY_MS - 1,
      eventType: 'page_view',
      routeKey: 'home',
      entityType: null,
      entityId: null,
      actionKey: null,
      sessionHmac: analyticsSessionHmac(SESSION_A, SECRET),
    })
    expect(cleanupExpiredAnalyticsEvents(sqlite, NOW)).toBe(1)
    expect(cleanupExpiredAnalyticsEvents(sqlite, NOW)).toBe(0)
    expect(sqlite.prepare('SELECT route_key FROM analytics_events ORDER BY id')
      .pluck().all()).toEqual(['works', 'about'])
  })

  it('rejects unpublished or unknown entity identifiers', () => {
    sqlite.prepare(`
      UPDATE works SET publication_status = 'unpublished' WHERE id = ?
    `).run(WORK_ID)

    expect(() => pageView({
      entityId: WORK_ID,
      entityType: 'work',
      routeKey: 'work_detail',
    })).toThrow(/invalid/u)
    expect(sqlite.prepare('SELECT count(*) FROM analytics_events').pluck().get())
      .toBe(0)
  })
})
