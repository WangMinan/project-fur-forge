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
  replaceManagedStudioPhotos,
} from '../../server/utils/work-management'
import { publishWork } from '../../server/utils/work-publication'
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
  role: 'studio_photo' | 'home_hero_landscape' | 'home_hero_portrait',
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
  slug: string
  sortOrder: number
}) {
  const work = createManagedWork(sqlite, {
    slug: input.slug,
    characterName: input.slug === 'first-work' ? '团子' : '雪球',
    species: '犬科',
    suitType: input.slug === 'first-work' ? 'full' : 'partial',
    purpose: 'showcase',
    ownerDisplay: '不公开',
    ownerContact: input.ownerContact,
    featureTags: ['软萌'],
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
  const withPhoto = replaceManagedStudioPhotos(sqlite, work.id, work.version, [{
    assetId,
    alt: `${work.characterName}出厂照`,
    primary: true,
    focalX: 0.5,
    focalY: 0.5,
    crop: { x: 0, y: 0, width: 1, height: 1 },
  }], NOW + sequence++)
  const published = await publishWork(
    sqlite,
    storage,
    work.id,
    withPhoto.version,
    USER_ID,
    NOW + sequence++,
  )
  expect(published.work.publicationStatus).toBe('published')
  sqlite.prepare(`
    UPDATE works SET sort_order = ?, featured = ? WHERE id = ?
  `).run(input.sortOrder, input.featured ? 1 : 0, work.id)
  return { assetId, assetSha256: digest(content), workId: work.id }
}

function createHeroAsset(
  role: 'home_hero_landscape' | 'home_hero_portrait',
  ownerVersion: number,
) {
  const assetId = randomUUID()
  const content = createSyntheticWatermarkPng()
  const landscape = role === 'home_hero_landscape'
  const width = landscape ? 3200 : 1800
  const height = landscape ? 1800 : 3200
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
        autoRotate: false,
        autoRotateIntervalMs: 6000,
        slides: [],
      },
    })
    expect(fake.listFeaturedWorks().items[0]?.work.slug).toBe('second-work')
    expect(fake.listWorks({ suitType: 'full' }).resultCount).toBe(1)
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
    expect(preview.landscape.url).toMatch(/^https:\/\/private-download\.test\//u)
    expect(preview.portrait.expiresAt).toBe(preview.landscape.expiresAt)
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
    const enabledHome = getAdminHome(sqlite)
    expect(enabledHome.slides[0]).toMatchObject({
      enabled: true,
      missingVariantCount: 0,
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
    home = updateHeroSlide(sqlite, secondSlide.id, home.version, {
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

    home = disableHeroSlide(
      sqlite,
      secondSlide.id,
      home.version,
      USER_ID,
      NOW + sequence++,
    )
    expect(() => disableHeroSlide(
      sqlite,
      slide.id,
      home.version,
      USER_ID,
      NOW + sequence++,
    )).toThrow(/At least one/)
    home = deleteHeroSlide(
      sqlite,
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
})
