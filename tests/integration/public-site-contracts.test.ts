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
  getPublicHome,
  reorderEnabledHeroSlides,
  retryHeroSlidePublication,
  runHeroSlidePublication,
  startHeroSlidePublication,
  updateHeroSlide,
  updateHomeSettings,
} from '../../server/utils/home-management'
import {
  createFakePublicSiteRepository,
  createSqlitePublicSiteRepository,
} from '../../server/utils/public-site-repository'
import {
  createManagedWork,
  replaceManagedDesignSheet,
  replaceManagedStudioPhotos,
} from '../../server/utils/work-management'
import { publishWork, unpublishWork } from '../../server/utils/work-publication'
import { FakeMediaStorage } from '../helpers/fake-media-storage'
import { insertActiveWatermarkProfile } from '../helpers/watermark-fixture'

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
) {
  const assetId = randomUUID()
  const content = createSyntheticWatermarkPng()
  const landscape = role === 'home_hero_landscape'
  const width = dimensions?.width ?? (landscape ? 3200 : 1800)
  const height = dimensions?.height ?? (landscape ? 1800 : 3200)
  const key = `test/t20/original/${assetId}/source.png`
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
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('T19/T20 public repository contracts', () => {
  it('rejects READY hero sources that cannot satisfy the current recipe', () => {
    const initial = getAdminHome(sqlite)
    const landscape = createHeroAsset(
      'home_hero_landscape',
      initial.version,
      { width: 320, height: 180 },
    )
    const portrait = createHeroAsset('home_hero_portrait', initial.version)

    expect(() => createHeroSlide(sqlite, initial.version, {
      alt: '尺寸不足的首页图',
      sortOrder: 0,
      landscapeAssetId: landscape,
      portraitAssetId: portrait,
      linkedWorkId: null,
    })).toThrow(/dimensions/u)
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
        recipe_version, watermark_profile, watermark_config_digest,
        logo_digest, watermark_anchor, sha256, byte_size,
        created_at, updated_at
      ) VALUES (?, ?, 'PUBLIC', 'READY', ?, ?, 'studio_photo', 'work-card',
                480, 640, 'jpeg', 86, 'legacy', 'recipe-v1',
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
    expect(repository.listWorks().items.map(item => item.work.purpose)).toEqual([
      'commission',
      'adoption',
      'showcase',
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
    const adoptionDetail = repository.getWorkBySlug('adoption-purpose')
    expect(adoptionDetail?.media.designSheet?.assetId)
      .toBe(adoptionList.items[0]?.designSheet.assetId)
    expect(adoptionDetail?.media.primaryStudioPhotoAssetId)
      .toBe(adoptionDetail?.media.studioPhotos[0]?.assetId)
    expect(adoptionDetail?.media.primaryStudioPhotoAssetId)
      .not.toBe(adoptionDetail?.media.designSheet?.assetId)
    expect(adoptionDetail?.media.studioPhotos).toHaveLength(1)
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
    expect(serialized).not.toContain('currentEventName')
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
      version: 1,
      tagline: '不只做小狗毛',
      contactEmail: '3114559925@qq.com',
      contactQq: '3114559925',
      autoRotate: false,
      autoRotateIntervalMs: 6000,
    })
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
    expect(slide).toMatchObject({ enabled: false, missingVariantCount: 12 })
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
    expect(storage.processCalls.slice(processCallCount).every(
      call => call.process.includes('g_center')
        && call.objectKey.includes('/preview/home/'),
    )).toBe(true)
    expect(storage.publicObjects.size).toBe(publicObjectCount)
    expect(getAdminHome(sqlite).slides[0]).toMatchObject({
      enabled: false,
      missingVariantCount: 12,
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
      failureStage: 'APPLYING_WATERMARK',
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
    home = updateHomeSettings(sqlite, home.version, {
      tagline: '只让作品说话',
      contactEmail: 'hello@example.test',
      contactQq: '123456789',
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
    const projection = getPublicHome(sqlite, MEDIA_BASE_URL)
    expect(projection).toMatchObject({
      tagline: '只让作品说话',
      contactEmail: 'hello@example.test',
      contactQq: '123456789',
      autoRotate: true,
      autoRotateIntervalMs: 6000,
    })
    expect(projection.slides.map(item => item.sortOrder)).toEqual([0, 1])
    expect(projection.slides[1]?.linkedWorkHref).toBe('/works/linked-work')
    expect(projection.slides[0]?.landscape.webp.map(item => item.width)).toEqual([
      768,
      1280,
      1920,
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
      contactEmail: 'stale@example.test',
      contactQq: '123456789',
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
})
