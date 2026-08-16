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
import {
  createSyntheticSourcePng,
  createSyntheticWatermarkPng,
} from '../../scripts/oss-preflight-core.mjs'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import {
  setPublicMediaCacheForTests,
} from '../../server/utils/public-media-cache'
import {
  createManagedWork,
  deleteManagedWork,
  replaceManagedAdoptionCover,
  replaceManagedDesignSheet,
  replaceManagedStudioPhotos,
} from '../../server/utils/service/work-management'
import {
  checkWorkPublication,
  publishWork,
  retryPublicationCleanup,
  unpublishWork,
} from '../../server/utils/runner/work-publication'
import { recoverPendingOperations } from '../../server/utils/runner/operation-recovery'
import { FakeMediaStorage } from '../helpers/fake-media-storage'
import { FakePublicMediaCache } from '../helpers/fake-public-media-cache'
import { insertActiveWatermarkProfile } from '../helpers/watermark-fixture'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ASSET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const COVER_ASSET_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const DESIGN_ASSET_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const NOW = Date.UTC(2026, 7, 1)

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

function sha256(content: Buffer) {
  return createHash('sha256').update(content).digest('hex')
}

function insertUser() {
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
}

function createWorkWithPhoto(
  width = 3200,
  height = 2400,
  environmentPrefix = 'test/t18-fixture',
) {
  const work = createManagedWork(sqlite, {
    slug: 'publication-work',
    characterName: '团子',
    species: '犬科',
    purpose: 'showcase',
    sortOrder: 0,
    featured: false,
  }, NOW)
  const content = width < 2400 || height < 1600
    ? createSyntheticSourcePng(width, height)
    : createSyntheticWatermarkPng()
  const key = `${environmentPrefix}/original/${ASSET_ID}/source.png`
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, 'studio_photo', 'READY', ?, ?, ?,
              'image/png', ?, ?, ?, ?)
  `).run(ASSET_ID, key, sha256(content), content.length, width, height, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO upload_sessions (
      id, owner_type, owner_id, owner_version, media_role,
      private_object_key, expected_content_type, expected_bytes,
      expected_content_md5, expected_sha256, expected_width,
      expected_height, created_by, status, asset_id, version,
      created_at, expires_at, updated_at
    ) VALUES (?, 'work', ?, 1, 'studio_photo', ?, 'image/png', ?,
              ?, ?, ?, ?, ?, 'COMPLETED', ?, 3, ?, ?, ?)
  `).run(
    randomUUID(),
    work.id,
    key,
    content.length,
    createHash('md5').update(content).digest('base64'),
    sha256(content),
    width,
    height,
    USER_ID,
    ASSET_ID,
    NOW,
    NOW + 300_000,
    NOW + 1_000,
  )
  storage.seedPrivate(key, content, 'image/png', sha256(content), {
    fileSize: content.length,
    format: 'png',
    height,
    orientation: 1,
    width,
  })
  return replaceManagedStudioPhotos(
    sqlite,
    work.id,
    1,
    [{
      assetId: ASSET_ID,
      alt: '团子出厂照',
      primary: true,
      focalX: 0.5,
      focalY: 0.5,
      crop: { x: 0, y: 0, width: 1, height: 1 },
      watermarkAnchor: 'top-left',
    }],
    NOW + 2_000,
  )
}

function createRegularAdoption() {
  return createManagedWork(sqlite, {
    slug: 'regular-adoption',
    characterName: '待领养小狗',
    species: '犬科',
    purpose: 'adoption',
    adoptionStatus: 'available',
    priceCnyMinor: 100,
    sortOrder: 0,
    featured: false,
  }, NOW)
}

