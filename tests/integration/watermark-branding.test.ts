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
import {
  applyWatermarkProfile,
  createWatermarkPreview,
  getWatermarkBranding,
  getWatermarkOperation,
  runWatermarkProfileApplication,
  retryWatermarkOperation,
  startWatermarkProfileApplication,
  startWatermarkRefresh,
} from '../../server/utils/runner/watermark-branding'
import {
  createWatermarkProfile,
  requireSiteBranding,
  requireWatermarkProfile,
} from '../../server/utils/service/watermark-profile'
import { seedBundledWatermark } from '../../server/utils/runner/watermark-seed'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const NOW = Date.UTC(2026, 7, 1)
const PREFIX = 'test/gate07'

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage
let seededProfileId: string

function insertSource(id: string, role: string, width: number, height: number) {
  const content = createSyntheticWatermarkPng()
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

function insertPublishedTargets() {
  insertSource('work-photo', 'studio_photo', 3200, 2400)
  insertSource('hero-landscape', 'home_hero_landscape', 4000, 2250)
  insertSource('hero-portrait', 'home_hero_portrait', 1800, 3200)
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, suit_type, purpose,
      owner_display, publication_status, published_at, created_at, updated_at
    ) VALUES (
      'published-work', 'published-work', '团子', '犬科', 'full', 'showcase',
      '不公开', 'published', ?, ?, ?
    )
  `).run(NOW, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO work_assets (
      work_id, asset_id, role, alt_text, position, is_primary,
      crop_x, crop_y, crop_width, crop_height, watermark_anchor
    ) VALUES (
      'published-work', 'work-photo', 'studio_photo', '团子出厂照', 0, 1,
      0, 0, 1, 1, 'top-left'
    )
  `).run()
  sqlite.prepare(`
    INSERT INTO site_hero_slides (
      id, landscape_asset_id, portrait_asset_id, alt_text,
      sort_order, enabled, created_at, updated_at
    ) VALUES (
      'hero-slide', 'hero-landscape', 'hero-portrait', '团子首页图',
      0, 1, ?, ?
    )
  `).run(NOW, NOW)
}

async function generateActiveVariants() {
  await generatePublicVariants(sqlite, storage, 'work-photo', undefined, NOW)
  await generatePublicVariants(sqlite, storage, 'hero-landscape', undefined, NOW)
  await generatePublicVariants(sqlite, storage, 'hero-portrait', undefined, NOW)
  return sqlite.prepare(`
    SELECT object_key FROM asset_variants
    WHERE storage_scope = 'PUBLIC' AND watermark_profile_id = ?
    ORDER BY object_key
  `).pluck().all(seededProfileId) as string[]
}

async function createPreviewedDraft(opacityPercent = 55) {
  const branding = requireSiteBranding(sqlite)
  const active = requireWatermarkProfile(sqlite, seededProfileId)
  const draft = createWatermarkProfile(sqlite, branding.version, {
    sourceAssetId: active.sourceAssetId,
    opacityPercent,
    scalePercent: 60,
  }, NOW + 1_000)
  const previewBranding = requireSiteBranding(sqlite)
  const preview = await createWatermarkPreview(
    sqlite,
    storage,
    draft.id,
    draft.version,
    previewBranding.version,
    NOW + 2_000,
  )
  return {
    draft: requireWatermarkProfile(sqlite, draft.id),
    preview,
  }
}

