import { createHash } from 'node:crypto'
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
import { createSyntheticWatermarkPng } from '../../scripts/oss-preflight-core.mjs'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import { generatePublicVariants } from '../../server/utils/recipe/media-recipe'
import { resetOperationLeaseOwner } from '../../server/utils/repository/operation-lease'
import {
  findReconcileTargets,
  reconcileSiteDisplay,
  reconcileTargetComplete,
} from '../../server/utils/runner/site-display-reconcile'
import {
  LEGACY_SITE_DISPLAY_RECIPE_VERSION,
  SITE_DISPLAY_RECIPE_VERSION,
} from '../../server/utils/recipe/site-display-recipe'
import { getPublicHome } from '../../server/utils/runner/home-management'
import { FakeMediaStorage } from '../helpers/fake-media-storage'
import { insertActiveWatermarkProfile } from '../helpers/watermark-fixture'

const NOW = Date.UTC(2026, 7, 6)
const PREFIX = 'test/t34-f1-reconcile'
const MEDIA_BASE_URL = 'http://127.0.0.2:3000'

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

function insertSource(id: string, role: string, width: number, height: number) {
  const content = createSyntheticWatermarkPng() as Buffer
  const sha256 = createHash('sha256').update(content).digest('hex')
  const objectKey = `${PREFIX}/original/${id}/source.png`
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, ?, 'READY', ?, ?, ?, 'image/png', ?, ?, ?, ?)
  `).run(id, role, objectKey, sha256, content.length, width, height, NOW, NOW)
  storage.seedPrivate(objectKey, content, 'image/png', sha256, {
    fileSize: content.length,
    format: 'png',
    height,
    orientation: 1,
    width,
  })
}

/** 模拟迁移 0017 之前的既有数据：启用 Hero 只有旧水印变体，没有站点展示变体。 */
async function seedLegacyEnabledHero(placement: 'home' | 'commission') {
  const landscapeId = `${placement}-landscape`
  const portraitId = `${placement}-portrait`
  insertSource(landscapeId, 'home_hero_landscape', 4000, 2250)
  insertSource(portraitId, 'home_hero_portrait', 1800, 3200)
  sqlite.prepare(`
    INSERT INTO site_hero_slides (
      id, placement, landscape_asset_id, portrait_asset_id, alt_text,
      sort_order, enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
  `).run(
    `${placement}-slide`,
    placement,
    landscapeId,
    portraitId,
    `${placement} 旧首图`,
    NOW,
    NOW,
  )
  const itemIds = placement === 'home'
    ? [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ]
    : [
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444',
      ]
  sqlite.prepare(`
    INSERT INTO site_hero_items (
      id, placement, orientation, asset_id, alt_text,
      sort_order, enabled, created_at, updated_at
    ) VALUES (?, ?, 'landscape', ?, ?, 0, 1, ?, ?)
  `).run(itemIds[0], placement, landscapeId, `${placement} 旧首图`, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO site_hero_items (
      id, placement, orientation, asset_id, alt_text,
      sort_order, enabled, created_at, updated_at
    ) VALUES (?, ?, 'portrait', ?, ?, 0, 1, ?, ?)
  `).run(itemIds[1], placement, portraitId, `${placement} 旧首图`, NOW, NOW)
  // 旧水印变体：迁移后仍存在，reconcile 不应删除它们。
  await generatePublicVariants(sqlite, storage, landscapeId, undefined, NOW)
  await generatePublicVariants(sqlite, storage, portraitId, undefined, NOW)
}

/** 既有已发布领养：已有水印横版封面，没有首页入口无水印变体。 */
async function seedLegacyPublishedAdoption() {
  insertSource('adoption-cover', 'adoption_cover', 3200, 1800)
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, purpose, adoption_status,
      publication_status, sort_order, published_at, created_at, updated_at
    ) VALUES (
      'adoption-work', 'adoption-work', '云朵', '犬科', 'adoption',
      'available', 'published', 0, ?, ?, ?
    )
  `).run(NOW, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO work_assets (
      work_id, asset_id, role, alt_text, position, is_primary,
      crop_x, crop_y, crop_width, crop_height, watermark_anchor
    ) VALUES (
      'adoption-work', 'adoption-cover', 'adoption_cover', '云朵领养横版封面',
      0, 0, 0, 0, 1, 1, 'top-left'
    )
  `).run()
  await generatePublicVariants(
    sqlite,
    storage,
    'adoption-cover',
    ['adoption-card'],
    NOW,
  )
}