function attachRequiredAdoptionMedia(
  work: ReturnType<typeof createRegularAdoption>,
) {
  const photoContent = createSyntheticWatermarkPng()
  const coverContent = createSyntheticSourcePng(3200, 1800)
  const sources = [
    {
      assetId: ASSET_ID,
      content: photoContent,
      height: 2400,
      role: 'studio_photo' as const,
      width: 3200,
    },
    {
      assetId: COVER_ASSET_ID,
      content: coverContent,
      height: 1800,
      role: 'adoption_cover' as const,
      width: 3200,
    },
  ]
  for (const source of sources) {
    const key = `test/t18-fixture/original/${source.assetId}/source.png`
    sqlite.prepare(`
      INSERT INTO assets (
        id, role, status, private_object_key, sha256, byte_size,
        mime_type, width, height, created_at, updated_at
      ) VALUES (?, ?, 'READY', ?, ?, ?, 'image/png', ?, ?, ?, ?)
    `).run(
      source.assetId,
      source.role,
      key,
      sha256(source.content),
      source.content.length,
      source.width,
      source.height,
      NOW,
      NOW,
    )
    sqlite.prepare(`
      INSERT INTO upload_sessions (
        id, owner_type, owner_id, owner_version, media_role,
        private_object_key, expected_content_type, expected_bytes,
        expected_content_md5, expected_sha256, expected_width,
        expected_height, created_by, status, asset_id, version,
        created_at, expires_at, updated_at
      ) VALUES (?, 'work', ?, ?, ?, ?, 'image/png', ?, ?, ?, ?, ?, ?,
        'COMPLETED', ?, 3, ?, ?, ?)
    `).run(
      randomUUID(),
      work.id,
      work.version,
      source.role,
      key,
      source.content.length,
      createHash('md5').update(source.content).digest('base64'),
      sha256(source.content),
      source.width,
      source.height,
      USER_ID,
      source.assetId,
      NOW,
      NOW + 300_000,
      NOW + 1_000,
    )
    storage.seedPrivate(key, source.content, 'image/png', sha256(source.content), {
      fileSize: source.content.length,
      format: 'png',
      height: source.height,
      orientation: 1,
      width: source.width,
    })
  }
  const withPhoto = replaceManagedStudioPhotos(
    sqlite,
    work.id,
    work.version,
    [{
      assetId: ASSET_ID,
      alt: '合成主出厂照',
      primary: true,
      focalX: 0.5,
      focalY: 0.5,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    }],
    NOW + 1_000,
  )
  return replaceManagedAdoptionCover(
    sqlite,
    work.id,
    withPhoto.version,
    {
      assetId: COVER_ASSET_ID,
      alt: '合成领养横版封面',
      focalX: 0.5,
      focalY: 0.5,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    },
    NOW + 2_000,
  )
}

