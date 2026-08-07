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
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import {
  attachReturnPhotoAsset,
  checkReturnPhotoPublication,
  createReturnPhoto,
  deleteReturnPhotoDraft,
  getReturnPhoto,
  listAdminReturnPhotos,
  returnPhotoSummaryForWork,
  updateReturnPhoto,
} from '../../server/utils/service/return-photo'
import { deleteManagedWork } from '../../server/utils/service/work-management'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const NOW = Date.UTC(2026, 7, 7)
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

let directory: string
let sqlite: Database.Database

function insertUser() {
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
}

function insertWork(id: string, slug: string, status: string) {
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, suit_type, purpose, owner_display,
      publication_status, sort_order, version, published_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, '犬科', 'full', 'showcase', '不公开', ?, 0, 1, ?, ?, ?)
  `).run(
    id,
    slug,
    `角色-${slug}`,
    status,
    status === 'published' ? NOW : null,
    NOW,
    NOW,
  )
  return id
}

function insertReturnAsset(
  assetId: string,
  overrides: Partial<{ status: string, width: number, height: number }> = {},
) {
  const sha = assetId.replaceAll(/[^0-9a-f]/gu, 'a').padEnd(64, 'b').slice(0, 64)
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, 'return_photo', ?, ?, ?, 2048, 'image/jpeg', ?, ?, ?, ?)
  `).run(
    assetId,
    overrides.status ?? 'READY',
    `test/return-fixture/original/${assetId}/source.jpg`,
    sha,
    overrides.width ?? 1139,
    overrides.height ?? 2083,
    NOW,
    NOW,
  )
  return assetId
}

const emptyAuthorization = {
  confirmedAt: null,
  note: null,
  source: null,
}

