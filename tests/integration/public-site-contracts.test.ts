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
  vi,
} from 'vitest'
import { createSyntheticWatermarkPng } from '../../scripts/oss-preflight-core.mjs'
import { createHeroSlideRequestSchema } from '../../shared/schemas/home'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import {
  createHeroSlide,
  createHeroSlidePreview,
  deleteHeroSlide,
  disableHeroSlide,
  getAdminHome,
  getPublicCommissionHero,
  getPublicHome,
  reorderEnabledHeroSlides,
  retryHeroSlideUpscale,
  retryHeroSlidePublication,
  runHeroSlideUpscale,
  runHeroSlidePublication,
  startHeroSlideUpscale,
  startHeroSlidePublication,
  updateHeroSlide,
  updateHomeSettings,
} from '../../server/utils/runner/home-management'
import {
  runHeroCollectionItemPublication,
  runHeroCollectionItemUnpublication,
  startHeroCollectionItemPublication,
  startHeroCollectionItemUnpublication,
} from '../../server/utils/runner/hero-collection-publication'
import {
  createHeroCollectionItem,
  getAdminHeroCollection,
} from '../../server/utils/service/hero-collection-management'
import {
  createFakePublicSiteRepository,
  createSqlitePublicSiteRepository,
} from '../../server/utils/repository/public-site-repository'
import {
  createManagedWork,
  replaceManagedAdoptionCover,
  replaceManagedDesignSheet,
  replaceManagedStudioPhotos,
} from '../../server/utils/service/work-management'
import { publishWork, unpublishWork } from '../../server/utils/runner/work-publication'
import { FakeMediaStorage } from '../helpers/fake-media-storage'
import { FakePublicMediaCache } from '../helpers/fake-public-media-cache'
import { insertActiveWatermarkProfile } from '../helpers/watermark-fixture'
import { setPublicMediaCacheForTests } from '../../server/utils/public-media-cache'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NOW = Date.UTC(2026, 7, 2)
const MEDIA_BASE_URL = 'https://media.example.test'

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage
let sequence = 1