async function applyDraft(profileId: string, profileVersion: number) {
  return applyWatermarkProfile(
    sqlite,
    storage,
    profileId,
    profileVersion,
    requireSiteBranding(sqlite).version,
    NOW + 3_000,
  )
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-watermark-'))
  const databaseFile = resolve(directory, 'watermark.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
  const seeded = await seedBundledWatermark(
    sqlite,
    storage,
    { appEnv: 'test' },
    { keyPrefix: PREFIX, now: NOW },
  )
  seededProfileId = seeded.profileId
  insertPublishedTargets()
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('GATE-07 watermark branding lifecycle', () => {
  it('seeds idempotently and exposes only safe branding fields', async () => {
    const repeated = await seedBundledWatermark(
      sqlite,
      storage,
      { appEnv: 'test' },
      { keyPrefix: PREFIX, now: NOW + 1_000 },
    )
    const dto = getWatermarkBranding(sqlite)
    const serialized = JSON.stringify(dto)

    expect(repeated).toMatchObject({
      profileId: seededProfileId,
      profileStatus: 'ACTIVE',
      reusedCandidate: true,
    })
    expect(dto.candidates).toHaveLength(1)
    expect(serialized).not.toContain('/original/')
    expect(serialized).not.toContain(
      requireWatermarkProfile(sqlite, seededProfileId).logoDigest,
    )
    expect(() => createWatermarkProfile(sqlite, 0, {
      sourceAssetId: repeated.assetId,
      opacityPercent: 57,
      scalePercent: 60,
    }, NOW + 2_000)).toThrow(/version is stale/)
  })

  it('does not replace an administrator-selected profile on a later seed run', async () => {
    const { draft } = await createPreviewedDraft()
    await applyDraft(draft.id, draft.version)
    const before = requireSiteBranding(sqlite)

    const repeated = await seedBundledWatermark(
      sqlite,
      storage,
      { appEnv: 'test' },
      { keyPrefix: PREFIX, now: NOW + 4_000 },
    )

    expect(repeated.profileId).toBe(draft.id)
    expect(requireSiteBranding(sqlite)).toEqual(before)
  })

  it('activates an empty site in one save without a branding preview', async () => {
    const active = requireWatermarkProfile(sqlite, seededProfileId)
    sqlite.transaction(() => {
      sqlite.prepare('DELETE FROM work_assets').run()
      sqlite.prepare('DELETE FROM works').run()
      sqlite.prepare(`
        UPDATE watermark_profiles SET status = 'RETIRED' WHERE id = ?
      `).run(active.id)
      sqlite.prepare(`
        UPDATE site_branding
        SET active_watermark_profile_id = NULL,
            draft_watermark_profile_id = NULL,
            version = version + 1
        WHERE id = 'site'
      `).run()
    })()

    const started = startWatermarkRefresh(
      sqlite,
      requireSiteBranding(sqlite).version,
      {
        sourceAssetId: active.sourceAssetId,
        opacityPercent: 58,
        scalePercent: 60,
      },
      NOW + 1_000,
    )
    const completed = await runWatermarkProfileApplication(
      sqlite,
      storage,
      started.operationId,
      NOW + 2_000,
    )
    expect(completed).toMatchObject({
      status: 'DONE',
      affectedWorkCount: 0,
      targetVariantCount: 0,
      generatedVariantCount: 0,
      verifiedVariantCount: 0,
    })
    expect(requireSiteBranding(sqlite)).toMatchObject({
      activeWatermarkProfileId: completed.profileId,
      draftWatermarkProfileId: null,
    })
    expect(sqlite.prepare(`
      SELECT count(*) FROM watermark_operations
      WHERE operation_type = 'WATERMARK_PREVIEW'
    `).pluck().get()).toBe(0)
  })

  it('starts an existing-site refresh directly without a verified preview', () => {
    const active = requireWatermarkProfile(sqlite, seededProfileId)
    const started = startWatermarkRefresh(
      sqlite,
      requireSiteBranding(sqlite).version,
      {
        sourceAssetId: active.sourceAssetId,
        opacityPercent: 59,
        scalePercent: 60,
      },
      NOW + 1_000,
    )
    expect(started).toMatchObject({
      operationType: 'WATERMARK_REBUILD',
      status: 'GENERATING_PUBLIC',
    })
    expect(sqlite.prepare(`
      SELECT count(*) FROM watermark_operations
      WHERE operation_type = 'WATERMARK_PREVIEW'
        AND profile_id = ?
    `).pluck().get(started.profileId)).toBe(0)
  })

  it('previews artwork targets, atomically switches every protected variant, and cleans old objects', async () => {
    const oldKeys = await generateActiveVariants()
    const { draft, preview } = await createPreviewedDraft()

    expect(preview).toMatchObject({
      status: 'DONE',
      targetVariantCount: 3,
      generatedVariantCount: 3,
      verifiedVariantCount: 3,
    })
    // T34-F1：站点大图不打水印，预览只覆盖作品保护展示位。
    expect(preview.previews.map(item => item.kind)).toEqual([
      'work-card',
      'detail',
      'design-sheet',
    ])
    expect(JSON.stringify(preview)).not.toContain('/preview/branding/')

    const applied = await applyDraft(draft.id, draft.version)
    expect(applied).toMatchObject({
      status: 'DONE',
      affectedWorkCount: 1,
      affectedHeroSlideCount: 0,
      targetVariantCount: 12,
      generatedVariantCount: 12,
      verifiedVariantCount: 12,
      cleanupPendingCount: 0,
    })
    expect(requireSiteBranding(sqlite)).toMatchObject({
      activeWatermarkProfileId: draft.id,
      draftWatermarkProfileId: null,
    })
    expect(requireWatermarkProfile(sqlite, seededProfileId).status).toBe('RETIRED')
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE storage_scope = 'PUBLIC' AND watermark_profile_id = ?
    `).pluck().get(draft.id)).toBe(12)
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE storage_scope = 'PUBLIC' AND watermark_profile_id = ?
    `).pluck().get(seededProfileId)).toBe(0)
    expect(storage.deletedPublicKeys).toEqual(expect.arrayContaining(oldKeys))
    expect(storage.deletedPrivateKeys).toHaveLength(3)

    await expect(applyWatermarkProfile(
      sqlite,
      storage,
      draft.id,
      0,
      0,
      NOW + 4_000,
    )).resolves.toEqual(applied)
  })

  it('includes published design-sheet usages in the atomic profile switch', async () => {
    insertSource('adoption-design', 'design_sheet', 3200, 1800)
    sqlite.prepare(`
      INSERT INTO works (
        id, slug, character_name, species, suit_type, purpose,
        adoption_method, business_status, owner_display,
        publication_status, published_at, created_at, updated_at
      ) VALUES (
        'adoption-work', 'adoption-work', '待领养角色', '犬科', 'partial',
        'adoption', 'regular', 'available', '不公开',
        'published', ?, ?, ?
      )
    `).run(NOW, NOW, NOW)
    sqlite.prepare(`
      INSERT INTO work_assets (
        work_id, asset_id, role, alt_text, position, is_primary
      ) VALUES (
        'adoption-work', 'adoption-design', 'design_sheet',
        '待领养角色完整设定图', 0, 0
      )
    `).run()
    await generatePublicVariants(
      sqlite,
      storage,
      'adoption-design',
      ['design-sheet', 'work-card'],
      NOW,
    )
    const { draft } = await createPreviewedDraft(56)

    const applied = await applyDraft(draft.id, draft.version)
    expect(applied).toMatchObject({
      status: 'DONE',
      affectedWorkCount: 2,
      affectedHeroSlideCount: 0,
      targetVariantCount: 24,
      generatedVariantCount: 24,
      verifiedVariantCount: 24,
    })
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE asset_id = 'adoption-design'
        AND storage_scope = 'PUBLIC' AND status = 'READY'
        AND watermark_profile_id = ?
        AND watermark_profile = 'brand-centered-v2'
        AND watermark_anchor = 'center'
    `).pluck().get(draft.id)).toBe(12)
  })

  it('persists an application operation before rebuilding public variants', async () => {
    const { draft } = await createPreviewedDraft()
    const started = startWatermarkProfileApplication(
      sqlite,
      draft.id,
      draft.version,
      requireSiteBranding(sqlite).version,
      NOW + 3_000,
    )

    expect(started).toMatchObject({
      operationType: 'WATERMARK_REBUILD',
      status: 'GENERATING_PUBLIC',
      targetVariantCount: 0,
    })
    expect(getWatermarkOperation(sqlite, started.operationId).status)
      .toBe('GENERATING_PUBLIC')

    const completed = await runWatermarkProfileApplication(
      sqlite,
      storage,
      started.operationId,
      NOW + 3_000,
    )
    expect(completed).toMatchObject({
      status: 'DONE',
      generatedVariantCount: 12,
      verifiedVariantCount: 12,
    })
  })

  it('previews artwork ratios before homepage hero assets exist', async () => {
    sqlite.prepare('DELETE FROM site_hero_slides').run()
    sqlite.prepare(`
      DELETE FROM assets
      WHERE role IN ('home_hero_landscape', 'home_hero_portrait')
    `).run()

    const { preview } = await createPreviewedDraft()

    expect(preview).toMatchObject({
      status: 'DONE',
      targetVariantCount: 3,
      generatedVariantCount: 3,
      verifiedVariantCount: 3,
    })
    expect(preview.previews.map(item => item.kind)).toEqual([
      'work-card',
      'detail',
      'design-sheet',
    ])
  })

  it('records a retryable failure instead of leaving a preview active', async () => {
    sqlite.prepare('DELETE FROM site_hero_slides').run()
    sqlite.prepare('DELETE FROM work_assets').run()
    sqlite.prepare(`
      DELETE FROM assets WHERE role != 'watermark_logo'
    `).run()

    const branding = requireSiteBranding(sqlite)
    const active = requireWatermarkProfile(sqlite, seededProfileId)
    const draft = createWatermarkProfile(sqlite, branding.version, {
      sourceAssetId: active.sourceAssetId,
      opacityPercent: 55,
      scalePercent: 60,
    }, NOW + 1_000)
    const failed = await createWatermarkPreview(
      sqlite,
      storage,
      draft.id,
      draft.version,
      requireSiteBranding(sqlite).version,
      NOW + 2_000,
    )

    expect(failed).toMatchObject({
      status: 'FAILED',
      failureCode: 'WATERMARK_PREVIEW_FAILED',
    })
  })

  it('keeps the old active profile and public objects when regeneration fails', async () => {
    const oldKeys = await generateActiveVariants()
    const { draft } = await createPreviewedDraft()
    storage.failProcess = true

    const failed = await applyDraft(draft.id, draft.version)
    expect(failed).toMatchObject({
      status: 'FAILED',
      failureCode: 'WATERMARK_REBUILD_FAILED',
    })
    expect(requireSiteBranding(sqlite).activeWatermarkProfileId).toBe(
      seededProfileId,
    )
    expect(requireWatermarkProfile(sqlite, draft.id).status).toBe('FAILED')
    expect(oldKeys.every(key => storage.publicObjects.has(key))).toBe(true)
  })

  /**
   * T34-F5：lease 不授予终态记录，因此重试必须先把 FAILED 重新打开。
   * 少了这一步，runner 会静默什么都不做，操作永远停在失败态。
   */
  it('retries a generation failure and activates the new profile', async () => {
    await generateActiveVariants()
    const { draft } = await createPreviewedDraft(61)
    storage.failProcess = true

    const failed = await applyDraft(draft.id, draft.version)
    expect(failed).toMatchObject({
      status: 'FAILED',
      failureCode: 'WATERMARK_REBUILD_FAILED',
    })
    expect(requireSiteBranding(sqlite).activeWatermarkProfileId)
      .toBe(seededProfileId)

    storage.failProcess = false
    const retried = await retryWatermarkOperation(
      sqlite,
      storage,
      failed.operationId,
      failed.version,
      NOW + 5_000,
    )

    // 重试真的推进了 runner，而不是静默返回原失败态。
    expect(retried).toMatchObject({ status: 'DONE', cleanupPendingCount: 0 })
    expect(retried.generatedVariantCount).toBeGreaterThan(0)
    expect(requireSiteBranding(sqlite).activeWatermarkProfileId).toBe(draft.id)
    expect(requireWatermarkProfile(sqlite, draft.id).status).toBe('ACTIVE')
  })

  it('keeps the new profile active and retries an exact cleanup failure', async () => {
    const oldKeys = await generateActiveVariants()
    const { draft } = await createPreviewedDraft(56)
    storage.failDelete = true

    const failed = await applyDraft(draft.id, draft.version)
    expect(failed).toMatchObject({
      status: 'FAILED',
      failureCode: 'WATERMARK_CLEANUP_FAILED',
    })
    expect(requireSiteBranding(sqlite).activeWatermarkProfileId).toBe(draft.id)

    storage.failDelete = false
    const retried = await retryWatermarkOperation(
      sqlite,
      storage,
      failed.operationId,
      failed.version,
      NOW + 4_000,
    )
    expect(retried).toMatchObject({ status: 'DONE', cleanupPendingCount: 0 })
    expect(oldKeys.every(key => !storage.publicObjects.has(key))).toBe(true)
  })
})
