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
  runHeroSlideUnpublication,
  startHeroSlideUpscale,
  startHeroSlidePublication,
  startHeroSlideUnpublication,
  updateHeroSlide,
  updateHomeSettings,
} from '../../server/utils/runner/home-management'
import {
  createFakePublicSiteRepository,
  createSqlitePublicSiteRepository,
} from '../../server/utils/repository/public-site-repository'
import {
  createManagedWork,
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
  role: 'design_sheet' | 'studio_photo' | 'home_hero_landscape' | 'home_hero_portrait',
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
    ownerId === 'home' ? 'site' : 'work',
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
  ownerContact: string
  purpose?: 'adoption' | 'commission' | 'showcase'
  slug: string
  sortOrder: number
  withStudioPhoto?: boolean
}) {
  const common = {
    slug: input.slug,
    characterName: input.slug === 'first-work' ? '团子' : '雪球',
    species: '犬科',
    suitType: input.slug === 'first-work' ? 'full' : 'partial',
    ownerDisplay: '不公开',
    ownerContact: input.ownerContact,
    featureTags: ['软萌'],
    sortOrder: input.sortOrder,
    featured: input.featured,
  } as const
  const work = createManagedWork(sqlite, input.purpose === 'adoption'
    ? {
        ...common,
        purpose: 'adoption',
        adoptionMethod: 'regular',
        businessStatus: 'available',
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
  let designAssetId: string | null = null
  if (input.purpose === 'adoption') {
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
  let current = work
  if (input.withStudioPhoto !== false) {
    current = replaceManagedStudioPhotos(sqlite, work.id, work.version, [{
      assetId,
      alt: `${work.characterName}出厂照`,
      primary: true,
      focalX: 0.5,
      focalY: 0.5,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    }], NOW + sequence++)
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
  return { assetId, assetSha256: digest(content), designAssetId, workId: work.id }
}

function createHeroAsset(
  role: 'home_hero_landscape' | 'home_hero_portrait',
  ownerVersion: number,
  dimensions?: { height: number, width: number },
  environmentPrefix = 'test/t20',
) {
  const assetId = randomUUID()
  const content = createSyntheticWatermarkPng()
  const landscape = role === 'home_hero_landscape'
  const width = dimensions?.width ?? (landscape ? 4000 : 1800)
  const height = dimensions?.height ?? (landscape ? 2250 : 3200)
  const key = `${environmentPrefix}/original/${assetId}/source.png`
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, ?, 'READY', ?, ?, ?, 'image/png', ?, ?, ?, ?)
  `).run(assetId, role, key, digest(content), content.length, width, height, NOW, NOW)
  insertCompletedUpload('home', ownerVersion, assetId, role, key, content, width, height)
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
    let home = getAdminHome(sqlite)
    const createEnabledSlide = async (alt: string, sortOrder: number) => {
      const landscapeAssetId = createHeroAsset(
        'home_hero_landscape',
        home.version,
        undefined,
        'prod',
      )
      const portraitAssetId = createHeroAsset(
        'home_hero_portrait',
        home.version,
        undefined,
        'prod',
      )
      home = createHeroSlide(sqlite, home.version, {
        alt,
        landscapeAssetId,
        linkedWorkId: null,
        portraitAssetId,
        sortOrder,
      }, NOW + sequence++)
      const slide = home.slides.find(item => item.alt === alt)!
      const operation = startHeroSlidePublication(
        sqlite,
        slide.id,
        home.version,
        NOW + sequence++,
      )
      await runHeroSlidePublication(
        sqlite,
        storage,
        operation.operationId,
        USER_ID,
        NOW + sequence++,
      )
      home = getAdminHome(sqlite)
      return slide
    }

    const removable = await createEnabledSlide('待撤销首页图', 0)
    await createEnabledSlide('保留首页图', 1)
    const variantRows = sqlite.prepare(`
      SELECT id, object_key AS objectKey FROM asset_variants
      WHERE asset_id IN (?, ?) AND storage_scope = 'PUBLIC'
      ORDER BY id
    `).all(
      removable.landscape.assetId,
      removable.portrait.assetId,
    ) as { id: string, objectKey: string }[]
    expect(variantRows.every(row => row.objectKey.startsWith('prod/web/')))
      .toBe(true)

    const cache = new FakePublicMediaCache()
    let finishDescribe: ((status: 'Complete') => void) | undefined
    cache.describeExactFilePurge = vi.fn(async () => await new Promise<'Complete'>((resolve) => {
      finishDescribe = resolve
    }))
    setPublicMediaCacheForTests(cache)
    const unpublication = startHeroSlideUnpublication(
      sqlite,
      removable.id,
      home.version,
      NOW + sequence++,
    )
    const running = runHeroSlideUnpublication(
      sqlite,
      storage,
      unpublication.operationId,
      USER_ID,
      NOW + sequence++,
    )
    await vi.waitFor(() => {
      expect(cache.submittedUrls).toHaveLength(1)
    })

    expect(getPublicHome(sqlite, MEDIA_BASE_URL).slides.map(item => item.alt))
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
      ownerContact: 'private-second@example.test',
    })
    const first = await createPublishedWork({
      slug: 'first-work',
      sortOrder: 10,
      featured: true,
      ownerContact: 'private-first@example.test',
    })
    const draft = createManagedWork(sqlite, {
      slug: 'draft-work',
      characterName: '草稿',
      species: '犬科',
      suitType: 'full',
      purpose: 'showcase',
      ownerDisplay: '不公开',
      ownerContact: 'draft-private@example.test',
      featureTags: [],
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
      'test/t19/web/legacy-contact@example.test.jpg',
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
    expect(repository.listWorks({ suitType: 'full' }).items)
      .toHaveLength(1)
    expect(repository.listWorks({ q: '  团子  ' }).items.map(item => item.work.slug))
      .toEqual(['first-work'])
    expect(repository.listWorks({ q: ['团子'] })).toMatchObject({
      items: [],
      resultCount: 0,
    })
    expect(repository.listWorks({ purpose: 'bad-value' })).toMatchObject({
      items: [],
      resultCount: 0,
      filter: { valid: false },
    })
    expect(repository.listFeaturedWorks().items.map(item => item.work.slug))
      .toEqual(['first-work', 'second-work'])
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
    expect(detail.related[0]?.work.slug).toBe('second-work')
    expect(detail.navigation).toEqual({
      previous: null,
      next: {
        characterName: '雪球',
        href: '/works/second-work',
      },
    })
    const visible = JSON.stringify(detail)
    expect(visible).not.toContain('private-first@example.test')
    expect(visible).not.toContain('legacy-contact@example.test')
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
        slides: [],
      },
    })
    expect(fake.listFeaturedWorks().items[0]?.work.slug).toBe('second-work')
    expect(fake.listWorks({ suitType: 'full' }).resultCount).toBe(1)

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
        navigation: { previous: null, next: null },
        related: [],
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
        slides: [],
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

    for (let index = 0; index < 6; index += 1) {
      await createPublishedWork({
        slug: `featured-extra-${index}`,
        sortOrder: 30 + index,
        featured: true,
        ownerContact: `private-extra-${index}@example.test`,
      })
    }
    expect(repository.listFeaturedWorks().items.map(item => item.work.slug))
      .toEqual([
        'first-work',
        'second-work',
        'featured-extra-0',
        'featured-extra-1',
        'featured-extra-2',
        'featured-extra-3',
      ])
    expect(repository.listFeaturedWorks().resultCount).toBe(6)

    await createPublishedWork({
      slug: 'published-after-first-read',
      sortOrder: 3,
      featured: false,
      ownerContact: 'later-private@example.test',
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
      ownerContact: 'private-legacy@example.test',
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
      ownerContact: 'private-commission@example.test',
      purpose: 'commission',
    })
    await createPublishedWork({
      slug: 'adoption-purpose',
      sortOrder: 2,
      featured: false,
      ownerContact: 'private-adoption@example.test',
      purpose: 'adoption',
    })
    await createPublishedWork({
      slug: 'showcase-purpose',
      sortOrder: 3,
      featured: false,
      ownerContact: 'private-showcase@example.test',
      purpose: 'showcase',
    })

    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    // T35-F5：公开列表按发布时间倒序，越新的越靠前。
    // 三件作品按 commission → adoption → showcase 顺序发布，因此这里反序。
    expect(repository.listWorks().items.map(item => item.work.purpose)).toEqual([
      'showcase',
      'adoption',
      'commission',
    ])
    expect(repository.getWorkBySlug('adoption-purpose')?.work).toMatchObject({
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      price: { currency: 'CNY', minorUnits: 100 },
    })
    const adoptionList = repository.listAdoptions()
    expect(adoptionList).toMatchObject({
      resultCount: 1,
      items: [{
        work: {
          slug: 'adoption-purpose',
          purpose: 'adoption',
          adoptionMethod: 'regular',
          businessStatus: 'available',
          price: { currency: 'CNY', minorUnits: 100 },
          featureTags: ['软萌'],
        },
        href: '/works/adoption-purpose',
      }],
    })
    expect(adoptionList.items[0]?.designSheet.sources.webp.map(item => item.width))
      .toEqual([960, 1600, 2400])
    expect(repository.listAdoptions({ q: '雪球' })).toMatchObject({
      items: [{ work: { slug: 'adoption-purpose' } }],
      resultCount: 1,
    })
    expect(repository.listAdoptions({ q: { invalid: true } })).toMatchObject({
      items: [],
      resultCount: 0,
      counts: { all: 0, regular: 0, event_drop: 0 },
    })
    const adoptionDetail = repository.getWorkBySlug('adoption-purpose')
    expect(adoptionDetail?.media.designSheet?.assetId)
      .toBe(adoptionList.items[0]?.designSheet.assetId)
    expect(adoptionDetail?.media.primaryStudioPhotoAssetId)
      .toBe(adoptionDetail?.media.studioPhotos[0]?.assetId)
    expect(adoptionDetail?.media.primaryStudioPhotoAssetId)
      .not.toBe(adoptionDetail?.media.designSheet?.assetId)
    expect(adoptionDetail?.media.studioPhotos).toHaveLength(1)

    const pagedAdoptionDetails = Array.from({ length: 9 }, (_, index) => {
      const slug = `paged-adoption-${index + 1}`
      return {
        ...adoptionDetail!,
        work: {
          ...adoptionDetail!.work,
          id: randomUUID(),
          slug,
          characterName: `分页领养 ${index + 1}`,
        },
        href: `/works/${slug}`,
        navigation: { previous: null, next: null },
        related: [],
      }
    })
    const pagedAdoptions = createFakePublicSiteRepository({
      details: pagedAdoptionDetails,
      featuredSlugs: [],
      home: {
        tagline: '不只做小狗毛',
        contactEmail: 'studio@example.test',
        contactQq: '123456789',
        autoRotate: false,
        autoRotateIntervalMs: 6000,
        slides: [],
      },
    }).listAdoptions({ method: 'regular', page: 2 })
    expect(pagedAdoptions).toMatchObject({
      page: 2,
      pageCount: 2,
      pageSize: 8,
      resultCount: 9,
      items: [{ work: { slug: 'paged-adoption-9' } }],
      counts: { all: 9, regular: 9, event_drop: 0 },
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
    expect(serialized).not.toContain('private-adoption@example.test')
    expect(serialized).not.toContain('/original/')
    expect(serialized).not.toContain('ownerContact')
    expect(serialized).not.toContain('privateObjectKey')
  })

  it('uses a design sheet as the public visual without making it a studio primary', async () => {
    const created = await createPublishedWork({
      slug: 'design-only-adoption',
      sortOrder: 1,
      featured: false,
      ownerContact: 'design-only-private@example.test',
      purpose: 'adoption',
      withStudioPhoto: false,
    })
    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    const listItem = repository.listAdoptions().items[0]
    const detail = repository.getWorkBySlug('design-only-adoption')

    expect(listItem?.designSheet.assetId).toBe(created.designAssetId)
    expect(detail?.media).toMatchObject({
      primaryAssetId: null,
      primaryStudioPhotoAssetId: null,
      gallery: [],
      studioPhotos: [],
    })
    expect(detail?.media.card.assetId).toBe(created.designAssetId)
    expect(detail?.media.designSheet?.assetId).toBe(created.designAssetId)
    expect(repository.listWorks().items).toHaveLength(0)
    expect(JSON.stringify({ detail, listItem }))
      .not.toContain('design-only-private@example.test')
  })

  it('publishes complete hero pairs atomically and exposes only safe public fields', async () => {
    const linked = await createPublishedWork({
      slug: 'linked-work',
      sortOrder: 1,
      featured: false,
      ownerContact: 'linked-private@example.test',
    })
    const initial = getAdminHome(sqlite)
    expect(initial).toMatchObject({
      version: expect.any(Number),
      tagline: '不只做小狗毛',
      contactEmail: '3114559925@qq.com',
      contactQq: '3114559925',
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
    // T34-F1 增加两个首页业务入口来源查询；T34-F2 的聚合投影会再收敛。
    expect(publicRead.queries).toHaveLength(7)
    // 管理端不再查活动水印 profile：站点大图与水印无关。
    const adminRead = capturePreparedQueries(() => getAdminHome(sqlite))
    expect(adminRead.queries).toHaveLength(4)
    expect(projection).toMatchObject({
      tagline: '只让作品说话',
      contactEmail: '3114559925@qq.com',
      contactQq: '3114559925',
      autoRotate: true,
      autoRotateIntervalMs: 6000,
    })
    expect(projection.slides.map(item => item.sortOrder)).toEqual([0, 1])
    expect(projection.slides[1]?.linkedWorkHref).toBe('/works/linked-work')
    expect(projection.slides[0]?.landscape.webp.map(item => item.width)).toEqual([
      768,
      1280,
      1920,
      2880,
      3840,
    ])
    expect(projection.slides[0]?.portrait.fallback.map(item => item.width)).toEqual([
      480,
      768,
      1080,
    ])
    const visible = JSON.stringify(projection)
    expect(visible).not.toContain('linked-private@example.test')
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

  it('keeps commission hero ordering independent and allows an empty commission hero', async () => {
    let version = getAdminHome(sqlite).version
    const commissionLandscape = createHeroAsset('home_hero_landscape', version)
    const commissionPortrait = createHeroAsset('home_hero_portrait', version)
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

    expect(getPublicHome(sqlite, MEDIA_BASE_URL).slides[0]?.alt)
      .toBe('首页独立背景图')
    expect(getPublicCommissionHero(sqlite, MEDIA_BASE_URL).slide?.alt)
      .toBe('委托页独立背景图')
    expect(getAdminHome(sqlite).slides).toHaveLength(1)
    expect(getAdminHome(sqlite, 'commission').slides).toHaveLength(1)

    version = getAdminHome(sqlite, 'commission').version
    const spareLandscape = createHeroAsset('home_hero_landscape', version)
    const sparePortrait = createHeroAsset('home_hero_portrait', version)
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
    expect(getPublicCommissionHero(sqlite, MEDIA_BASE_URL).slide?.alt)
      .toBe('委托页备选背景图')

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
    expect(getPublicCommissionHero(sqlite, MEDIA_BASE_URL).slide?.alt)
      .toBe('委托页独立背景图')

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
      slide: null,
    })
    expect(getPublicHome(sqlite, MEDIA_BASE_URL).slides).toHaveLength(1)
  })
})