function draftFor(workId: string, alt = '虾片在展会现场的返图') {
  return createReturnPhoto(sqlite, {
    alt,
    authorization: emptyAuthorization,
    sortOrder: 0,
    workId,
  }, NOW)
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-return-'))
  const databaseFile = resolve(directory, 'return.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  insertUser()
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('T35 return photo domain model', () => {
  it('creates a draft without an image and keeps one record per photo', () => {
    const workId = insertWork('11111111-1111-4111-8111-111111111111', 'tuan-zi', 'published')
    const draft = draftFor(workId)

    expect(draft.publicationStatus).toBe('draft')
    expect(draft.asset).toBeNull()
    expect(draft.work.characterName).toBe('角色-tuan-zi')
    expect(draft.publicVariantCount).toBe(0)

    const assetId = insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    const attached = attachReturnPhotoAsset(
      sqlite,
      draft.id,
      draft.version,
      assetId,
      NOW,
    )
    expect(attached.asset).toEqual({
      assetId,
      height: 2083,
      mimeType: 'image/jpeg',
      status: 'READY',
      width: 1139,
    })

    // 同一张资产不能被第二条返图占用：一图一记录，不会长成相册。
    const second = draftFor(workId, '另一张返图')
    expect(() => attachReturnPhotoAsset(
      sqlite,
      second.id,
      second.version,
      assetId,
      NOW,
    )).toThrow(/already used by another return photo/)
  })

  it('rejects illegal work and asset relations', () => {
    const workId = insertWork('11111111-1111-4111-8111-111111111111', 'tuan-zi', 'published')

    expect(() => createReturnPhoto(sqlite, {
      alt: '关联不存在的作品',
      authorization: emptyAuthorization,
      sortOrder: 0,
      workId: '99999999-9999-4999-8999-999999999999',
    }, NOW)).toThrow(/Linked work was not found/)

    const draft = draftFor(workId)

    // 非 return_photo 角色不能当返图图片。
    sqlite.prepare(`
      INSERT INTO assets (
        id, role, status, private_object_key, sha256, byte_size,
        mime_type, width, height, created_at, updated_at
      ) VALUES (
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'studio_photo', 'READY',
        'test/return-fixture/original/studio/source.jpg',
        'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        2048, 'image/jpeg', 1600, 900, ?, ?
      )
    `).run(NOW, NOW)
    expect(() => attachReturnPhotoAsset(
      sqlite,
      draft.id,
      draft.version,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      NOW,
    )).toThrow(/media role does not match/i)

    // PENDING 资产不能绑定。
    const pending = insertReturnAsset('dddddddd-dddd-4ddd-8ddd-dddddddddddd', {
      status: 'PENDING',
    })
    expect(() => attachReturnPhotoAsset(
      sqlite,
      draft.id,
      draft.version,
      pending,
      NOW,
    )).toThrow(/not ready/i)
  })

  it('rejects stale versions instead of silently overwriting', () => {
    const workId = insertWork('11111111-1111-4111-8111-111111111111', 'tuan-zi', 'published')
    const draft = draftFor(workId)

    const updated = updateReturnPhoto(sqlite, draft.id, draft.version, {
      alt: '更新后的说明',
      authorization: emptyAuthorization,
      sortOrder: 3,
      workId,
    }, NOW)
    expect(updated.version).toBe(draft.version + 1)
    expect(updated.sortOrder).toBe(3)

    expect(() => updateReturnPhoto(sqlite, draft.id, draft.version, {
      alt: '用旧版本覆盖',
      authorization: emptyAuthorization,
      sortOrder: 9,
      workId,
    }, NOW)).toThrow(/version is stale/i)
    expect(getReturnPhoto(sqlite, draft.id).alt).toBe('更新后的说明')
  })

  it('keeps optional authorization records private to the admin DTO', () => {
    const workId = insertWork('11111111-1111-4111-8111-111111111111', 'tuan-zi', 'published')
    const draft = draftFor(workId)
    const saved = updateReturnPhoto(sqlite, draft.id, draft.version, {
      alt: '带授权记录的返图',
      authorization: {
        confirmedAt: new Date(NOW).toISOString(),
        note: '在 QQ 群里确认可以公开',
        source: 'qq',
      },
      sortOrder: 0,
      workId,
    }, NOW)

    expect(saved.authorization).toEqual({
      confirmedAt: new Date(NOW).toISOString(),
      note: '在 QQ 群里确认可以公开',
      source: 'qq',
    })

    // 授权记录缺失不阻止发布：它不出现在阻断项里。
    const assetId = insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    attachReturnPhotoAsset(sqlite, saved.id, saved.version, assetId, NOW)
    const cleared = getReturnPhoto(sqlite, saved.id)
    const withoutAuthorization = updateReturnPhoto(
      sqlite,
      cleared.id,
      cleared.version,
      {
        alt: cleared.alt,
        authorization: emptyAuthorization,
        sortOrder: cleared.sortOrder,
        workId,
      },
      NOW,
    )
    expect(withoutAuthorization.authorization).toEqual(emptyAuthorization)
    expect(checkReturnPhotoPublication(sqlite, cleared.id).blockers)
      .not.toContain('RETURN_PHOTO_ALT_REQUIRED')
  })

  it('blocks publication until the work is published and an image exists', () => {
    const draftWorkId = insertWork('11111111-1111-4111-8111-111111111111', 'draft-work', 'draft')
    const draft = draftFor(draftWorkId)

    const noImage = checkReturnPhotoPublication(sqlite, draft.id)
    expect(noImage.canPublish).toBe(false)
    expect(noImage.blockers).toContain('RETURN_PHOTO_WORK_NOT_PUBLISHED')
    expect(noImage.blockers).toContain('RETURN_PHOTO_ASSET_REQUIRED')

    const assetId = insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    attachReturnPhotoAsset(sqlite, draft.id, draft.version, assetId, NOW)
    const stillBlocked = checkReturnPhotoPublication(sqlite, draft.id)
    expect(stillBlocked.canPublish).toBe(false)
    expect(stillBlocked.blockers).toEqual(['RETURN_PHOTO_WORK_NOT_PUBLISHED'])
    // 缺失公开变体不是阻断项：变体正是发布 operation 生成的。
    expect(stillBlocked.missingVariantCount).toBe(6)
    expect(stillBlocked.requiredVariantCount).toBe(6)

    sqlite.prepare(`
      UPDATE works SET publication_status = 'published', published_at = ?
      WHERE id = ?
    `).run(NOW, draftWorkId)
    const ready = checkReturnPhotoPublication(sqlite, draft.id)
    expect(ready.canPublish).toBe(true)
    expect(ready.blockers).toEqual([])
  })

  it('blocks sources narrower than the smallest public width', () => {
    const workId = insertWork('11111111-1111-4111-8111-111111111111', 'tuan-zi', 'published')
    const draft = draftFor(workId)
    const narrow = insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', {
      height: 600,
      width: 320,
    })
    attachReturnPhotoAsset(sqlite, draft.id, draft.version, narrow, NOW)

    const check = checkReturnPhotoPublication(sqlite, draft.id)
    expect(check.canPublish).toBe(false)
    expect(check.blockers).toContain('RETURN_PHOTO_SOURCE_TOO_SMALL')
    expect(check.requiredVariantCount).toBe(0)
  })

  it('derives the public width ladder from the source width', () => {
    const workId = insertWork('11111111-1111-4111-8111-111111111111', 'tuan-zi', 'published')
    const narrow = draftFor(workId, '只够 480 宽的返图')
    attachReturnPhotoAsset(
      sqlite,
      narrow.id,
      narrow.version,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', {
        height: 900,
        width: 600,
      }),
      NOW,
    )
    expect(checkReturnPhotoPublication(sqlite, narrow.id).requiredVariantCount)
      .toBe(2)

    const wide = draftFor(workId, '足够宽的返图')
    attachReturnPhotoAsset(
      sqlite,
      wide.id,
      wide.version,
      insertReturnAsset('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', {
        height: 2400,
        width: 1600,
      }),
      NOW,
    )
    expect(checkReturnPhotoPublication(sqlite, wide.id).requiredVariantCount)
      .toBe(6)
  })

  it('paginates the admin list and filters by work and status', () => {
    const first = insertWork('11111111-1111-4111-8111-111111111111', 'work-one', 'published')
    const second = insertWork('22222222-2222-4222-8222-222222222222', 'work-two', 'published')
    for (let index = 0; index < 3; index += 1) {
      createReturnPhoto(sqlite, {
        alt: `第一件作品的返图 ${index}`,
        authorization: emptyAuthorization,
        sortOrder: index,
        workId: first,
      }, NOW)
    }
    createReturnPhoto(sqlite, {
      alt: '第二件作品的返图',
      authorization: emptyAuthorization,
      sortOrder: 0,
      workId: second,
    }, NOW)

    const all = listAdminReturnPhotos(sqlite)
    expect(all.resultCount).toBe(4)
    expect(all.page).toBe(1)
    expect(all.pageCount).toBe(1)

    const byWork = listAdminReturnPhotos(sqlite, { workId: second })
    expect(byWork.resultCount).toBe(1)
    expect(byWork.items[0]!.work.slug).toBe('work-two')

    const drafts = listAdminReturnPhotos(sqlite, {
      publicationStatus: 'draft',
    })
    expect(drafts.resultCount).toBe(4)
    expect(listAdminReturnPhotos(sqlite, {
      publicationStatus: 'published',
    }).resultCount).toBe(0)
  })

  it('blocks permanent work deletion while return photos are linked', async () => {
    const workId = insertWork('11111111-1111-4111-8111-111111111111', 'tuan-zi', 'draft')
    const draft = draftFor(workId)
    const storage = new FakeMediaStorage()

    await expect(deleteManagedWork(
      sqlite,
      storage,
      workId,
      1,
      USER_ID,
      NOW,
    )).rejects.toThrow(/linked return photos/i)

    expect(returnPhotoSummaryForWork(sqlite, workId))
      .toEqual({ publishedCount: 0, totalCount: 1 })

    deleteReturnPhotoDraft(sqlite, draft.id, draft.version)
    expect(returnPhotoSummaryForWork(sqlite, workId))
      .toEqual({ publishedCount: 0, totalCount: 0 })
    await expect(deleteManagedWork(
      sqlite,
      storage,
      workId,
      1,
      USER_ID,
      NOW,
    )).resolves.toMatchObject({ id: workId })
  })

  it('enforces the one-asset-per-return database constraints', () => {
    const workId = insertWork('11111111-1111-4111-8111-111111111111', 'tuan-zi', 'published')
    const draft = draftFor(workId)
    const assetId = insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    attachReturnPhotoAsset(sqlite, draft.id, draft.version, assetId, NOW)

    // 直接写库也不能把同一资产分给两条返图。
    expect(() => sqlite.prepare(`
      INSERT INTO return_photos (
        id, work_id, asset_id, alt, sort_order, publication_status,
        version, created_at, updated_at
      ) VALUES (
        '33333333-3333-4333-8333-333333333333', ?, ?, '重复占用', 0,
        'draft', 1, ?, ?
      )
    `).run(workId, assetId, NOW, NOW)).toThrow(/UNIQUE constraint failed/)

    // 已发布返图不能直接改关联作品或图片。
    sqlite.prepare(`
      UPDATE return_photos SET publication_status = 'published', published_at = ?
      WHERE id = ?
    `).run(NOW, draft.id)
    const other = insertWork('22222222-2222-4222-8222-222222222222', 'work-two', 'published')
    expect(() => sqlite.prepare(`
      UPDATE return_photos SET work_id = ? WHERE id = ?
    `).run(other, draft.id)).toThrow(/require unpublishing first/)

    // 发布状态的返图不能落在未发布作品上。
    const unpublished = insertWork('44444444-4444-4444-8444-444444444444', 'work-three', 'draft')
    expect(() => sqlite.prepare(`
      INSERT INTO return_photos (
        id, work_id, asset_id, alt, sort_order, publication_status,
        version, published_at, created_at, updated_at
      ) VALUES (
        '55555555-5555-4555-8555-555555555555', ?, NULL, '未发布作品', 0,
        'published', 1, ?, ?, ?
      )
    `).run(unpublished, NOW, NOW, NOW)).toThrow(/published_asset|published work/)
  })
})
