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
  createWorkRequestSchema,
  replaceStudioPhotosRequestSchema,
} from '../../shared/schemas/work'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import {
  createManagedWork,
  deleteManagedWork,
  getManagedWork,
  getPublicSafeWorkPreview,
  listManagedWorks,
  replaceManagedStudioPhotos,
  updateManagedWork,
} from '../../server/utils/work-management'
import { generatePublicVariants } from '../../server/utils/media-recipe'
import { createSyntheticWatermarkPng } from '../../scripts/oss-preflight-core.mjs'
import { FakeMediaStorage } from '../helpers/fake-media-storage'
import { insertActiveWatermarkProfile } from '../helpers/watermark-fixture'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NOW = Date.UTC(2026, 7, 1)

let directory: string
let sqlite: Database.Database

const workInput = {
  slug: 'tuan-zi',
  characterName: '团子',
  species: '犬科',
  suitType: 'full' as const,
  purpose: 'showcase' as const,
  ownerDisplay: '不公开' as const,
  ownerContact: '仅后台联系人',
  featureTags: ['软萌', '大尾巴'],
}

function insertUser() {
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
}

function insertReadyPhoto(workId: string, workVersion: number, assetId: string) {
  const sha = assetId.replaceAll('-', '').padEnd(64, 'a').slice(0, 64)
    .replaceAll(/[^0-9a-f]/gu, 'a')
  const key = `test/t17-fixture/original/${assetId}/source.png`
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, 'studio_photo', 'READY', ?, ?, 1024,
              'image/png', 3000, 2400, ?, ?)
  `).run(assetId, key, sha, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO upload_sessions (
      id, owner_type, owner_id, owner_version, media_role,
      private_object_key, expected_content_type, expected_bytes,
      expected_content_md5, expected_sha256, expected_width,
      expected_height, created_by, status, asset_id, version,
      created_at, expires_at, updated_at
    ) VALUES (?, 'work', ?, ?, 'studio_photo', ?, 'image/png', 1024,
              'AAAAAAAAAAAAAAAAAAAAAA==', ?, 3000, 2400, ?, 'COMPLETED', ?, 3,
              ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    workId,
    workVersion,
    key,
    sha,
    USER_ID,
    assetId,
    NOW,
    NOW + 300_000,
    NOW + 1_000,
  )
  return key
}

function photo(assetId: string, primary: boolean, alt: string) {
  return {
    assetId,
    alt,
    primary,
    focalX: 0.25,
    focalY: 0.75,
    crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    watermarkAnchor: 'bottom-right' as const,
  }
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-work-'))
  const databaseFile = resolve(directory, 'work.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  insertUser()
  insertActiveWatermarkProfile(sqlite, NOW, {
    environmentPrefix: 'test/t17-fixture',
  })
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('minimal non-adoption work management', () => {
  it('creates, lists, reads and updates a private draft with optimistic versions', () => {
    const created = createManagedWork(sqlite, workInput, NOW)
    expect(created).toMatchObject({
      version: 1,
      publicationStatus: 'draft',
      ownerDisplay: '不公开',
      featureTags: ['软萌', '大尾巴'],
      private: { ownerContact: '仅后台联系人' },
      studioPhotos: [],
    })
    expect(listManagedWorks(sqlite)).toEqual([
      expect.objectContaining({
        id: created.id,
        studioPhotoCount: 0,
        primaryAssetId: null,
      }),
    ])
    expect(getManagedWork(sqlite, created.id)).toEqual(created)

    const updated = updateManagedWork(
      sqlite,
      created.id,
      1,
      {
        ...workInput,
        slug: 'tuan-zi-v2',
        ownerDisplay: '有点小狗工作室',
        ownerContact: null,
        purpose: 'commission',
        featureTags: ['大尾巴'],
      },
      NOW + 1_000,
    )
    expect(updated).toMatchObject({
      version: 2,
      slug: 'tuan-zi-v2',
      purpose: 'commission',
      ownerDisplay: '有点小狗工作室',
      featureTags: ['大尾巴'],
      private: { ownerContact: null },
    })
    expect(() => updateManagedWork(
      sqlite,
      created.id,
      1,
      workInput,
    )).toThrow(/stale/u)
  })

  it('deletes only a non-published work, cleans public variants and retains private originals', async () => {
    const storage = new FakeMediaStorage()
    const work = createManagedWork(sqlite, workInput, NOW)
    const assetId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const privateKey = insertReadyPhoto(work.id, work.version, assetId)
    storage.seedPrivate(privateKey, createSyntheticWatermarkPng(), 'image/png')
    const attached = replaceManagedStudioPhotos(
      sqlite,
      work.id,
      work.version,
      [photo(assetId, true, '待删除作品出厂照')],
      NOW + 1_000,
    )
    await generatePublicVariants(
      sqlite,
      storage,
      assetId,
      ['work-card'],
      NOW + 2_000,
    )

    await expect(deleteManagedWork(
      sqlite,
      storage,
      work.id,
      attached.version,
      USER_ID,
      NOW + 3_000,
    )).resolves.toEqual({ id: work.id })
    expect(listManagedWorks(sqlite)).toEqual([])
    expect(sqlite.prepare('SELECT count(*) FROM assets WHERE id = ?')
      .pluck().get(assetId)).toBe(1)
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE asset_id = ? AND storage_scope = 'PUBLIC'
    `).pluck().get(assetId)).toBe(0)
    expect(storage.deletedPublicKeys).toHaveLength(6)
  })

  it('requires a published work to be unpublished before deletion', async () => {
    const storage = new FakeMediaStorage()
    const work = createManagedWork(sqlite, workInput, NOW)
    sqlite.prepare(`
      UPDATE works SET publication_status = 'published' WHERE id = ?
    `).run(work.id)

    await expect(deleteManagedWork(
      sqlite,
      storage,
      work.id,
      work.version,
      USER_ID,
    )).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' })
    expect(getManagedWork(sqlite, work.id).publicationStatus).toBe('published')
  })

  it('replaces the ordered studio-photo aggregate and removes only relations', () => {
    const work = createManagedWork(sqlite, workInput, NOW)
    const firstId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const secondId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    insertReadyPhoto(work.id, work.version, firstId)
    insertReadyPhoto(work.id, work.version, secondId)

    const attached = replaceManagedStudioPhotos(
      sqlite,
      work.id,
      work.version,
      [
        photo(firstId, true, '团子正面出厂照'),
        photo(secondId, false, '团子侧面出厂照'),
      ],
      NOW + 1_000,
    )
    expect(attached.version).toBe(2)
    expect(attached.studioPhotos).toEqual([
      expect.objectContaining({
        assetId: firstId,
        alt: '团子正面出厂照',
        primary: true,
        position: 0,
        crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      }),
      expect.objectContaining({
        assetId: secondId,
        primary: false,
        position: 1,
      }),
    ])
    expect(sqlite.prepare(`
      SELECT focal_x AS focalX, focal_y AS focalY,
             watermark_anchor AS watermarkAnchor
      FROM assets WHERE id = ?
    `).get(firstId)).toEqual({
      focalX: 0.25,
      focalY: 0.75,
      watermarkAnchor: 'top-left',
    })

    const replaced = replaceManagedStudioPhotos(
      sqlite,
      work.id,
      2,
      [photo(secondId, true, '团子侧面主图')],
      NOW + 2_000,
    )
    expect(replaced.studioPhotos).toEqual([
      expect.objectContaining({
        assetId: secondId,
        primary: true,
        position: 0,
      }),
    ])
    expect(sqlite.prepare(`
      SELECT count(*) FROM assets WHERE role = 'studio_photo'
    `).pluck().get()).toBe(2)
    expect(sqlite.prepare(`
      SELECT count(*) FROM work_assets WHERE asset_id = ?
    `).pluck().get(firstId)).toBe(0)
  })

  it('returns a contact-free, key-free public preview', () => {
    const work = createManagedWork(sqlite, workInput, NOW)
    const assetId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    insertReadyPhoto(work.id, work.version, assetId)
    replaceManagedStudioPhotos(
      sqlite,
      work.id,
      work.version,
      [photo(assetId, true, '团子出厂照')],
      NOW + 1_000,
    )

    const preview = getPublicSafeWorkPreview(sqlite, work.id)
    expect(preview.mediaReady).toBe(true)
    const serialized = JSON.stringify(preview)
    expect(serialized).not.toContain('仅后台联系人')
    expect(serialized).not.toContain('privateObjectKey')
    expect(serialized).not.toContain('/original/')
    expect(preview).not.toHaveProperty('private')
  })

  it('rejects forbidden fields, invalid ownership and incomplete primary selection', () => {
    expect(createWorkRequestSchema.safeParse({
      ...workInput,
      ownerDisplay: '',
    }).success).toBe(false)
    expect(createWorkRequestSchema.safeParse({
      ...workInput,
      ownerType: 'studio',
      deposit: 100,
      payment: 'paid',
      usd: 20,
    }).success).toBe(false)
    expect(replaceStudioPhotosRequestSchema.safeParse({
      expectedVersion: 1,
      payload: {
        photos: [
          photo('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', false, '照片'),
        ],
      },
    }).success).toBe(false)

    const work = createManagedWork(sqlite, workInput, NOW)
    const other = createManagedWork(sqlite, {
      ...workInput,
      slug: 'other-work',
    }, NOW)
    const assetId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    insertReadyPhoto(other.id, other.version, assetId)
    expect(() => replaceManagedStudioPhotos(
      sqlite,
      work.id,
      work.version,
      [photo(assetId, true, '错误归属照片')],
    )).toThrow(/ready studio photo/u)
  })
})
