import {
  createHash,
  randomUUID,
} from 'node:crypto'
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
import {
  createSqlitePublicSiteRepository,
} from '../../server/utils/repository/public-site-repository'
import {
  createManagedWork,
  replaceManagedAdoptionCover,
  replaceManagedDesignSheet,
  replaceManagedStudioPhotos,
  updateManagedWorkPresentation,
} from '../../server/utils/service/work-management'
import { publishWork } from '../../server/utils/runner/work-publication'
import { FakeMediaStorage } from '../helpers/fake-media-storage'
import { insertActiveWatermarkProfile } from '../helpers/watermark-fixture'
import { setPublicMediaCacheForTests } from '../../server/utils/public-media-cache'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NOW = Date.UTC(2026, 7, 2)
const MEDIA_BASE_URL = 'https://media.example.test'

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage
let sequence = 1

function digest(content: Buffer) {
  return createHash('sha256').update(content).digest('hex')
}

function insertUser() {
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
}

function insertCompletedUpload(
  ownerId: string,
  ownerVersion: number,
  assetId: string,
  role: 'adoption_cover' | 'design_sheet' | 'studio_photo',
  key: string,
  content: Buffer,
  width: number,
  height: number,
) {
  sqlite.prepare(`
    INSERT INTO upload_sessions (
      id, owner_type, owner_id, owner_version, media_role,
      private_object_key, expected_content_type, expected_bytes,
      expected_content_md5, expected_sha256, expected_width,
      expected_height, created_by, status, asset_id, version,
      created_at, expires_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'image/png', ?, ?, ?, ?, ?, ?,
              'COMPLETED', ?, 3, ?, ?, ?)
  `).run(
    randomUUID(),
    role.startsWith('home_hero_') ? 'site' : 'work',
    ownerId,
    ownerVersion,
    role,
    key,
    content.length,
    createHash('md5').update(content).digest('base64'),
    digest(content),
    width,
    height,
    USER_ID,
    assetId,
    NOW,
    NOW + 300_000,
    NOW + 1_000,
  )
}