function capturePreparedQueries<T>(action: () => T) {
  const queries: string[] = []
  const prepare = sqlite.prepare.bind(sqlite)
  const spy = vi.spyOn(sqlite, 'prepare').mockImplementation(((source: string) => {
    queries.push(source)
    return prepare(source)
  }) as typeof sqlite.prepare)
  try {
    return { queries, result: action() }
  }
  finally {
    spy.mockRestore()
  }
}

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
  role: 'adoption_cover' | 'design_sheet' | 'studio_photo' | 'home_hero_landscape' | 'home_hero_portrait',
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
    featured: input.featured,
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
              'image/png', 3200, 2400, ?, ?)
  `).run(assetId, key, digest(content), content.length, NOW, NOW)
  insertCompletedUpload(work.id, work.version, assetId, 'studio_photo', key, content, 3200, 2400)
  storage.seedPrivate(key, content, 'image/png', digest(content), {
    fileSize: content.length,
    format: 'png',
    height: 2400,
    orientation: 1,
    width: 3200,
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
  const published = await publishWork(
    sqlite,
    storage,
    work.id,
    current.version,
    USER_ID,
    NOW + sequence++,
  )
  expect(published.work.publicationStatus).toBe('published')
  return {
    adoptionCoverAssetId,
    assetId,
    assetSha256: digest(content),
    designAssetId,
    workId: work.id,
  }
}

function createHeroAsset(
  role: 'home_hero_landscape' | 'home_hero_portrait',
  ownerVersion: number,
  dimensions?: { height: number, width: number },
  environmentPrefix = 'test/t20',
  placement: 'commission' | 'home' = 'home',
) {
  const assetId = randomUUID()
  const content = createSyntheticWatermarkPng()
  const landscape = role === 'home_hero_landscape'
  const width = dimensions?.width ?? (landscape ? 4000 : 1800)
  const height = dimensions?.height ?? (landscape ? 2250 : 3200)
  const key = `${environmentPrefix}/original/${assetId}/source.png`
  const orientation = landscape ? 'landscape' : 'portrait'
  const uploadOwnerVersion = sqlite.prepare(`
    SELECT version FROM site_hero_collections
    WHERE placement = ? AND orientation = ?
  `).pluck().get(placement, orientation) as number
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, ?, 'READY', ?, ?, ?, 'image/png', ?, ?, ?, ?)
  `).run(assetId, role, key, digest(content), content.length, width, height, NOW, NOW)
  insertCompletedUpload(
    `hero-${placement}-${orientation}`,
    uploadOwnerVersion,
    assetId,
    role,
    key,
    content,
    width,
    height,
  )
  storage.seedPrivate(key, content, 'image/png', digest(content), {
    fileSize: content.length,
    format: 'png',
    height,
    orientation: 1,
    width,
  })
  return assetId
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
  it('hides a hero slide before its exact ESA files finish revoking', async () => {
    let collection = getAdminHeroCollection(sqlite, 'home', 'landscape')
    const createEnabledItem = async (alt: string, sortOrder: number) => {
      const assetId = createHeroAsset(
        'home_hero_landscape',
        collection.version,
        undefined,
        'prod',
      )
      collection = createHeroCollectionItem(
        sqlite,
        'home',
        'landscape',
        collection.version,
        {
        alt,
        assetId,
        sortOrder,
        },
        NOW + sequence++,
      )
      const item = collection.items.find(candidate => candidate.alt === alt)!
      const operation = startHeroCollectionItemPublication(
        sqlite,
        item.id,
        'home',
        'landscape',
        collection.version,
        NOW + sequence++,
      )
      await runHeroCollectionItemPublication(
        sqlite,
        storage,
        operation.operationId,
        USER_ID,
        NOW + sequence++,
      )
      collection = getAdminHeroCollection(sqlite, 'home', 'landscape')
      return item
    }

    const removable = await createEnabledItem('待撤销首页图', 0)
    await createEnabledItem('保留首页图', 1)
    const variantRows = sqlite.prepare(`
      SELECT id, object_key AS objectKey FROM asset_variants
      WHERE asset_id IN (?, ?) AND storage_scope = 'PUBLIC'
      ORDER BY id
    `).all(
      removable.asset.assetId,
      removable.asset.assetId,
    ) as { id: string, objectKey: string }[]
    expect(variantRows.every(row => row.objectKey.startsWith('prod/web/')))
      .toBe(true)

    const cache = new FakePublicMediaCache()
    let finishDescribe: ((status: 'Complete') => void) | undefined
    cache.describeExactFilePurge = vi.fn(async () => await new Promise<'Complete'>((resolve) => {
      finishDescribe = resolve
    }))
    setPublicMediaCacheForTests(cache)
    const unpublication = startHeroCollectionItemUnpublication(
      sqlite,
      removable.id,
      'home',
      'landscape',
      collection.version,
      NOW + sequence++,
    )
    const running = runHeroCollectionItemUnpublication(
      sqlite,
      storage,
      unpublication.operationId,
      USER_ID,
      NOW + sequence++,
    )
    await vi.waitFor(() => {
      expect(cache.submittedUrls).toHaveLength(1)
    })

    expect(getPublicHome(sqlite, MEDIA_BASE_URL).landscape.map(item => item.alt))
      .toEqual(['保留首页图'])
    expect(sqlite.prepare(`
      SELECT status, edge_purge_status AS edgePurgeStatus
      FROM publication_operations WHERE id = ?
    `).get(unpublication.operationId)).toEqual({
      edgePurgeStatus: 'PURGING',
      status: 'CLEANING_PUBLIC',
    })
    expect(cache.submittedUrls[0]).toHaveLength(variantRows.length)
    expect([...cache.submittedUrls[0]!].sort()).toEqual(variantRows.map(row => (
      `https://public-media.ditedog.com/${row.objectKey}`
    )).sort())

    finishDescribe?.('Complete')
    await expect(running).resolves.toMatchObject({
      edgePurgeStatus: 'COMPLETE',
      status: 'DONE',
    })
  })

  it('saves low-resolution hero sources but requires confirmed private upscale before enabling', async () => {
    const initial = getAdminHome(sqlite)
    const landscape = createHeroAsset(
      'home_hero_landscape',
      initial.version,
      { width: 320, height: 180 },
    )
    const portrait = createHeroAsset(
      'home_hero_portrait',
      initial.version,
      { width: 180, height: 320 },
    )

    const created = createHeroSlide(sqlite, initial.version, {
      alt: '尺寸不足的首页图',
      sortOrder: 0,
      landscapeAssetId: landscape,
      portraitAssetId: portrait,
      linkedWorkId: null,
    })
    const slide = created.slides[0]!

    expect(() => startHeroSlidePublication(
      sqlite,
      slide.id,
      created.version,
      NOW + sequence++,
    )).toThrow(/confirmed upscale/u)

    const upscale = startHeroSlideUpscale(
      sqlite,
      slide.id,
      created.version,
      NOW + sequence++,
    )
    expect(upscale).toMatchObject({
      operationType: 'UPSCALE',
      status: 'PREPARING_SOURCE',
    })
    storage.failGet = true
    await runHeroSlideUpscale(
      sqlite,
      storage,
      upscale.operationId,
      USER_ID,
      NOW + sequence++,
    )
    const failed = getAdminHome(sqlite).slides[0]?.upscaleOperation
    expect(failed).toMatchObject({
      operationType: 'UPSCALE',
      status: 'FAILED',
      failureStage: 'PREPARING_SOURCE',
      failureCode: 'HERO_UPSCALE_FAILED',
    })
    storage.failGet = false
    const retried = retryHeroSlideUpscale(
      sqlite,
      upscale.operationId,
      failed!.version,
      NOW + sequence++,
    )
    await runHeroSlideUpscale(
      sqlite,
      storage,
      retried.operationId,
      USER_ID,
      NOW + sequence++,
    )
    expect(getAdminHome(sqlite).slides[0]).toMatchObject({
      upscaleReady: true,
      upscaleOperation: {
        operationType: 'UPSCALE',
        status: 'DONE',
      },
    })
    expect(storage.privatePuts).toHaveLength(2)
    for (const put of storage.privatePuts) {
      expect(put.contentMd5).toBe(
        createHash('md5').update(put.content).digest('base64'),
      )
    }
    const preprocess = sqlite.prepare(`
      SELECT
        source_variant_id AS sourceVariantId, storage_scope AS storageScope,
        usage, width, height, recipe_version AS recipeVersion,
        input_sha256 AS inputSha256, sha256, object_key AS objectKey
      FROM asset_variants
      WHERE asset_id = ? AND usage = 'preprocess'
    `).get(landscape) as Record<string, unknown>
    expect(preprocess).toMatchObject({
      sourceVariantId: null,
      storageScope: 'PRIVATE',
      usage: 'preprocess',
      width: 3840,
      height: 2160,
      recipeVersion: 'hero-upscale-lanczos-v2',
    })
    expect(preprocess.inputSha256).not.toBe(preprocess.sha256)
    expect(String(preprocess.objectKey)).toContain('/hero-upscale-lanczos-v2/')

    const operation = startHeroSlidePublication(
      sqlite,
      slide.id,
      created.version,
      NOW + sequence++,
    )
    await runHeroSlidePublication(
      sqlite,
      storage,
      operation.operationId,
      USER_ID,
      NOW + sequence++,
    )
    expect(getAdminHome(sqlite).slides[0]?.enabled).toBe(true)
    expect(storage.processCalls.filter(call =>
      call.objectKey.includes('/home-hero-landscape/'),
    ).every(call => call.sourceObjectKey === preprocess.objectKey)).toBe(true)
    const originalKey = sqlite.prepare(`
      SELECT private_object_key FROM assets WHERE id = ?
    `).pluck().get(landscape) as string
    expect(storage.objects.has(originalKey)).toBe(true)
  })

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

    const fake = createFakePublicSiteRepository({
      details: [detail, repository.getWorkBySlug('second-work')!],
      featuredSlugs: ['second-work'],
      home: {
        tagline: '不只做小狗毛',
        contactEmail: 'studio@example.test',
        contactQq: '123456789',
        autoRotate: false,
        autoRotateIntervalMs: 6000,
        landscape: [],
        portrait: [],
      },
    })
    expect(fake.listFeaturedWorks().items[0]?.work.slug).toBe('second-work')
    expect(fake.listWorks({ suitType: 'retired' }).resultCount).toBe(2)

    const pagedDetails = Array.from({ length: 13 }, (_, index) => {
      const slug = `paged-work-${index + 1}`
      return {
        ...detail,
        work: {
          ...detail.work,
          id: randomUUID(),
          slug,
          characterName: `分页作品 ${index + 1}`,
        },
        href: `/works/${slug}`,
      }
    })
    const pagedFake = createFakePublicSiteRepository({
      details: pagedDetails,
      featuredSlugs: [],
      home: {
        tagline: '不只做小狗毛',
        contactEmail: 'studio@example.test',
        contactQq: '123456789',
        autoRotate: false,
        autoRotateIntervalMs: 6000,
        landscape: [],
        portrait: [],
      },
    })
    expect(pagedFake.listWorks({ page: 2 })).toMatchObject({
      page: 2,
      pageCount: 2,
      pageSize: 12,
      resultCount: 13,
      items: [{ work: { slug: 'paged-work-13' } }],
    })
    expect(pagedFake.listWorks({ page: 'bad' }).page).toBe(1)
    expect(pagedFake.listWorks({ page: 3 })).toMatchObject({
      items: [],
      page: 3,
      pageCount: 2,
      resultCount: 13,
    })

    for (let index = 0; index < 11; index += 1) {
      await createPublishedWork({
        slug: `featured-extra-${index}`,
        sortOrder: 30 + index,
        featured: true,
      })
    }
    expect(repository.listFeaturedWorks().items.map(item => item.work.slug))
      .toEqual([
        'second-work',
        'first-work',
        'featured-extra-0',
        'featured-extra-1',
        'featured-extra-2',
        'featured-extra-3',
        'featured-extra-4',
        'featured-extra-5',
        'featured-extra-6',
        'featured-extra-7',
        'featured-extra-8',
        'featured-extra-9',
      ])
    expect(repository.listFeaturedWorks().resultCount).toBe(12)

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
    expect(repository.getWorkBySlug('adoption-purpose')?.work).toEqual({
      id: expect.any(String),
      slug: 'adoption-purpose',
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

    const pagedAdoptionItems = Array.from({ length: 9 }, (_, index) => {
      const slug = `paged-adoption-${index + 1}`
      return {
        ...adoptionList.items[0]!,
        work: {
          ...adoptionList.items[0]!.work,
          id: randomUUID(),
          slug,
          characterName: `分页领养 ${index + 1}`,
        },
        href: `/works/${slug}`,
      }
    })
    const pagedAdoptions = createFakePublicSiteRepository({
      adoptions: pagedAdoptionItems,
      details: [],
      featuredSlugs: [],
      home: {
        tagline: '不只做小狗毛',
        contactEmail: 'studio@example.test',
        contactQq: '123456789',
        autoRotate: false,
        autoRotateIntervalMs: 6000,
        landscape: [],
        portrait: [],
      },
    }).listAdoptions({ page: 2 })
    expect(pagedAdoptions).toMatchObject({
      page: 2,
      pageCount: 2,
      pageSize: 8,
      resultCount: 9,
      items: [{ work: { slug: 'paged-adoption-9' } }],
    })
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

  it('publishes complete hero pairs atomically and exposes only safe public fields', async () => {
    const linked = await createPublishedWork({
      slug: 'linked-work',
      sortOrder: 1,
      featured: false,
    })
    const initial = getAdminHome(sqlite)
    expect(initial).toMatchObject({
      version: expect.any(Number),
      tagline: '不只做小狗毛 | 只做海绵头',
      contactEmail: '765678159@qq.com',
      contactQq: '765678159',
      autoRotate: false,
      autoRotateIntervalMs: 6000,
    })
    expect(initial.version).toBeGreaterThan(0)
    const landscape = createHeroAsset('home_hero_landscape', initial.version)
    const portrait = createHeroAsset('home_hero_portrait', initial.version)
    const created = createHeroSlide(sqlite, initial.version, {
      alt: '团子横竖双源首页照片',
      sortOrder: 0,
      landscapeAssetId: landscape,
      portraitAssetId: portrait,
      linkedWorkId: linked.workId,
    }, NOW + sequence++)
    const slide = created.slides[0]!
    expect(slide).toMatchObject({ enabled: false, missingVariantCount: 16 })
    const publicObjectCount = storage.publicObjects.size
    const processCallCount = storage.processCalls.length
    const preview = await createHeroSlidePreview(
      sqlite,
      storage,
      slide.id,
      created.version,
      NOW + sequence++,
    )
    expect(preview).toMatchObject({
      landscape: { width: 768, height: 432 },
      portrait: { width: 480, height: 853 },
    })
    expect(preview.landscape.url).toBe(
      `/api/admin/v1/site/home/slides/${slide.id}/preview/landscape`,
    )
    expect(preview.portrait.url).toBe(
      `/api/admin/v1/site/home/slides/${slide.id}/preview/portrait`,
    )
    expect(preview.portrait.expiresAt).toBe(preview.landscape.expiresAt)
    const previewManifest = sqlite.prepare(`
      SELECT
        landscape_preview_object_key AS landscapeKey,
        portrait_preview_object_key AS portraitKey,
        preview_expires_at AS expiresAt
      FROM site_hero_slides WHERE id = ?
    `).get(slide.id) as {
      expiresAt: number
      landscapeKey: string
      portraitKey: string
    }
    expect(previewManifest).toMatchObject({ expiresAt: expect.any(Number) })
    expect(previewManifest.landscapeKey).toContain('/preview/home/')
    expect(previewManifest.portraitKey).toContain('/preview/home/')
    expect(storage.processCalls.slice(processCallCount)).toHaveLength(2)
    const previewCalls = storage.processCalls.slice(processCallCount)
    const landscapePreview = previewCalls.find(
      call => call.objectKey.endsWith('/landscape.webp'),
    )!
    const portraitPreview = previewCalls.find(
      call => call.objectKey.endsWith('/portrait.webp'),
    )!
    expect(landscapePreview.objectKey).toContain('/preview/home/')
    expect(landscapePreview.process.match(/\/watermark,/gu)).toHaveLength(2)
    expect(landscapePreview.process).toContain('g_west')
    expect(landscapePreview.process).toContain('g_east')
    expect(portraitPreview.objectKey).toContain('/preview/home/')
    expect(portraitPreview.process.match(/\/watermark,/gu)).toHaveLength(1)
    expect(portraitPreview.process).toContain(',t_50,g_center/')
    expect(storage.publicObjects.size).toBe(publicObjectCount)
    expect(getAdminHome(sqlite).slides[0]).toMatchObject({
      enabled: false,
      missingVariantCount: 16,
    })
    sqlite.prepare(`
      UPDATE works SET publication_status = 'unpublished' WHERE id = ?
    `).run(linked.workId)
    expect(getAdminHome(sqlite).slides[0]?.linkedWork?.publicationStatus)
      .toBe('unpublished')
    expect(() => startHeroSlidePublication(
      sqlite,
      slide.id,
      created.version,
      NOW + sequence++,
    )).toThrow(/published/)
    sqlite.prepare(`
      UPDATE works SET publication_status = 'published' WHERE id = ?
    `).run(linked.workId)

    const operation = startHeroSlidePublication(
      sqlite,
      slide.id,
      created.version,
      NOW + sequence++,
    )
    expect(getAdminHome(sqlite).slides[0]?.publicationOperation).toMatchObject({
      operationId: operation.operationId,
      status: 'GENERATING_PUBLIC',
    })
    storage.failProcess = true
    const failed = await runHeroSlidePublication(
      sqlite,
      storage,
      operation.operationId,
      USER_ID,
      NOW + sequence++,
    )
    expect(failed).toMatchObject({
      status: 'FAILED',
      // T34-F1：Hero 生成无水印站点展示变体，失败阶段不再是水印应用。
      failureStage: 'GENERATING_PUBLIC',
      failureCode: 'PUBLIC_MEDIA_GENERATION_FAILED',
    })
    expect(getAdminHome(sqlite).slides[0]?.publicationOperation).toMatchObject({
      operationId: operation.operationId,
      status: 'FAILED',
    })
    expect(getAdminHome(sqlite).slides[0]?.enabled).toBe(false)

    storage.failProcess = false
    const retry = await retryHeroSlidePublication(
      sqlite,
      storage,
      operation.operationId,
      failed.version,
      NOW + sequence++,
    )
    const completed = await runHeroSlidePublication(
      sqlite,
      storage,
      retry.operationId,
      USER_ID,
      NOW + sequence++,
    )
    expect(completed.status).toBe('DONE')
    expect(storage.deletedPrivateKeys).toEqual(expect.arrayContaining([
      previewManifest.landscapeKey,
      previewManifest.portraitKey,
    ]))
    expect(sqlite.prepare(`
      SELECT landscape_preview_object_key, portrait_preview_object_key,
             preview_expires_at
      FROM site_hero_slides WHERE id = ?
    `).get(slide.id)).toEqual({
      landscape_preview_object_key: null,
      portrait_preview_object_key: null,
      preview_expires_at: null,
    })
    const enabledHome = getAdminHome(sqlite)
    expect(enabledHome.slides[0]).toMatchObject({
      enabled: true,
      missingVariantCount: 0,
      publicationOperation: null,
    })

    const secondLandscape = createHeroAsset(
      'home_hero_landscape',
      enabledHome.version,
    )
    const secondPortrait = createHeroAsset(
      'home_hero_portrait',
      enabledHome.version,
    )
    let home = createHeroSlide(sqlite, enabledHome.version, {
      alt: '第二项首页照片',
      sortOrder: 1,
      landscapeAssetId: secondLandscape,
      portraitAssetId: secondPortrait,
      linkedWorkId: null,
    }, NOW + sequence++)
    const secondSlide = home.slides.find(item => !item.enabled)!
    home = await updateHeroSlide(sqlite, storage, secondSlide.id, home.version, {
      alt: '第二项首页横竖照片',
      sortOrder: 1,
      landscapeAssetId: secondLandscape,
      portraitAssetId: secondPortrait,
      linkedWorkId: null,
    }, NOW + sequence++)
    const secondOperation = startHeroSlidePublication(
      sqlite,
      secondSlide.id,
      home.version,
      NOW + sequence++,
    )
    await runHeroSlidePublication(
      sqlite,
      storage,
      secondOperation.operationId,
      USER_ID,
      NOW + sequence++,
    )
    home = getAdminHome(sqlite)
    // T34-F3：首屏设置只写口号与轮播；官方邮箱与 QQ 由 contact 分区维护，
    // 因此保存首屏设置不会改变公开投影里的联系人。
    home = updateHomeSettings(sqlite, home.version, {
      tagline: '只让作品说话',
      autoRotate: true,
      autoRotateIntervalMs: 6000,
    }, NOW + sequence++)
    expect(() => reorderEnabledHeroSlides(
      sqlite,
      home.version,
      [slide.id, slide.id],
      NOW + sequence++,
    )).toThrow(/stale/)
    home = reorderEnabledHeroSlides(
      sqlite,
      home.version,
      [secondSlide.id, slide.id],
      NOW + sequence++,
    )
    const publicRead = capturePreparedQueries(() =>
      getPublicHome(sqlite, MEDIA_BASE_URL))
    const projection = publicRead.result
    expect(publicRead.queries.length).toBeGreaterThan(0)
    // 管理端不再查活动水印 profile：站点大图与水印无关。
    const adminRead = capturePreparedQueries(() => getAdminHome(sqlite))
    expect(adminRead.queries).toHaveLength(4)
    expect(projection).toMatchObject({
      tagline: '只让作品说话',
      contactEmail: '765678159@qq.com',
      contactQq: '765678159',
      autoRotate: true,
      autoRotateIntervalMs: 6000,
    })
    // R3-C 公开投影只消费四个新 collection；旧 pair 操作不再更改公开 Hero。
    expect(projection.landscape).toEqual([])
    expect(projection.portrait).toEqual([])
    const visible = JSON.stringify(projection)
    expect(visible).not.toContain('/original/')
    expect(visible).not.toContain('version')
    expect(visible).not.toContain('enabled')
    expect(visible).not.toContain('watermark')

    const linkedVersion = sqlite.prepare(`
      SELECT version FROM works WHERE id = ?
    `).pluck().get(linked.workId) as number
    await expect(unpublishWork(
      sqlite,
      storage,
      linked.workId,
      linkedVersion,
      USER_ID,
      NOW + sequence++,
    )).rejects.toThrow(/Disable or unlink/u)
    expect(sqlite.prepare(`
      SELECT count(*) FROM publication_operations
      WHERE entity_type = 'WORK' AND entity_id = ?
        AND operation_type = 'UNPUBLISH'
    `).pluck().get(linked.workId)).toBe(0)

    home = await disableHeroSlide(
      sqlite,
      storage,
      secondSlide.id,
      home.version,
      USER_ID,
      NOW + sequence++,
    )
    const failedPurgeOperationId = randomUUID()
    sqlite.prepare(`
      INSERT INTO publication_operations (
        id, operation_type, entity_type, entity_id, requested_version,
        status, failure_stage, internal_error_code,
        edge_purge_urls_json, edge_purge_status, edge_purge_reason,
        started_at, updated_at, completed_at
      ) VALUES (?, 'UNPUBLISH', 'HOME', ?, ?, 'FAILED',
                'CLEANING_PUBLIC', 'EDGE_PURGE_SUBMIT_FAILED',
                ?, 'FAILED', 'EDGE_PURGE_SUBMIT_FAILED', ?, ?, ?)
    `).run(
      failedPurgeOperationId,
      secondSlide.id,
      home.version,
      JSON.stringify(['https://public-media.ditedog.com/prod/web/hero/stale.webp']),
      NOW + sequence,
      NOW + sequence,
      NOW + sequence++,
    )
    await expect(deleteHeroSlide(
      sqlite,
      storage,
      secondSlide.id,
      home.version,
      NOW + sequence++,
    )).rejects.toMatchObject({
      reason: 'PUBLICATION_CLEANUP_PENDING',
      statusCode: 409,
    })
    sqlite.prepare(`
      UPDATE publication_operations
      SET status = 'DONE', failure_stage = NULL, internal_error_code = NULL,
          edge_purge_status = 'COMPLETE', edge_purge_reason = NULL,
          version = version + 1, updated_at = ?
      WHERE id = ?
    `).run(NOW + sequence++, failedPurgeOperationId)
    await expect(disableHeroSlide(
      sqlite,
      storage,
      slide.id,
      home.version,
      USER_ID,
      NOW + sequence++,
    )).rejects.toThrow(/At least one/)
    home = await deleteHeroSlide(
      sqlite,
      storage,
      secondSlide.id,
      home.version,
      NOW + sequence++,
    )
    expect(home.slides).toHaveLength(1)
    expect(() => updateHomeSettings(sqlite, 1, {
      tagline: 'stale',
      autoRotate: false,
      autoRotateIntervalMs: 6000,
    })).toThrow(/stale/)
    expect(createHeroSlideRequestSchema.safeParse({
      expectedVersion: home.version,
      payload: {
        alt: '联系 QQ: 3114559925',
        sortOrder: 1,
        landscapeAssetId: randomUUID(),
        portraitAssetId: randomUUID(),
        linkedWorkId: null,
      },
    }).success).toBe(false)
  })

  it('keeps legacy paired commission operations isolated from independent public collections', async () => {
    let version = getAdminHome(sqlite).version
    const commissionLandscape = createHeroAsset(
      'home_hero_landscape', version, undefined, 'test/t20', 'commission',
    )
    const commissionPortrait = createHeroAsset(
      'home_hero_portrait', version, undefined, 'test/t20', 'commission',
    )
    let commission = createHeroSlide(sqlite, version, {
      alt: '委托页独立背景图',
      sortOrder: 0,
      landscapeAssetId: commissionLandscape,
      portraitAssetId: commissionPortrait,
      linkedWorkId: null,
    }, NOW + sequence++, 'commission')
    const commissionSlide = commission.slides[0]!
    const commissionOperation = startHeroSlidePublication(
      sqlite,
      commissionSlide.id,
      commission.version,
      NOW + sequence++,
      'commission',
    )
    await runHeroSlidePublication(
      sqlite,
      storage,
      commissionOperation.operationId,
      USER_ID,
      NOW + sequence++,
    )

    version = getAdminHome(sqlite, 'commission').version
    const homeLandscape = createHeroAsset('home_hero_landscape', version)
    const homePortrait = createHeroAsset('home_hero_portrait', version)
    const home = createHeroSlide(sqlite, version, {
      alt: '首页独立背景图',
      sortOrder: 0,
      landscapeAssetId: homeLandscape,
      portraitAssetId: homePortrait,
      linkedWorkId: null,
    }, NOW + sequence++)
    const homeSlide = home.slides[0]!
    const homeOperation = startHeroSlidePublication(
      sqlite,
      homeSlide.id,
      home.version,
      NOW + sequence++,
    )
    await runHeroSlidePublication(
      sqlite,
      storage,
      homeOperation.operationId,
      USER_ID,
      NOW + sequence++,
    )

    expect(getPublicHome(sqlite, MEDIA_BASE_URL).landscape).toEqual([])
    expect(getPublicCommissionHero(sqlite, MEDIA_BASE_URL).landscape).toEqual([])
    expect(getAdminHome(sqlite).slides).toHaveLength(1)
    expect(getAdminHome(sqlite, 'commission').slides).toHaveLength(1)

    version = getAdminHome(sqlite, 'commission').version
    const spareLandscape = createHeroAsset(
      'home_hero_landscape', version, undefined, 'test/t20', 'commission',
    )
    const sparePortrait = createHeroAsset(
      'home_hero_portrait', version, undefined, 'test/t20', 'commission',
    )
    commission = createHeroSlide(sqlite, version, {
      alt: '委托页备选背景图',
      sortOrder: 1,
      landscapeAssetId: spareLandscape,
      portraitAssetId: sparePortrait,
      linkedWorkId: null,
    }, NOW + sequence++, 'commission')
    const spareSlide = commission.slides.find(slide => slide.alt === '委托页备选背景图')!
    const spareOperation = startHeroSlidePublication(
      sqlite,
      spareSlide.id,
      commission.version,
      NOW + sequence++,
      'commission',
    )
    await runHeroSlidePublication(
      sqlite,
      storage,
      spareOperation.operationId,
      USER_ID,
      NOW + sequence++,
    )
    commission = getAdminHome(sqlite, 'commission')
    commission = reorderEnabledHeroSlides(
      sqlite,
      commission.version,
      [spareSlide.id, commissionSlide.id],
      NOW + sequence++,
      'commission',
    )
    expect(getPublicCommissionHero(sqlite, MEDIA_BASE_URL).landscape).toEqual([])

    await disableHeroSlide(
      sqlite,
      storage,
      spareSlide.id,
      commission.version,
      USER_ID,
      NOW + sequence++,
      'commission',
    )
    commission = getAdminHome(sqlite, 'commission')
    expect(commission.slides).toHaveLength(2)
    expect(getPublicCommissionHero(sqlite, MEDIA_BASE_URL).landscape).toEqual([])

    commission = await disableHeroSlide(
      sqlite,
      storage,
      commissionSlide.id,
      commission.version,
      USER_ID,
      NOW + sequence++,
      'commission',
    )
    expect(commission.slides.every(slide => !slide.enabled)).toBe(true)
    expect(getPublicCommissionHero(sqlite, MEDIA_BASE_URL)).toEqual({
      landscape: [],
      portrait: [],
    })
    expect(getPublicHome(sqlite, MEDIA_BASE_URL).landscape).toEqual([])
  })
})