function siteDisplayKeys() {
  return sqlite.prepare(`
    SELECT object_key FROM asset_variants
    WHERE recipe_version = ? AND storage_scope = 'PUBLIC' AND status = 'READY'
    ORDER BY object_key
  `).pluck().all(SITE_DISPLAY_RECIPE_VERSION) as string[]
}

function watermarkKeys() {
  return sqlite.prepare(`
    SELECT object_key FROM asset_variants
    WHERE protection_mode = 'watermark' AND storage_scope = 'PUBLIC'
    ORDER BY object_key
  `).pluck().all() as string[]
}

function seedLegacySiteDisplay(
  assetId: string,
  usage: 'home-hero-landscape' | 'home-hero-portrait',
) {
  const role = usage === 'home-hero-landscape'
    ? 'home_hero_landscape'
    : 'home_hero_portrait'
  const widths = usage === 'home-hero-landscape'
    ? [768, 1280, 1920]
    : [480, 768, 1080]
  const sourceSha256 = sqlite.prepare(
    'SELECT sha256 FROM assets WHERE id = ?',
  ).pluck().get(assetId) as string
  for (const width of widths) {
    for (const format of ['webp', 'png'] as const) {
      const id = `${assetId}-${width}-${format}-legacy`
      sqlite.prepare(`
        INSERT INTO asset_variants (
          id, asset_id, storage_scope, status, object_key,
          input_sha256, media_role, usage, width, height, format, quality,
          crop_identity, recipe_version, protection_mode, watermark_profile,
          watermark_config_digest, logo_digest, watermark_anchor,
          sha256, byte_size, created_at, updated_at
        ) VALUES (
          ?, ?, 'PUBLIC', 'READY', ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, 'none', 'none',
          'none', 'none', 'none',
          ?, 100, ?, ?
        )
      `).run(
        id,
        assetId,
        `${PREFIX}/web/${assetId}/${LEGACY_SITE_DISPLAY_RECIPE_VERSION}/${usage}/${width}/${id}.${format}`,
        sourceSha256,
        role,
        usage,
        width,
        usage === 'home-hero-landscape'
          ? Math.round(width * 9 / 16)
          : Math.round(width * 16 / 9),
        format,
        format === 'webp' ? 82 : 100,
        `legacy:${width}:${format}`,
        LEGACY_SITE_DISPLAY_RECIPE_VERSION,
        'd'.repeat(64),
        NOW,
        NOW,
      )
    }
  }
}

function reconcileRows() {
  return sqlite.prepare(`
    SELECT id, scope, status, scanned_count AS scanned,
           generated_count AS generated, skipped_count AS skipped,
           failed_count AS failed, attempt
    FROM site_display_reconcile_operations
    ORDER BY started_at, id
  `).all() as Array<{
    attempt: number
    failed: number
    generated: number
    id: string
    scanned: number
    scope: string
    skipped: number
    status: string
  }>
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-reconcile-'))
  const databaseFile = resolve(directory, 'studio.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
  resetOperationLeaseOwner()
  insertActiveWatermarkProfile(sqlite, NOW, { environmentPrefix: PREFIX })
  await seedLegacyEnabledHero('home')
  await seedLegacyEnabledHero('commission')
  await seedLegacyPublishedAdoption()
})

afterEach(() => {
  sqlite.close()
  resetOperationLeaseOwner()
  rmSync(directory, { force: true, recursive: true })
})