function attachDesignSheet(
  work: { characterName: string, id: string, version: number },
  width = 3200,
  height = 1800,
) {
  const content = createSyntheticSourcePng(width, height)
  const key = `test/t18-fixture/original/${DESIGN_ASSET_ID}/source.png`
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, 'design_sheet', 'READY', ?, ?, ?,
              'image/png', ?, ?, ?, ?)
  `).run(
    DESIGN_ASSET_ID,
    key,
    sha256(content),
    content.length,
    width,
    height,
    NOW,
    NOW,
  )
  sqlite.prepare(`
    INSERT INTO upload_sessions (
      id, owner_type, owner_id, owner_version, media_role,
      private_object_key, expected_content_type, expected_bytes,
      expected_content_md5, expected_sha256, expected_width,
      expected_height, created_by, status, asset_id, version,
      created_at, expires_at, updated_at
    ) VALUES (?, 'work', ?, ?, 'design_sheet', ?, 'image/png', ?,
              ?, ?, ?, ?, ?, 'COMPLETED', ?, 3, ?, ?, ?)
  `).run(
    randomUUID(),
    work.id,
    work.version,
    key,
    content.length,
    createHash('md5').update(content).digest('base64'),
    sha256(content),
    width,
    height,
    USER_ID,
    DESIGN_ASSET_ID,
    NOW,
    NOW + 300_000,
    NOW + 1_000,
  )
  storage.seedPrivate(key, content, 'image/png', sha256(content), {
    fileSize: content.length,
    format: 'png',
    height,
    orientation: 1,
    width,
  })
  return replaceManagedDesignSheet(sqlite, work.id, work.version, {
    assetId: DESIGN_ASSET_ID,
    alt: '待领养小狗完整设定图',
  }, NOW + 2_000)
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-publication-'))
  const databaseFile = resolve(directory, 'publication.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
  insertUser()
  insertActiveWatermarkProfile(sqlite, NOW, {
    environmentPrefix: 'test/t18-fixture',
  })
})

afterEach(() => {
  setPublicMediaCacheForTests()
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('dual-bucket work publication operations', () => {
  it('prepares a private Lanczos source and publishes a low-resolution studio photo', async () => {
    const work = createWorkWithPhoto(480, 640)

    expect(checkWorkPublication(sqlite, work.id)).toMatchObject({
      canPublish: true,
      blockers: [],
      studioPhotoNeedsPreprocess: true,
    })
    const published = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 3_000,
    )

    expect(published).toMatchObject({
      operation: { status: 'DONE' },
      work: { publicationStatus: 'published' },
    })
    expect(checkWorkPublication(sqlite, work.id).studioPhotoNeedsPreprocess)
      .toBe(false)
    const preprocess = sqlite.prepare(`
      SELECT storage_scope AS storageScope, status, recipe_version AS recipeVersion,
             width, height, input_sha256 AS inputSha256
      FROM asset_variants
      WHERE asset_id = ? AND recipe_version = 'studio-photo-upscale-lanczos-v1'
    `).get(ASSET_ID) as {
      height: number
      inputSha256: string
      recipeVersion: string
      status: string
      storageScope: string
      width: number
    }
    expect(preprocess).toMatchObject({
      recipeVersion: 'studio-photo-upscale-lanczos-v1',
      status: 'READY',
      storageScope: 'PRIVATE',
      width: 2400,
      height: 3200,
    })
    expect(preprocess.inputSha256).toBe(sha256(storage.objects.get(
      `test/t18-fixture/original/${ASSET_ID}/source.png`,
    )!.content))
    expect(storage.privatePuts).toHaveLength(1)
    expect(storage.objects.has(
      `test/t18-fixture/original/${ASSET_ID}/source.png`,
    )).toBe(true)
    expect(storage.processCalls).toHaveLength(12)
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE asset_id = ? AND storage_scope = 'PUBLIC'
        AND source_variant_id = (
          SELECT id FROM asset_variants
          WHERE asset_id = ? AND recipe_version = 'studio-photo-upscale-lanczos-v1'
        )
    `).pluck().get(ASSET_ID, ASSET_ID)).toBe(12)
  }, 30_000)

  it('keeps the studio original and reports a stable preparation failure', async () => {
    const work = createWorkWithPhoto(480, 640)
    storage.failPut = true

    const failed = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 3_000,
    )

    expect(failed).toMatchObject({
      operation: {
        failureCode: 'STUDIO_PHOTO_UPSCALE_FAILED',
        failureStage: 'PREPARING_SOURCE',
        status: 'FAILED',
      },
      work: { publicationStatus: 'draft' },
    })
    expect(storage.objects.has(
      `test/t18-fixture/original/${ASSET_ID}/source.png`,
    )).toBe(true)
    expect(storage.processCalls).toHaveLength(0)
  }, 30_000)

  it('checks, generates, commits and reuses one idempotent publication', async () => {
    const work = createWorkWithPhoto()
    expect(checkWorkPublication(sqlite, work.id)).toMatchObject({
      canPublish: true,
      blockers: [],
      missingVariantCount: 12,
      studioPhotoCount: 1,
      studioPhotoNeedsPreprocess: false,
    })

    const published = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 3_000,
    )
    expect(published).toMatchObject({
      operation: {
        operationType: 'PUBLISH',
        status: 'DONE',
        failureCode: null,
        cleanupPendingCount: 0,
      },
      work: { version: 3, publicationStatus: 'published' },
    })
    expect(checkWorkPublication(sqlite, work.id).missingVariantCount).toBe(0)
    expect(storage.processCalls).toHaveLength(12)
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE storage_scope = 'PUBLIC' AND status = 'READY'
    `).pluck().get()).toBe(12)

    const repeated = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 4_000,
    )
    expect(repeated.operation.operationId).toBe(
      published.operation.operationId,
    )
    expect(storage.processCalls).toHaveLength(12)
  })

  it('absorbs one transient OSS generation failure inside one publish request', async () => {
    const work = createWorkWithPhoto()
    const process = storage.processPrivateToPublic.bind(storage)
    let attempts = 0
    storage.processPrivateToPublic = async (input) => {
      attempts += 1
      if (attempts === 1) {
        throw new Error('transient OSS generation failure')
      }
      await process(input)
    }

    const result = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 3_000,
    )

    expect(result).toMatchObject({
      operation: { status: 'DONE' },
      work: { publicationStatus: 'published' },
    })
    expect(attempts).toBe(13)
    expect(storage.processCalls).toHaveLength(12)
  })

  it('keeps the current published projection when a new publish request fails', async () => {
    const work = createWorkWithPhoto()
    const published = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 3_000,
    )

    const failed = await publishWork(
      sqlite,
      storage,
      work.id,
      published.work.version,
      USER_ID,
      NOW + 4_000,
    )
    expect(failed.operation).toMatchObject({
      status: 'FAILED',
      failureStage: 'VALIDATING',
      failureCode: 'PUBLICATION_VALIDATION_FAILED',
    })
    expect(failed.work.publicationStatus).toBe('published')
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE storage_scope = 'PUBLIC' AND status = 'READY'
    `).pluck().get()).toBe(12)
  })

  it('hides first, records cleanup failure, then retries exact public keys', async () => {
    const work = createWorkWithPhoto()
    const published = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 3_000,
    )
    storage.failDelete = true

    const unpublished = await unpublishWork(
      sqlite,
      storage,
      work.id,
      published.work.version,
      USER_ID,
      NOW + 4_000,
    )
    expect(unpublished.work).toMatchObject({
      version: 4,
      publicationStatus: 'unpublished',
    })
    expect(unpublished.operation).toMatchObject({
      status: 'FAILED',
      failureStage: 'CLEANING_PUBLIC',
      failureCode: 'PUBLIC_CLEANUP_FAILED',
      cleanupPendingCount: 12,
    })
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE storage_scope = 'PUBLIC' AND status = 'READY'
    `).pluck().get()).toBe(0)

    storage.failDelete = false
    const cleaned = await retryPublicationCleanup(
      sqlite,
      storage,
      unpublished.operation.operationId,
      unpublished.operation.version,
      USER_ID,
      NOW + 5_000,
    )
    expect(cleaned).toMatchObject({
      status: 'DONE',
      failureCode: null,
      cleanupPendingCount: 0,
    })
    expect(storage.deletedPublicKeys).toHaveLength(12)
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants WHERE storage_scope = 'PUBLIC'
    `).pluck().get()).toBe(0)
  })

  it('persists exact ESA URLs before deletion and exposes purge progress separately', async () => {
    const work = createWorkWithPhoto(3200, 2400, 'prod')
    const published = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 3_000,
    )
    let finishDescribe!: (status: 'Complete') => void
    const cache = new FakePublicMediaCache()
    cache.describeExactFilePurge = async () => await new Promise((resolve) => {
      finishDescribe = resolve
    })
    setPublicMediaCacheForTests(cache)

    const unpublishing = unpublishWork(
      sqlite,
      storage,
      work.id,
      published.work.version,
      USER_ID,
      NOW + 4_000,
    )
    await expect.poll(() => sqlite.prepare(`
      SELECT edge_purge_status FROM publication_operations
      WHERE operation_type = 'UNPUBLISH'
      ORDER BY started_at DESC LIMIT 1
    `).pluck().get()).toBe('PURGING')
    expect(sqlite.prepare(`
      SELECT publication_status FROM works WHERE id = ?
    `).pluck().get(work.id)).toBe('unpublished')

    finishDescribe('Complete')
    const unpublished = await unpublishing
    expect(unpublished.operation).toMatchObject({
      status: 'DONE',
      edgePurgeStatus: 'COMPLETE',
      edgePurgeFailureReason: null,
      edgePurgeFileCount: 12,
    })
    expect(cache.submittedUrls).toHaveLength(1)
    expect(cache.submittedUrls[0]).toHaveLength(12)
    expect(cache.submittedUrls[0]?.every(url => (
      url.startsWith('https://public-media.ditedog.com/prod/web/')
      && !url.includes('?')
    ))).toBe(true)
    expect(sqlite.prepare(`
      SELECT edge_purge_task_id FROM publication_operations
      WHERE id = ?
    `).pluck().get(unpublished.operation.operationId)).toBe('purge-task-1')
  })

  it('keeps the page hidden when ESA purge fails and retries without another business write', async () => {
    const work = createWorkWithPhoto(3200, 2400, 'prod')
    const published = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 3_000,
    )
    const cache = new FakePublicMediaCache()
    cache.statuses = ['Failed']
    setPublicMediaCacheForTests(cache)

    const unpublished = await unpublishWork(
      sqlite,
      storage,
      work.id,
      published.work.version,
      USER_ID,
      NOW + 4_000,
    )
    expect(unpublished.work.publicationStatus).toBe('unpublished')
    expect(unpublished.operation).toMatchObject({
      status: 'FAILED',
      failureCode: 'EDGE_PURGE_FAILED',
      cleanupPendingCount: 0,
      edgePurgeStatus: 'FAILED',
      edgePurgeFailureReason: 'EDGE_PURGE_FAILED',
      edgePurgeFileCount: 12,
    })
    const hiddenVersion = unpublished.work.version

    await expect(deleteManagedWork(
      sqlite,
      storage,
      work.id,
      hiddenVersion,
      USER_ID,
      NOW + 4_500,
    )).rejects.toMatchObject({
      reason: 'PUBLICATION_CLEANUP_PENDING',
      statusCode: 409,
    })

    cache.statuses = ['Complete']
    const retried = await retryPublicationCleanup(
      sqlite,
      storage,
      unpublished.operation.operationId,
      unpublished.operation.version,
      USER_ID,
      NOW + 5_000,
    )
    expect(retried).toMatchObject({
      status: 'DONE',
      edgePurgeStatus: 'COMPLETE',
      edgePurgeFailureReason: null,
    })
    expect(cache.submittedUrls).toHaveLength(2)
    expect(sqlite.prepare(`
      SELECT version FROM works WHERE id = ?
    `).pluck().get(work.id)).toBe(hiddenVersion)

    await expect(deleteManagedWork(
      sqlite,
      storage,
      work.id,
      hiddenVersion,
      USER_ID,
      NOW + 6_000,
    )).resolves.toEqual({ id: work.id })
  })

  it('resumes an in-flight ESA purge after restart without resubmitting or republishing', async () => {
    const work = createWorkWithPhoto(3200, 2400, 'prod')
    const published = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 3_000,
    )
    const cache = new FakePublicMediaCache()
    cache.statuses = ['Failed']
    setPublicMediaCacheForTests(cache)
    const unpublished = await unpublishWork(
      sqlite,
      storage,
      work.id,
      published.work.version,
      USER_ID,
      NOW + 4_000,
    )
    const hiddenVersion = unpublished.work.version

    sqlite.prepare(`
      UPDATE publication_operations
      SET status = 'CLEANING_PUBLIC', edge_purge_status = 'PURGING',
          edge_purge_reason = NULL, failure_stage = NULL,
          internal_error_code = NULL, internal_error_message = NULL,
          completed_at = NULL, lease_owner = NULL, lease_expires_at = NULL
      WHERE id = ?
    `).run(unpublished.operation.operationId)
    cache.statuses = ['Complete']

    const summary = await recoverPendingOperations({
      now: NOW + 5_000,
      sqlite,
      storage,
    })
    expect(summary.resumed).toBeGreaterThanOrEqual(1)
    expect(sqlite.prepare(`
      SELECT status, edge_purge_status AS edgePurgeStatus
      FROM publication_operations WHERE id = ?
    `).get(unpublished.operation.operationId)).toEqual({
      edgePurgeStatus: 'COMPLETE',
      status: 'DONE',
    })
    expect(cache.submittedUrls).toHaveLength(1)
    expect(sqlite.prepare(`
      SELECT publication_status AS publicationStatus, version
      FROM works WHERE id = ?
    `).get(work.id)).toEqual({
      publicationStatus: 'unpublished',
      version: hiddenVersion,
    })
  })

  it('records an unexpected unpublish commit error as FAILED', async () => {
    const work = createWorkWithPhoto()
    const published = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 3_000,
    )
    sqlite.exec(`
      CREATE TRIGGER test_abort_unpublish
      BEFORE UPDATE OF publication_status ON works
      WHEN NEW.publication_status = 'unpublished'
      BEGIN
        SELECT RAISE(ABORT, 'test unpublish commit failure');
      END;
    `)

    const result = await unpublishWork(
      sqlite,
      storage,
      work.id,
      published.work.version,
      USER_ID,
      NOW + 4_000,
    )
    expect(result).toMatchObject({
      operation: {
        status: 'FAILED',
        failureStage: 'COMMITTING',
        failureCode: 'UNPUBLICATION_COMMIT_FAILED',
      },
      work: { publicationStatus: 'published' },
    })
    expect(sqlite.prepare(`
      SELECT count(*) FROM publication_operations
      WHERE entity_id = ? AND status NOT IN ('FAILED', 'DONE')
    `).pluck().get(work.id)).toBe(0)
  })

  it('rolls back a commit race and cleans every newly generated object', async () => {
    const work = createWorkWithPhoto()
    const process = storage.processPrivateToPublic.bind(storage)
    let changed = false
    storage.processPrivateToPublic = async (input) => {
      await process(input)
      if (!changed) {
        changed = true
        sqlite.prepare(`
          UPDATE works SET version = version + 1 WHERE id = ?
        `).run(work.id)
      }
    }

    const result = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 3_000,
    )
    expect(result).toMatchObject({
      operation: {
        status: 'FAILED',
        failureStage: 'COMMITTING',
        failureCode: 'PUBLICATION_COMMIT_FAILED',
        cleanupPendingCount: 0,
      },
      work: { publicationStatus: 'draft' },
    })
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants WHERE storage_scope = 'PUBLIC'
    `).pluck().get()).toBe(0)
    expect(storage.deletedPublicKeys).toHaveLength(12)
  })

  it('requires an explicit status, cover and primary photo while keeping the design sheet optional', async () => {
    const work = createRegularAdoption()
    expect(checkWorkPublication(sqlite, work.id)).toMatchObject({
      canPublish: false,
      blockers: ['ADOPTION_COVER_REQUIRED', 'STUDIO_PHOTO_REQUIRED'],
      adoptionCoverCount: 0,
      designSheetCount: 0,
      studioPhotoCount: 0,
    })

    await expect(publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 1_000,
    )).rejects.toThrow(/Resolve publication blockers/u)
    expect(sqlite.prepare(`
      SELECT count(*) FROM publication_operations WHERE entity_id = ?
    `).pluck().get(work.id)).toBe(0)

    const ready = attachRequiredAdoptionMedia(work)
    expect(checkWorkPublication(sqlite, work.id)).toMatchObject({
      canPublish: true,
      blockers: [],
      adoptionCoverCount: 1,
      designSheetCount: 0,
      studioPhotoCount: 1,
    })
    const published = await publishWork(
      sqlite,
      storage,
      work.id,
      ready.version,
      USER_ID,
      NOW + 3_000,
    )
    expect(published.work.publicationStatus).toBe('published')
    const variants = sqlite.prepare(`
      SELECT media_role AS mediaRole, usage, protection_mode AS protectionMode,
             recipe_version AS recipeVersion,
             watermark_profile AS watermarkProfile
      FROM asset_variants
      WHERE asset_id IN (?, ?) AND storage_scope = 'PUBLIC'
    `).all(ASSET_ID, COVER_ASSET_ID) as Array<{
      mediaRole: string
      protectionMode: string
      recipeVersion: string
      usage: string
      watermarkProfile: string
    }>
    expect(new Set(variants.map(variant => variant.usage))).toEqual(new Set([
      'adoption-card',
      'detail',
      'work-card',
    ]))
    expect(variants.every(variant => (
      variant.watermarkProfile === 'brand-centered-v2'
      && variant.protectionMode === 'watermark'
      && variant.recipeVersion === 'recipe-v3'
    ))).toBe(true)
    expect(new Set(variants.map(variant => variant.mediaRole)))
      .toEqual(new Set(['adoption_cover', 'studio_photo']))
  })

  it('prepares a private Lanczos source and publishes a low-resolution design sheet', async () => {
    const work = createRegularAdoption()
    const withRequiredMedia = attachRequiredAdoptionMedia(work)
    const ready = attachDesignSheet(withRequiredMedia, 1560, 1080)
    expect(checkWorkPublication(sqlite, work.id)).toMatchObject({
      canPublish: true,
      blockers: [],
      designSheetNeedsPreprocess: true,
    })
    const published = await publishWork(
      sqlite,
      storage,
      work.id,
      ready.version,
      USER_ID,
      NOW + 3_000,
    )

    expect(published).toMatchObject({
      operation: { status: 'DONE' },
      work: { publicationStatus: 'published' },
    })
    expect(checkWorkPublication(sqlite, work.id).designSheetNeedsPreprocess)
      .toBe(false)
    const preprocess = sqlite.prepare(`
      SELECT storage_scope AS storageScope, status, recipe_version AS recipeVersion,
             width, height, input_sha256 AS inputSha256
      FROM asset_variants
      WHERE asset_id = ? AND recipe_version = 'design-sheet-upscale-lanczos-v1'
    `).get(DESIGN_ASSET_ID) as {
      height: number
      inputSha256: string
      recipeVersion: string
      status: string
      storageScope: string
      width: number
    }
    expect(preprocess).toMatchObject({
      inputSha256: sha256(storage.objects.get(
        `test/t18-fixture/original/${DESIGN_ASSET_ID}/source.png`,
      )!.content),
      recipeVersion: 'design-sheet-upscale-lanczos-v1',
      status: 'READY',
      storageScope: 'PRIVATE',
    })
    expect(preprocess.width).toBeGreaterThanOrEqual(2400)
    expect(preprocess.width / preprocess.height).toBeCloseTo(1560 / 1080, 2)
    expect(storage.privatePuts).toHaveLength(1)
    expect(storage.privatePuts[0]?.contentMd5).toMatch(/^[A-Za-z0-9+/]{22}==$/u)
    expect(storage.objects.has(
      `test/t18-fixture/original/${DESIGN_ASSET_ID}/source.png`,
    )).toBe(true)
    expect(storage.processCalls.length).toBeGreaterThan(18)
  }, 30_000)

  it('keeps the original and reports a stable preparation failure when adaptation fails', async () => {
    const work = createRegularAdoption()
    const withRequiredMedia = attachRequiredAdoptionMedia(work)
    const ready = attachDesignSheet(withRequiredMedia, 1560, 1080)
    storage.failPut = true

    const failed = await publishWork(
      sqlite,
      storage,
      work.id,
      ready.version,
      USER_ID,
      NOW + 3_000,
    )

    expect(failed).toMatchObject({
      operation: {
        failureCode: 'DESIGN_SHEET_UPSCALE_FAILED',
        failureStage: 'PREPARING_SOURCE',
        status: 'FAILED',
      },
      work: { publicationStatus: 'draft' },
    })
    expect(storage.objects.has(
      `test/t18-fixture/original/${DESIGN_ASSET_ID}/source.png`,
    )).toBe(true)
    expect(storage.processCalls).toHaveLength(0)
  })

  it('keeps audit and browser-visible operation data free of private values', async () => {
    const work = createWorkWithPhoto()
    const result = await publishWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
      NOW + 3_000,
    )
    const visible = JSON.stringify(result)
    expect(visible).not.toContain('/original/')
    expect(visible).not.toContain('privateObjectKey')
    const audit = JSON.stringify(sqlite.prepare(`
      SELECT action, entity_type AS entityType, entity_id AS entityId,
             result, created_at AS createdAt
      FROM audit_logs
    `).all())
    expect(audit).not.toContain('/original/')
    expect(audit).not.toContain('signed')
  })
})
