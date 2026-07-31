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
  createManagedWork,
  replaceManagedStudioPhotos,
} from '../../server/utils/work-management'
import {
  checkWorkPublication,
  publishWork,
  retryPublicationCleanup,
  unpublishWork,
} from '../../server/utils/work-publication'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ASSET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
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

function createWorkWithPhoto() {
  const work = createManagedWork(sqlite, {
    slug: 'publication-work',
    characterName: '团子',
    species: '犬科',
    suitType: 'full',
    purpose: 'showcase',
    ownerDisplay: '不公开',
    ownerContact: '不会进入日志或公开 DTO',
    featureTags: ['软萌'],
  }, NOW)
  const content = createSyntheticWatermarkPng()
  const key = `test/t18-fixture/original/${ASSET_ID}/source.png`
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, 'studio_photo', 'READY', ?, ?, ?,
              'image/png', 3200, 2400, ?, ?)
  `).run(ASSET_ID, key, sha256(content), content.length, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO upload_sessions (
      id, owner_type, owner_id, owner_version, media_role,
      private_object_key, expected_content_type, expected_bytes,
      expected_content_md5, expected_sha256, expected_width,
      expected_height, created_by, status, asset_id, version,
      created_at, expires_at, updated_at
    ) VALUES (?, 'work', ?, 1, 'studio_photo', ?, 'image/png', ?,
              ?, ?, 3200, 2400, ?, 'COMPLETED', ?, 3, ?, ?, ?)
  `).run(
    randomUUID(),
    work.id,
    key,
    content.length,
    createHash('md5').update(content).digest('base64'),
    sha256(content),
    USER_ID,
    ASSET_ID,
    NOW,
    NOW + 300_000,
    NOW + 1_000,
  )
  storage.seedPrivate(key, content, 'image/png', sha256(content), {
    fileSize: content.length,
    format: 'png',
    height: 2_400,
    orientation: 1,
    width: 3_200,
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

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-publication-'))
  const databaseFile = resolve(directory, 'publication.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
  insertUser()
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('dual-bucket work publication operations', () => {
  it('checks, generates, commits and reuses one idempotent publication', async () => {
    const work = createWorkWithPhoto()
    expect(checkWorkPublication(sqlite, work.id)).toMatchObject({
      canPublish: true,
      blockers: [],
      missingVariantCount: 12,
      studioPhotoCount: 1,
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

  it('blocks the not-yet-authorized adoption publication path', async () => {
    const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    sqlite.prepare(`
      INSERT INTO works (
        id, slug, character_name, species, suit_type, purpose,
        owner_display, publication_status, created_at, updated_at
      ) VALUES (?, 'adoption-draft', '待领养', '犬科', 'partial',
                'adoption', '不公开', 'draft', ?, ?)
    `).run(id, NOW, NOW)
    expect(checkWorkPublication(sqlite, id).blockers).toContain(
      'ADOPTION_FLOW_NOT_READY',
    )

    const result = await publishWork(
      sqlite,
      storage,
      id,
      1,
      USER_ID,
      NOW + 1_000,
    )
    expect(result).toMatchObject({
      operation: {
        status: 'FAILED',
        failureStage: 'VALIDATING',
      },
      work: { publicationStatus: 'draft' },
    })
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
    expect(visible).not.toContain('不会进入日志或公开 DTO')
    expect(visible).not.toContain('/original/')
    expect(visible).not.toContain('privateObjectKey')
    const audit = JSON.stringify(sqlite.prepare(`
      SELECT action, entity_type AS entityType, entity_id AS entityId,
             result, created_at AS createdAt
      FROM audit_logs
    `).all())
    expect(audit).not.toContain('不会进入日志或公开 DTO')
    expect(audit).not.toContain('/original/')
    expect(audit).not.toContain('signed')
  })
})
