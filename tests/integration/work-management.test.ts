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
  replaceDesignSheetRequestSchema,
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
  replaceManagedDesignSheet,
  replaceManagedStudioPhotos,
  updateManagedWork,
  updateManagedWorkPresentation,
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
  sortOrder: 10,
  featured: false,
}

function insertUser() {
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
}

function insertReadyWorkAsset(
  workId: string,
  workVersion: number,
  assetId: string,
  role: 'design_sheet' | 'studio_photo',
) {
  const sha = assetId.replaceAll('-', '').padEnd(64, 'a').slice(0, 64)
    .replaceAll(/[^0-9a-f]/gu, 'a')
  const key = `test/t17-fixture/original/${assetId}/source.png`
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, ?, 'READY', ?, ?, 1024,
              'image/png', 3000, 2400, ?, ?)
  `).run(assetId, role, key, sha, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO upload_sessions (
      id, owner_type, owner_id, owner_version, media_role,
      private_object_key, expected_content_type, expected_bytes,
      expected_content_md5, expected_sha256, expected_width,
      expected_height, created_by, status, asset_id, version,
      created_at, expires_at, updated_at
    ) VALUES (?, 'work', ?, ?, ?, ?, 'image/png', 1024,
              'AAAAAAAAAAAAAAAAAAAAAA==', ?, 3000, 2400, ?, 'COMPLETED', ?, 3,
              ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    workId,
    workVersion,
    role,
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

function insertReadyPhoto(workId: string, workVersion: number, assetId: string) {
  return insertReadyWorkAsset(
    workId,
    workVersion,
    assetId,
    'studio_photo',
  )
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

describe('T22 work management', () => {
  it('creates, lists, reads and updates a private draft with optimistic versions', () => {
    const created = createManagedWork(sqlite, workInput, NOW)
    expect(created).toMatchObject({
      version: 1,
      publicationStatus: 'draft',
      ownerDisplay: '不公开',
      featureTags: ['软萌', '大尾巴'],
      private: { ownerContact: '仅后台联系人' },
      studioPhotos: [],
      sortOrder: 10,
      featured: false,
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
        sortOrder: 2,
        featured: true,
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
      sortOrder: 2,
      featured: true,
    })
    expect(() => updateManagedWork(
      sqlite,
      created.id,
      1,
      workInput,
    )).toThrow(/stale/u)
  })

  it('updates presentation fields on a published work without opening full editing', () => {
    createManagedWork(sqlite, {
      ...workInput,
      slug: 'occupied-featured-order',
      sortOrder: 0,
      featured: true,
    }, NOW - 1)
    const work = createManagedWork(sqlite, workInput, NOW)
    sqlite.prepare(`
      UPDATE works SET publication_status = 'published' WHERE id = ?
    `).run(work.id)

    const updated = updateManagedWorkPresentation(sqlite, work.id, 1, {
      sortOrder: 0,
      featured: true,
    }, NOW + 1)
    expect(updated).toMatchObject({
      version: 2,
      publicationStatus: 'published',
      sortOrder: 1,
      featured: true,
    })
    expect(() => updateManagedWorkPresentation(sqlite, work.id, 1, {
      sortOrder: 4,
      featured: false,
    })).toThrow(/stale/u)
    expect(() => updateManagedWork(
      sqlite,
      work.id,
      updated.version,
      { ...workInput, characterName: '不应写入' },
    )).toThrow(/Unpublish the work before editing/u)
  })

  it('creates and updates all purposes while preserving the adoption matrix', () => {
    const commission = createManagedWork(sqlite, {
      ...workInput,
      slug: 'commission-work',
      purpose: 'commission',
      ownerDisplay: '公开角色主',
    }, NOW)
    const adoption = createManagedWork(sqlite, {
      ...workInput,
      slug: 'adoption-work',
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      priceCnyMinor: 1,
      sortOrder: 1,
      featured: true,
    }, NOW + 1)

    expect(commission).toMatchObject({
      purpose: 'commission',
      ownerDisplay: '公开角色主',
    })
    expect(adoption).toMatchObject({
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      priceCnyMinor: 1,
      sortOrder: 1,
      featured: true,
    })
    expect(listManagedWorks(sqlite).map(work => work.slug)).toEqual([
      'adoption-work',
      'commission-work',
    ])

    const showcased = updateManagedWork(sqlite, adoption.id, 1, {
      ...workInput,
      slug: 'adoption-became-showcase',
      purpose: 'showcase',
      sortOrder: 3,
    }, NOW + 2)
    expect(showcased).toMatchObject({
      version: 2,
      purpose: 'showcase',
      sortOrder: 3,
    })
    expect(showcased).not.toHaveProperty('adoptionMethod')
    expect(sqlite.prepare(`
      SELECT adoption_method, business_status, current_event_name,
             price_amount_minor, price_currency
      FROM works WHERE id = ?
    `).get(adoption.id)).toEqual({
      adoption_method: null,
      business_status: null,
      current_event_name: null,
      price_amount_minor: null,
      price_currency: null,
    })

    const adoptedAgain = updateManagedWork(sqlite, adoption.id, 2, {
      ...workInput,
      slug: 'showcase-became-adoption',
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'preparing',
      priceCnyMinor: null,
      sortOrder: 4,
    }, NOW + 3)
    expect(adoptedAgain).toMatchObject({
      version: 3,
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'preparing',
      priceCnyMinor: null,
    })
  })

  it('keeps historical event values admin-readable and migrates them explicitly', () => {
    const id = crypto.randomUUID()
    sqlite.prepare(`
      INSERT INTO works (
        id, slug, character_name, species, suit_type, purpose,
        adoption_method, business_status, current_event_name,
        owner_display, owner_contact, price_amount_minor, price_currency,
        publication_status, sort_order, featured, created_at, updated_at
      ) VALUES (?, 'legacy-event-drop', '旧展会角色', '犬科', 'partial',
                'adoption', 'event_drop', 'event_sale', '旧展会文本',
                '不公开', '旧联系人', 100, 'CNY', 'draft', 8, 0, ?, ?)
    `).run(id, NOW, NOW)

    expect(getManagedWork(sqlite, id)).toMatchObject({
      purpose: 'adoption',
      adoptionMethod: 'event_drop',
      businessStatus: 'event_sale',
      currentEventName: '旧展会文本',
      priceCnyMinor: 100,
      private: { ownerContact: '旧联系人' },
    })

    const migrated = updateManagedWork(sqlite, id, 1, {
      ...workInput,
      slug: 'legacy-event-drop',
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      priceCnyMinor: 100,
      sortOrder: 8,
    }, NOW + 1)
    expect(migrated).toMatchObject({
      version: 2,
      adoptionMethod: 'regular',
      businessStatus: 'available',
      currentEventName: null,
    })
  })

  it('returns a readable conflict before leaving an adoption design sheet behind', () => {
    const work = createManagedWork(sqlite, {
      ...workInput,
      slug: 'adoption-with-design',
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'preparing',
      priceCnyMinor: null,
    }, NOW)
    const assetId = crypto.randomUUID()
    sqlite.prepare(`
      INSERT INTO assets (
        id, role, status, private_object_key, sha256, byte_size,
        mime_type, width, height, created_at, updated_at
      ) VALUES (?, 'design_sheet', 'READY', ?, ?, 1024,
                'image/png', 1600, 900, ?, ?)
    `).run(
      assetId,
      `test/t22/original/${assetId}.png`,
      'a'.repeat(64),
      NOW,
      NOW,
    )
    sqlite.prepare(`
      INSERT INTO work_assets (work_id, asset_id, role, position)
      VALUES (?, ?, 'design_sheet', 0)
    `).run(work.id, assetId)

    expect(() => updateManagedWork(sqlite, work.id, 1, {
      ...workInput,
      slug: 'adoption-with-design',
      purpose: 'showcase',
    })).toThrow(/Remove the design sheet/u)
    expect(getManagedWork(sqlite, work.id).purpose).toBe('adoption')
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

  it('saves, replaces and deletes one design sheet with optimistic versions', () => {
    const work = createManagedWork(sqlite, {
      ...workInput,
      slug: 'design-sheet-work',
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'preparing',
      priceCnyMinor: null,
    }, NOW)
    const firstId = '11111111-1111-4111-8111-111111111111'
    const secondId = '22222222-2222-4222-8222-222222222222'
    insertReadyWorkAsset(work.id, work.version, firstId, 'design_sheet')
    insertReadyWorkAsset(work.id, work.version, secondId, 'design_sheet')

    const saved = replaceManagedDesignSheet(
      sqlite,
      work.id,
      work.version,
      { assetId: firstId, alt: '角色完整设定图' },
      NOW + 1,
    )
    expect(saved).toMatchObject({
      version: 2,
      designSheet: {
        assetId: firstId,
        alt: '角色完整设定图',
        position: 0,
        status: 'READY',
      },
    })
    expect(() => replaceManagedDesignSheet(
      sqlite,
      work.id,
      work.version,
      { assetId: secondId, alt: '过期版本替换' },
    )).toThrow(/stale/u)

    const replaced = replaceManagedDesignSheet(
      sqlite,
      work.id,
      saved.version,
      { assetId: secondId, alt: '新版完整设定图' },
      NOW + 2,
    )
    expect(replaced.designSheet).toMatchObject({ assetId: secondId })
    expect(replaceManagedDesignSheet(
      sqlite,
      work.id,
      replaced.version,
      null,
      NOW + 3,
    )).toMatchObject({ version: 4, designSheet: null })
    expect(sqlite.prepare(`
      SELECT count(*) FROM assets WHERE role = 'design_sheet'
    `).pluck().get()).toBe(2)
    expect(JSON.stringify(saved)).not.toContain('/original/')
  })

  it('rejects a design sheet on a non-adoption work', () => {
    const work = createManagedWork(sqlite, workInput, NOW)
    const assetId = '33333333-3333-4333-8333-333333333333'
    sqlite.prepare(`
      INSERT INTO assets (
        id, role, status, private_object_key, sha256, byte_size,
        mime_type, width, height, created_at, updated_at
      ) VALUES (?, 'design_sheet', 'READY', ?, ?, 1024,
                'image/png', 3000, 2400, ?, ?)
    `).run(
      assetId,
      `test/t17-fixture/original/${assetId}/source.png`,
      'a'.repeat(64),
      NOW,
      NOW,
    )
    expect(() => replaceManagedDesignSheet(
      sqlite,
      work.id,
      work.version,
      { assetId, alt: '不应关联的设定图' },
    )).toThrow(/adoption work/u)
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
    expect(replaceStudioPhotosRequestSchema.safeParse({
      expectedVersion: 1,
      payload: {
        photos: [
          photo('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', true, '重复一'),
          photo('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', false, '重复二'),
        ],
      },
    }).success).toBe(false)
    expect(replaceDesignSheetRequestSchema.safeParse({
      expectedVersion: 1,
      payload: { designSheet: null },
    }).success).toBe(true)

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
    )).toThrow(/role, status or work ownership/u)
  })
})