describe('T34-F1 existing site display reconcile', () => {
  it('scans enabled heroes, the commission entry source and published regular adoptions', () => {
    const targets = findReconcileTargets(sqlite)

    expect(targets.map(target => target.label)).toEqual([
      'commission-hero-landscape',
      'home-entry-commission',
      'commission-hero-portrait',
      'home-hero-landscape',
      'home-hero-portrait',
      'home-entry-adoption',
    ])
    // 全部目标最初都缺变体：这正是迁移 0017 遗留的状态。
    expect(targets.every(target => !reconcileTargetComplete(sqlite, target)))
      .toBe(true)
  })

  it('reports a redacted count summary in dry-run without creating rows or objects', async () => {
    const result = await reconcileSiteDisplay({ sqlite, storage })

    expect(result).toEqual({
      dryRun: true,
      failed: 0,
      generated: 0,
      operationId: null,
      recipeVersion: SITE_DISPLAY_RECIPE_VERSION,
      scanned: 6,
      skipped: 0,
      status: 'SCANNING',
    })
    // dry-run 摘要只含数量，没有 Object Key 或私有路径。
    expect(JSON.stringify(result)).not.toContain(PREFIX)
    expect(reconcileRows()).toEqual([])
    expect(siteDisplayKeys()).toEqual([])
  })

  it('backfills every enabled hero and adoption entry without disabling anything', async () => {
    const beforeWatermark = watermarkKeys()
    const enabledBefore = sqlite.prepare(`
      SELECT count(*) FROM site_hero_slides WHERE enabled = 1
    `).pluck().get()

    const result = await reconcileSiteDisplay({
      sqlite,
      storage,
      dryRun: false,
      now: NOW,
    })

    expect(result).toMatchObject({
      dryRun: false,
      failed: 0,
      generated: 6,
      scanned: 6,
      skipped: 0,
      status: 'DONE',
    })
    // 管理员不需要手动禁用再启用：启用状态原样保留。
    expect(sqlite.prepare(`
      SELECT count(*) FROM site_hero_slides WHERE enabled = 1
    `).pluck().get()).toBe(enabledBefore)
    // 作品与领养的水印变体一个都没动。
    expect(watermarkKeys()).toEqual(beforeWatermark)
    // 站点展示变体全部为无水印 site-display-v2。
    const created = siteDisplayKeys()
    expect(created).toHaveLength(40)
    expect(created.every(key => key.includes(SITE_DISPLAY_RECIPE_VERSION)))
      .toBe(true)
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE recipe_version = ? AND protection_mode != 'none'
    `).pluck().get(SITE_DISPLAY_RECIPE_VERSION)).toBe(0)
    expect(findReconcileTargets(sqlite)
      .every(target => reconcileTargetComplete(sqlite, target))).toBe(true)
  })

  it('serves a complete v1 hero until the v2 operation atomically replaces it', async () => {
    seedLegacySiteDisplay('home-landscape', 'home-hero-landscape')
    seedLegacySiteDisplay('home-portrait', 'home-hero-portrait')

    const before = getPublicHome(sqlite, MEDIA_BASE_URL)
    expect(before.landscape[0]?.sources.webp).toHaveLength(3)
    expect([
      ...before.landscape[0]!.sources.webp,
      ...before.landscape[0]!.sources.fallback,
      ...before.portrait[0]!.sources.webp,
      ...before.portrait[0]!.sources.fallback,
    ].every(variant => variant.src.includes(LEGACY_SITE_DISPLAY_RECIPE_VERSION)))
      .toBe(true)

    const upgraded = await reconcileSiteDisplay({
      sqlite,
      storage,
      dryRun: false,
      now: NOW,
      scope: 'home-hero',
    })
    expect(upgraded).toMatchObject({
      failed: 0,
      generated: 2,
      recipeVersion: SITE_DISPLAY_RECIPE_VERSION,
      status: 'DONE',
    })

    const after = getPublicHome(sqlite, MEDIA_BASE_URL)
    expect(after.landscape[0]?.sources.webp).toHaveLength(5)
    expect([
      ...after.landscape[0]!.sources.webp,
      ...after.landscape[0]!.sources.fallback,
      ...after.portrait[0]!.sources.webp,
      ...after.portrait[0]!.sources.fallback,
    ].every(variant => variant.src.includes(SITE_DISPLAY_RECIPE_VERSION)))
      .toBe(true)
  })

  it('uses the reconcile timestamp for a private hero upscale source', async () => {
    insertSource(
      'low-resolution-home-landscape',
      'home_hero_landscape',
      320,
      180,
    )
    sqlite.prepare(`
      UPDATE site_hero_slides
      SET landscape_asset_id = 'low-resolution-home-landscape'
      WHERE id = 'home-slide'
    `).run()
    sqlite.prepare(`
      UPDATE site_hero_items
      SET asset_id = 'low-resolution-home-landscape'
      WHERE placement = 'home' AND orientation = 'landscape'
    `).run()

    const result = await reconcileSiteDisplay({
      sqlite,
      storage,
      dryRun: false,
      now: NOW,
      scope: 'home-hero',
    })

    expect(result).toMatchObject({ failed: 0, generated: 2, status: 'DONE' })
    expect(sqlite.prepare(`
      SELECT created_at AS createdAt, updated_at AS updatedAt
      FROM asset_variants
      WHERE asset_id = 'low-resolution-home-landscape'
        AND recipe_version = 'hero-upscale-lanczos-v2'
    `).get()).toEqual({ createdAt: NOW, updatedAt: NOW })
  })

  it('projects the homepage hero and both entries without watermarks after reconcile', async () => {
    await reconcileSiteDisplay({ sqlite, storage, dryRun: false, now: NOW })

    const home = getPublicHome(sqlite, MEDIA_BASE_URL)

    expect(home.landscape).toHaveLength(1)
    expect(home.portrait).toHaveLength(1)
    expect(home.entries.commission).not.toBeNull()
    expect(home.entries.adoption).not.toBeNull()
    const sourceUrls = (set: {
      fallback: Array<{ src: string }>
      webp: Array<{ src: string }>
    }) => [...set.webp, ...set.fallback].map(source => source.src)
    const urls = [
      ...home.landscape.flatMap(item => sourceUrls(item.sources)),
      ...home.portrait.flatMap(item => sourceUrls(item.sources)),
      ...sourceUrls(home.entries.commission!.sources),
      ...sourceUrls(home.entries.adoption!.sources),
    ]
    expect(urls.length).toBeGreaterThan(0)
    // 站点展示位一律 site-display-v2；作品保护配方不出现在这些 URL 上。
    expect(urls.every(url => url.includes(SITE_DISPLAY_RECIPE_VERSION))).toBe(true)
    expect(urls.some(url => url.includes('recipe-v2'))).toBe(false)
    // 首页入口 URL 与委托 Hero 的公开 URL 不同：入口使用独立变体。
    expect(sourceUrls(home.entries.commission!.sources)
      .every(url => url.includes('home-entry-commission'))).toBe(true)
  })

  it('is idempotent: a second run creates no duplicate rows and no duplicate objects', async () => {
    await reconcileSiteDisplay({ sqlite, storage, dryRun: false, now: NOW })
    const firstKeys = siteDisplayKeys()
    const firstProcessCalls = storage.processCalls.length

    const second = await reconcileSiteDisplay({
      sqlite,
      storage,
      dryRun: false,
      now: NOW + 1_000,
    })

    expect(second).toMatchObject({
      failed: 0,
      generated: 0,
      scanned: 6,
      skipped: 6,
      status: 'DONE',
    })
    expect(siteDisplayKeys()).toEqual(firstKeys)
    // 完整目标直接跳过：不再调用 OSS 处理。
    expect(storage.processCalls).toHaveLength(firstProcessCalls)
    const rows = reconcileRows()
    expect(rows).toHaveLength(2)
    expect(rows.every(row => row.status === 'DONE')).toBe(true)
  })

  it('keeps the old projection usable and stays retryable when generation fails', async () => {
    storage.failProcess = true

    const failure = await reconcileSiteDisplay({
      sqlite,
      storage,
      dryRun: false,
      now: NOW,
    })

    expect(failure).toMatchObject({ status: 'FAILED', generated: 0 })
    expect(failure.failed).toBeGreaterThan(0)
    // 失败不留半套变体，公开投影因此继续走旧 Hero 水印回退，不 500。
    expect(siteDisplayKeys()).toEqual([])
    expect(() => getPublicHome(sqlite, MEDIA_BASE_URL)).not.toThrow()
    expect(watermarkKeys().length).toBeGreaterThan(0)

    // 修复后重试：同一 scope 可以再次执行并成功。
    storage.failProcess = false
    const retry = await reconcileSiteDisplay({
      sqlite,
      storage,
      dryRun: false,
      now: NOW + 2_000,
    })
    expect(retry).toMatchObject({ status: 'DONE', failed: 0, generated: 6 })
  })

  it('resumes an interrupted reconcile operation on a new attempt', async () => {
    storage.failProcess = true
    await reconcileSiteDisplay({ sqlite, storage, dryRun: false, now: NOW })
    // 把失败的记录改回运行态，模拟进程在生成阶段被杀死后留下的行。
    const [stale] = reconcileRows()
    sqlite.prepare(`
      UPDATE site_display_reconcile_operations
      SET status = 'GENERATING_PUBLIC', internal_error_code = NULL,
          failure_stage = NULL, completed_at = NULL,
          lease_owner = 'killed-host/1/deadbeef',
          lease_expires_at = ?
      WHERE id = ?
    `).run(NOW - 1, stale!.id)
    storage.failProcess = false

    const resumed = await reconcileSiteDisplay({
      sqlite,
      storage,
      dryRun: false,
      now: NOW + 5_000,
    })

    // 接管同一条 operation，而不是并行创建第二条。
    expect(resumed.operationId).toBe(stale!.id)
    expect(resumed).toMatchObject({ status: 'DONE', failed: 0 })
    expect(reconcileRows()).toHaveLength(1)
    expect(reconcileRows()[0]!.attempt).toBe(2)
  })

  it('records a failure instead of upscaling when a source is too small', async () => {
    // 原图身份不可变，因此换成一件新的、源过小的已发布常规领养作为入口源。
    sqlite.prepare('DELETE FROM works WHERE id = \'adoption-work\'').run()
    insertSource('tiny-cover', 'adoption_cover', 400, 300)
    sqlite.prepare(`
      INSERT INTO works (
        id, slug, character_name, species, purpose, adoption_status,
        publication_status, sort_order, published_at, created_at, updated_at
      ) VALUES (
        'tiny-work', 'tiny-work', '小图', '犬科', 'adoption',
        'available', 'published', 0, ?, ?, ?
      )
    `).run(NOW, NOW, NOW)
    sqlite.prepare(`
      INSERT INTO work_assets (
        work_id, asset_id, role, alt_text, position, is_primary,
        crop_x, crop_y, crop_width, crop_height, watermark_anchor
      ) VALUES (
        'tiny-work', 'tiny-cover', 'adoption_cover', '小图横版封面',
        0, 0, 0, 0, 1, 1, 'top-left'
      )
    `).run()

    const result = await reconcileSiteDisplay({
      sqlite,
      storage,
      dryRun: false,
      now: NOW,
      scope: 'home-entry',
    })

    expect(result.failed).toBe(1)
    expect(result.status).toBe('FAILED')
    // 源太小的入口不生成任何变体，也不放大、不改用作品水印图。
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE asset_id = 'tiny-sheet' AND recipe_version = ?
    `).pluck().get(SITE_DISPLAY_RECIPE_VERSION)).toBe(0)
    // 公开投影受控隐藏该入口，而不是 500。
    expect(getPublicHome(sqlite, MEDIA_BASE_URL).entries.adoption).toBeNull()
  })

  it('leaves site display urls and digests unchanged when the watermark profile changes', async () => {
    await reconcileSiteDisplay({ sqlite, storage, dryRun: false, now: NOW })
    const before = sqlite.prepare(`
      SELECT object_key AS objectKey, sha256, byte_size AS byteSize
      FROM asset_variants WHERE recipe_version = ?
      ORDER BY object_key
    `).all(SITE_DISPLAY_RECIPE_VERSION)

    // 换一个活动水印 profile：站点展示变体不属于 profile 重建目标。
    insertActiveWatermarkProfile(sqlite, NOW + 1_000, {
      assetId: '77777777-7777-4777-8777-777777777777',
      environmentPrefix: PREFIX,
      opacityPercent: 40,
      profileId: '66666666-6666-4666-8666-666666666666',
      scalePercent: 35,
    })
    const after = sqlite.prepare(`
      SELECT object_key AS objectKey, sha256, byte_size AS byteSize
      FROM asset_variants WHERE recipe_version = ?
      ORDER BY object_key
    `).all(SITE_DISPLAY_RECIPE_VERSION)

    expect(after).toEqual(before)
  })
})
