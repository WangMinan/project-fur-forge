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
import { createSqlitePublicSiteRepository } from '../../server/utils/repository/public-site-repository'
import { generatePublicVariants } from '../../server/utils/recipe/media-recipe'
import { createSyntheticWatermarkPng } from '../../scripts/oss-preflight-core.mjs'
import { FakeMediaStorage } from '../helpers/fake-media-storage'
import { insertActiveWatermarkProfile } from '../helpers/watermark-fixture'

/**
 * T37 展会掉落公开投影：
 * 掉落与常规领养共用同一份领养投影、设定图与活动作品水印，
 * 只增加展会名称/时间与筛选，不新增媒体角色或配方。
 */

const NOW = Date.UTC(2026, 7, 8)
const MEDIA_BASE_URL = 'https://media.example.com'
const PREFIX = 'test/t37-fixture'

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

function insertAdoption(input: {
  eventName: string | null
  eventTime: string | null
  id: string
  method: 'event_drop' | 'regular'
  slug: string
}) {
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, suit_type, purpose,
      adoption_method, business_status, event_name, event_time,
      owner_display, price_amount_minor, price_currency,
      publication_status, sort_order, version, published_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, '犬科', 'full', 'adoption', ?, 'available', ?, ?,
              '不公开', 128000, 'CNY', 'published', 0, 1, ?, ?, ?)
  `).run(
    input.id,
    input.slug,
    `角色-${input.slug}`,
    input.method,
    input.eventName,
    input.eventTime,
    NOW,
    NOW,
    NOW,
  )
  return input.id
}

async function attachDesignSheet(workId: string, assetId: string) {
  const content = createSyntheticWatermarkPng(2400, 1600)
  const sha = assetId.replaceAll(/[^0-9a-f]/gu, 'a').padEnd(64, 'c').slice(0, 64)
  const key = `${PREFIX}/original/${assetId}/sheet.png`
  storage.seedPrivate(key, content, 'image/png', sha)
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, 'design_sheet', 'READY', ?, ?, ?, 'image/png',
              2400, 1600, ?, ?)
  `).run(assetId, key, sha, content.length, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO work_assets (work_id, asset_id, role, alt_text, position)
    VALUES (?, ?, 'design_sheet', '设定图', 0)
  `).run(workId, assetId)
  await generatePublicVariants(
    sqlite,
    storage,
    assetId,
    ['design-sheet', 'work-card'],
    NOW,
  )
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-event-drop-'))
  const databaseFile = resolve(directory, 'event.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
  insertActiveWatermarkProfile(sqlite, NOW, { environmentPrefix: PREFIX, storage })
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('T37 event drop public projection', () => {
  it('lists regular and event drops together and filters them', async () => {
    const regular = insertAdoption({
      eventName: null,
      eventTime: null,
      id: '11111111-1111-4111-8111-111111111111',
      method: 'regular',
      slug: 'regular-one',
    })
    const drop = insertAdoption({
      eventName: '幻夏祭 2026',
      eventTime: '8 月 15 日 至 16 日',
      id: '22222222-2222-4222-8222-222222222222',
      method: 'event_drop',
      slug: 'drop-one',
    })
    await attachDesignSheet(regular, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    await attachDesignSheet(drop, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')

    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)

    const all = repository.listAdoptions()
    expect(all.resultCount).toBe(2)
    expect(all.filter).toEqual({ method: 'all', valid: true })
    expect(all.counts).toEqual({ all: 2, event_drop: 1, regular: 1 })

    const regularOnly = repository.listAdoptions({ method: 'regular' })
    expect(regularOnly.items).toHaveLength(1)
    expect(regularOnly.items[0]!.work.slug).toBe('regular-one')
    expect(regularOnly.items[0]!.work.eventName).toBeNull()
    expect(regularOnly.items[0]!.work.eventTime).toBeNull()

    const dropOnly = repository.listAdoptions({ method: 'event_drop' })
    expect(dropOnly.items).toHaveLength(1)
    expect(dropOnly.items[0]!.work).toMatchObject({
      adoptionMethod: 'event_drop',
      eventName: '幻夏祭 2026',
      eventTime: '8 月 15 日 至 16 日',
    })

    // 非法筛选参数收敛为全部，并标记 valid=false，不抛 500。
    const invalid = repository.listAdoptions({ method: 'not-a-method' })
    expect(invalid.filter).toEqual({ method: 'all', valid: false })
    expect(invalid.resultCount).toBe(2)
  })

  it('exposes event fields on the unified work detail and keeps media watermarked', async () => {
    const drop = insertAdoption({
      eventName: '幻夏祭 2026',
      eventTime: '8 月 15 日 至 16 日',
      id: '22222222-2222-4222-8222-222222222222',
      method: 'event_drop',
      slug: 'drop-one',
    })
    await attachDesignSheet(drop, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')

    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    const detail = repository.getWorkBySlug('drop-one')
    expect(detail?.work).toMatchObject({
      adoptionMethod: 'event_drop',
      eventName: '幻夏祭 2026',
      eventTime: '8 月 15 日 至 16 日',
    })

    // 掉落媒体继续使用活动作品水印：没有新增 event 专用配方或用途。
    const variants = sqlite.prepare(`
      SELECT DISTINCT usage, recipe_version AS recipe,
             protection_mode AS protection
      FROM asset_variants
      WHERE asset_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        AND storage_scope = 'PUBLIC'
      ORDER BY usage
    `).all()
    expect(variants).toEqual([
      { protection: 'watermark', recipe: 'recipe-v2', usage: 'design-sheet' },
      { protection: 'watermark', recipe: 'recipe-v2', usage: 'work-card' },
    ])
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants WHERE usage LIKE '%event%'
    `).pluck().get()).toBe(0)
  })

  it('includes event drops in home current adoptions', async () => {
    const drop = insertAdoption({
      eventName: '幻夏祭 2026',
      eventTime: '8 月 15 日 至 16 日',
      id: '22222222-2222-4222-8222-222222222222',
      method: 'event_drop',
      slug: 'drop-one',
    })
    await attachDesignSheet(drop, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')

    const aggregate = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
      .getHomeAggregate()
    expect(aggregate.currentAdoptions.items).toHaveLength(1)
    expect(aggregate.currentAdoptions.items[0]!.work).toMatchObject({
      adoptionMethod: 'event_drop',
      eventName: '幻夏祭 2026',
      eventTime: '8 月 15 日 至 16 日',
    })
  })
})