async function createPublishedWork(input: {
  featured: boolean
  purpose?: 'adoption' | 'commission' | 'showcase'
  slug: string
  sortOrder: number
}) {
  const common = {
    slug: input.slug,
    characterName: input.slug === 'first-work' ? '团子' : '雪球',
    species: '犬科',
    sortOrder: input.sortOrder,
    featured: false,
  } as const
  const work = createManagedWork(sqlite, input.purpose === 'adoption'
    ? {
        ...common,
        purpose: 'adoption',
        adoptionStatus: 'available',
        priceCnyMinor: 100,
      }
    : {
        ...common,
        purpose: input.purpose ?? 'showcase',
      }, NOW + sequence++)
  const assetId = randomUUID()
  const content = createSyntheticWatermarkPng()
  const key = `test/t19/original/${assetId}/source.png`
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, 'studio_photo', 'READY', ?, ?, ?,
              'image/png', 2400, 3200, ?, ?)
  `).run(assetId, key, digest(content), content.length, NOW, NOW)
  insertCompletedUpload(work.id, work.version, assetId, 'studio_photo', key, content, 2400, 3200)
  storage.seedPrivate(key, content, 'image/png', digest(content), {
    fileSize: content.length,
    format: 'png',
    height: 3200,
    orientation: 1,
    width: 2400,
  })
  let adoptionCoverAssetId: string | null = null
  let designAssetId: string | null = null
  if (input.purpose === 'adoption') {
    adoptionCoverAssetId = randomUUID()
    const coverKey = `test/t19/original/${adoptionCoverAssetId}/cover.png`
    sqlite.prepare(`
      INSERT INTO assets (
        id, role, status, private_object_key, sha256, byte_size,
        mime_type, width, height, created_at, updated_at
      ) VALUES (?, 'adoption_cover', 'READY', ?, ?, ?,
                'image/png', 3200, 1800, ?, ?)
    `).run(adoptionCoverAssetId, coverKey, digest(content), content.length, NOW, NOW)
    insertCompletedUpload(
      work.id,
      work.version,
      adoptionCoverAssetId,
      'adoption_cover',
      coverKey,
      content,
      3200,
      1800,
    )
    storage.seedPrivate(coverKey, content, 'image/png', digest(content), {
      fileSize: content.length,
      format: 'png',
      height: 1800,
      orientation: 1,
      width: 3200,
    })
    designAssetId = randomUUID()
    const designKey = `test/t19/original/${designAssetId}/design.png`
    sqlite.prepare(`
      INSERT INTO assets (
        id, role, status, private_object_key, sha256, byte_size,
        mime_type, width, height, created_at, updated_at
      ) VALUES (?, 'design_sheet', 'READY', ?, ?, ?,
                'image/png', 3200, 1800, ?, ?)
    `).run(designAssetId, designKey, digest(content), content.length, NOW, NOW)
    insertCompletedUpload(
      work.id,
      work.version,
      designAssetId,
      'design_sheet',
      designKey,
      content,
      3200,
      1800,
    )
    storage.seedPrivate(designKey, content, 'image/png', digest(content), {
      fileSize: content.length,
      format: 'png',
      height: 1800,
      orientation: 1,
      width: 3200,
    })
  }
  let current = replaceManagedStudioPhotos(sqlite, work.id, work.version, [{
    assetId,
    alt: `${work.characterName}出厂照`,
    primary: true,
    focalX: 0.5,
    focalY: 0.5,
    crop: { x: 0, y: 0, width: 1, height: 1 },
  }], NOW + sequence++)
  if (adoptionCoverAssetId) {
    current = replaceManagedAdoptionCover(
      sqlite,
      work.id,
      current.version,
      {
        assetId: adoptionCoverAssetId,
        alt: `${work.characterName}领养横版封面`,
        focalX: 0.5,
        focalY: 0.5,
        crop: { x: 0, y: 0, width: 1, height: 1 },
      },
      NOW + sequence++,
    )
  }
  if (designAssetId) {
    current = replaceManagedDesignSheet(sqlite, work.id, current.version, {
      assetId: designAssetId,
      alt: `${work.characterName}完整设定图`,
    }, NOW + sequence++)
  }
  if (input.featured) {
    current = updateManagedWorkPresentation(
      sqlite,
      work.id,
      current.version,
      { featured: true },
      NOW + sequence++,
    )
  }
  const published = await publishWork(
    sqlite,
    storage,
    work.id,
    current.version,
    USER_ID,
    NOW + sequence++,
  )
  expect(
    published.work.publicationStatus,
    JSON.stringify(published.operation),
  ).toBe('published')
  return {
    adoptionCoverAssetId,
    assetId,
    assetSha256: digest(content),
    designAssetId,
    workId: work.id,
  }
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-public-site-'))
  const databaseFile = resolve(directory, 'public-site.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
  sequence = 1
  insertUser()
  insertActiveWatermarkProfile(sqlite, NOW, {
    environmentPrefix: 'test/t19-t20',
  })
})

afterEach(() => {
  setPublicMediaCacheForTests()
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('T19/T20 public repository contracts', () => {
  it('returns current-profile published works in manual, filtered and featured order', async () => {
    const second = await createPublishedWork({
      slug: 'second-work',
      sortOrder: 20,
      featured: true,
    })
    const first = await createPublishedWork({
      slug: 'first-work',
      sortOrder: 10,
      featured: true,
    })
    const draft = createManagedWork(sqlite, {
      slug: 'draft-work',
      characterName: '草稿',
      species: '犬科',
      purpose: 'showcase',
      sortOrder: 0,
      featured: false,
    }, NOW + sequence++)
    sqlite.prepare(`
      INSERT INTO asset_variants (
        id, asset_id, storage_scope, status, object_key, input_sha256,
        media_role, usage, width, height, format, quality, crop_identity,
        recipe_version, protection_mode, watermark_profile,
        watermark_config_digest, logo_digest, watermark_anchor,
        sha256, byte_size, created_at, updated_at
      ) VALUES (?, ?, 'PUBLIC', 'READY', ?, ?, 'studio_photo', 'work-card',
                480, 640, 'jpeg', 86, 'legacy', 'recipe-v1', 'watermark',
                'brand-standard-v1', 'none', ?, 'top-left', ?, 10, ?, ?)
    `).run(
      randomUUID(),
      first.assetId,
      'test/t19/web/legacy-retired-field-marker.jpg',
      first.assetSha256,
      'b'.repeat(64),
      'c'.repeat(64),
      NOW,
      NOW,
    )

    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    const list = repository.listWorks()
    expect(list.items.map(item => item.work.slug)).toEqual([
      'first-work',
      'second-work',
    ])
    expect(list.resultCount).toBe(2)
    expect(repository.listWorks({ suitType: 'retired' }).items)
      .toHaveLength(2)
    expect(repository.listWorks({ q: '  团子  ' }).items.map(item => item.work.slug))
      .toEqual(['first-work'])
    expect(repository.listWorks({ q: ['团子'] })).toMatchObject({
      items: [],
      resultCount: 0,
    })
    expect(repository.listWorks({ purpose: 'retired' }).resultCount).toBe(2)
    expect(repository.listFeaturedWorks().items.map(item => item.work.slug))
      .toEqual(['second-work', 'first-work'])
    expect(repository.getWorkBySlug(draft.slug)).toBeNull()

    const detail = repository.getWorkBySlug('first-work')!
    expect(detail.media.card.sources.webp.map(item => item.width)).toEqual([
      480,
      768,
      1200,
    ])
    expect(detail.media.gallery[0]?.sources.webp.map(item => item.width)).toEqual([
      960,
      1600,
      2400,
    ])
    // FU-15/FU-19：详情不再提供上一件/下一件导航，也不再提供「继续浏览」。
    expect(detail).not.toHaveProperty('navigation')
    expect(detail).not.toHaveProperty('related')
    const visible = JSON.stringify(detail)
    expect(visible).not.toContain('legacy-retired-field-marker')
    expect(visible).not.toContain('/original/')
    expect(visible).not.toContain('watermarkProfile')
    expect(visible).not.toContain('variantId')
    expect(visible).toContain(MEDIA_BASE_URL)
    expect(second.workId).not.toBe(first.workId)

    expect(repository.listFeaturedWorks().items.map(item => item.work.slug))
      .toEqual([
        'second-work',
        'first-work',
      ])
    expect(repository.listFeaturedWorks().resultCount).toBe(2)

    await createPublishedWork({
      slug: 'published-after-first-read',
      sortOrder: 3,
      featured: false,
    })
    expect(repository.listWorks().items.map(item => item.work.slug))
      .toContain('published-after-first-read')
    sqlite.prepare(`
      UPDATE works SET publication_status = 'unpublished' WHERE id = ?
    `).run(second.workId)
    expect(repository.getWorkBySlug('second-work')).toBeNull()
    expect(repository.listWorks().items.map(item => item.work.slug))
      .not.toContain('second-work')
  })

  it('uses one complete recipe-v2 source set while recipe-v3 is incomplete', async () => {
    const legacy = await createPublishedWork({
      slug: 'legacy-recipe-work',
      sortOrder: 0,
      featured: false,
    })
    sqlite.prepare(`
      INSERT INTO asset_variants (
        id, asset_id, source_variant_id, storage_scope, status, object_key,
        input_sha256, media_role, usage, width, height, format, quality,
        crop_identity, recipe_version, protection_mode, watermark_profile,
        watermark_profile_id, watermark_config_digest, logo_digest,
        watermark_anchor, watermark_opacity_percent, watermark_scale_percent,
        sha256, byte_size, version, internal_error_code, created_at, updated_at
      )
      SELECT
        lower(hex(randomblob(16))), asset_id, source_variant_id, storage_scope,
        status, replace(object_key, '/recipe-v3/', '/recipe-v2/'), input_sha256,
        media_role, usage, width, height, format, quality, crop_identity,
        'recipe-v2', protection_mode, watermark_profile, watermark_profile_id,
        watermark_config_digest, logo_digest, watermark_anchor,
        watermark_opacity_percent, watermark_scale_percent, sha256, byte_size,
        version, internal_error_code, created_at, updated_at
      FROM asset_variants
      WHERE asset_id = ? AND recipe_version = 'recipe-v3'
    `).run(legacy.assetId)
    sqlite.prepare(`
      UPDATE asset_variants
      SET status = 'FAILED'
      WHERE asset_id = ? AND recipe_version = 'recipe-v3'
        AND id != (
          SELECT id FROM asset_variants
          WHERE asset_id = ? AND recipe_version = 'recipe-v3'
          ORDER BY usage, width, format
          LIMIT 1
        )
    `).run(legacy.assetId, legacy.assetId)

    const detail = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
      .getWorkBySlug('legacy-recipe-work')!
    const urls = [
      ...detail.media.card.sources.webp,
      ...detail.media.card.sources.fallback,
      ...detail.media.gallery.flatMap(item => [
        ...item.sources.webp,
        ...item.sources.fallback,
      ]),
    ].map(item => item.src)
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.every(url => url.includes('/recipe-v2/'))).toBe(true)
    expect(urls.some(url => url.includes('/recipe-v3/'))).toBe(false)
  })

  it('projects all three published purposes without private fields', async () => {
    const emptyRepository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    expect(emptyRepository.listFeaturedWorks()).toEqual({
      items: [],
      resultCount: 0,
    })
    await createPublishedWork({
      slug: 'commission-purpose',
      sortOrder: 1,
      featured: false,
      purpose: 'commission',
    })
    await createPublishedWork({
      slug: 'adoption-purpose',
      sortOrder: 2,
      featured: false,
      purpose: 'adoption',
    })
    await createPublishedWork({
      slug: 'showcase-purpose',
      sortOrder: 3,
      featured: false,
      purpose: 'showcase',
    })

    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    // T35-F5：公开列表按发布时间倒序，越新的越靠前。
    // 三件作品按 commission → adoption → showcase 顺序发布，因此这里反序。
    expect(repository.listWorks().items.map(item => item.work.slug)).toEqual([
      'showcase-purpose',
      'adoption-purpose',
      'commission-purpose',
    ])
    // 领养详情带状态与价格（与 /adoptions 卡片同源）；其它用途没有这两个字段。
    expect(repository.getWorkBySlug('adoption-purpose')?.work).toEqual({
      id: expect.any(String),
      slug: 'adoption-purpose',
      characterName: '雪球',
      species: '犬科',
      adoptionStatus: 'available',
      price: { currency: 'CNY', minorUnits: 100 },
    })
    expect(repository.getWorkBySlug('commission-purpose')?.work).toEqual({
      id: expect.any(String),
      slug: 'commission-purpose',
      characterName: '雪球',
      species: '犬科',
    })
    const adoptionList = repository.listAdoptions()
    expect(adoptionList).toMatchObject({
      resultCount: 1,
      items: [{
        work: {
          slug: 'adoption-purpose',
          adoptionStatus: 'available',
          price: { currency: 'CNY', minorUnits: 100 },
        },
        href: '/works/adoption-purpose',
      }],
    })
    expect(adoptionList.items[0]?.cover.sources.webp.map(item => item.width))
      .toEqual([768, 1200, 1600])
    expect(repository.listAdoptions({ q: '雪球' })).toMatchObject({
      items: [{ work: { slug: 'adoption-purpose' } }],
      resultCount: 1,
    })
    expect(repository.listAdoptions({ q: { invalid: true } })).toMatchObject({
      items: [],
      resultCount: 0,
      filter: { valid: false },
    })
    const adoptionDetail = repository.getWorkBySlug('adoption-purpose')
    expect(adoptionDetail?.media.designSheet?.assetId)
      .toBeTruthy()
    expect(adoptionDetail?.media.primaryAssetId)
      .toBe(adoptionDetail?.media.gallery[0]?.assetId)
    expect(adoptionDetail?.media.primaryAssetId)
      .not.toBe(adoptionDetail?.media.designSheet?.assetId)
    expect(adoptionDetail?.media.gallery).toHaveLength(1)

    expect(repository.getWorkBySlug('commission-purpose')?.media)
      .not.toHaveProperty('designSheet')
    expect(repository.getWorkBySlug('showcase-purpose')?.media)
      .not.toHaveProperty('designSheet')
    const serialized = JSON.stringify({
      adoptions: adoptionList,
      detail: adoptionDetail,
      works: repository.listWorks(),
    })
    expect(serialized).not.toContain('/original/')
    expect(serialized).not.toContain('ownerContact')
    expect(serialized).not.toContain('privateObjectKey')
  })

  it('keeps the optional design sheet separate from the adoption cover and studio primary', async () => {
    const created = await createPublishedWork({
      slug: 'three-media-adoption',
      sortOrder: 1,
      featured: false,
      purpose: 'adoption',
    })
    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    const listItem = repository.listAdoptions().items[0]
    const detail = repository.getWorkBySlug('three-media-adoption')

    expect(listItem?.cover.assetId).toBe(created.adoptionCoverAssetId)
    expect(detail?.media.primaryAssetId).toBe(created.assetId)
    expect(detail?.media.card.assetId).toBe(created.assetId)
    expect(detail?.media.designSheet?.assetId).toBe(created.designAssetId)
    expect(repository.listWorks().items).toHaveLength(1)
  })

})
