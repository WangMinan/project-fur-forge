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
import { createSyntheticSourcePng } from '../../scripts/oss-preflight-core.mjs'
import {
  addReturnPhotoFromUpload,
  checkReturnPhotoPublication,
  createReturnCharacter,
  deleteEmptyReturnCharacter,
  deleteReturnPhotoDraft,
  getReturnCharacter,
  listAdminReturnCharacters,
  returnPhotoSummaryForCharacter,
  setReturnCharacterPrimaryPhoto,
  updateReturnCharacter,
  updateReturnPhoto,
} from '../../server/utils/service/return-photo'
import { findReturnCharacter } from '../../server/utils/repository/return-photo-repository'
import {
  deleteReturnCharacterCascade,
  publishReturnPhoto,
  retryReturnPhotoCleanup,
  unpublishReturnPhoto,
} from '../../server/utils/runner/return-photo-publication'
import { setPublicMediaCacheForTests } from '../../server/utils/public-media-cache'
import { deleteManagedWork } from '../../server/utils/service/work-management'
import { FakeMediaStorage } from '../helpers/fake-media-storage'
import { FakePublicMediaCache } from '../helpers/fake-public-media-cache'

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
  overrides: Partial<{
    environmentPrefix: string
    height: number
    status: string
    width: number
  }> = {},
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
    `${overrides.environmentPrefix ?? 'test/return-fixture'}/original/${assetId}/source.jpg`,
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

function characterFor(
  name = '天暮',
  slug = 'tianmu',
  workId: string | null = null,
) {
  return createReturnCharacter(sqlite, {
    authorization: emptyAuthorization,
    name,
    nickname: null,
    slug,
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
  setPublicMediaCacheForTests()
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('T35-F1 return character domain model', () => {
  it('holds many photos per character and auto-picks the first as cover', () => {
    const character = characterFor()
    expect(character.photos).toEqual([])
    expect(character.work).toBeNull()

    const first = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      NOW,
    )
    expect(first.primary).toBe(true)
    expect(first.asset).toEqual({
      assetId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      height: 2083,
      mimeType: 'image/jpeg',
      status: 'READY',
      width: 1139,
    })

    // 第二张横版返图与第一张竖版共存：一个设定可以有多张，横竖混放。
    const second = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', {
        height: 900,
        width: 1600,
      }),
      NOW,
    )
    expect(second.primary).toBe(false)

    const loaded = getReturnCharacter(sqlite, character.id)
    expect(loaded.photos).toHaveLength(2)
    // 主图排在最前，公开设定页据此取圆形头像。
    expect(loaded.photos[0]!.id).toBe(first.id)
  })

  it('publishes return photos without requiring any work', () => {
    // 完全不关联作品：老作品没上过架、甚至没建作品记录，也可以有返图。
    const character = characterFor()
    const photo = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      NOW,
    )

    const check = checkReturnPhotoPublication(sqlite, photo.id)
    expect(check.canPublish).toBe(true)
    expect(check.blockers).toEqual([])
  })

  it('publishes return photos linked to an unpublished work', () => {
    const workId = insertWork(
      '11111111-1111-4111-8111-111111111111',
      'draft-work',
      'draft',
    )
    const character = characterFor('牛肉包子', 'niurou', workId)
    const photo = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      NOW,
    )

    // 关联作品未发布不再阻断返图发布。
    expect(checkReturnPhotoPublication(sqlite, photo.id).canPublish).toBe(true)

    // 数据库层也不再阻止：published 返图不要求 published 作品。
    expect(() => sqlite.prepare(`
      UPDATE return_photos SET publication_status = 'published', published_at = ?
      WHERE id = ?
    `).run(NOW, photo.id)).not.toThrow()
  })

  it('blocks publication until an image and alt exist', () => {
    const character = characterFor()
    const photo = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      NOW,
    )
    // 缺失公开变体不是阻断项：变体正是发布 operation 生成的。
    const ready = checkReturnPhotoPublication(sqlite, photo.id)
    expect(ready.missingVariantCount).toBe(6)
    expect(ready.requiredVariantCount).toBe(6)
    expect(ready.canPublish).toBe(true)

    // 无图草稿（直接写库模拟上传未完成）必须被阻断。
    sqlite.prepare(`
      INSERT INTO return_photos (
        id, character_id, asset_id, alt, is_primary, publication_status,
        version, created_at, updated_at
      ) VALUES (
        '33333333-3333-4333-8333-333333333333', ?, NULL, '还没有图', 0,
        'draft', 1, ?, ?
      )
    `).run(character.id, NOW, NOW)
    const noImage = checkReturnPhotoPublication(
      sqlite,
      '33333333-3333-4333-8333-333333333333',
    )
    expect(noImage.canPublish).toBe(false)
    expect(noImage.blockers).toEqual(['RETURN_PHOTO_ASSET_REQUIRED'])
  })

  it('rejects stale versions instead of silently overwriting', () => {
    const character = characterFor()
    const updated = updateReturnCharacter(sqlite, character.id, character.version, {
      authorization: emptyAuthorization,
      name: '天暮改名',
      nickname: '暮暮',
      slug: 'tianmu',
      workId: null,
    }, NOW)
    expect(updated.version).toBe(character.version + 1)
    expect(updated.nickname).toBe('暮暮')

    expect(() => updateReturnCharacter(sqlite, character.id, character.version, {
      authorization: emptyAuthorization,
      name: '用旧版本覆盖',
      nickname: null,
      slug: 'tianmu',
      workId: null,
    }, NOW)).toThrow(/version is stale/i)
    expect(getReturnCharacter(sqlite, character.id).name).toBe('天暮改名')
  })

  it('keeps optional authorization records private to the admin DTO', () => {
    const character = characterFor()
    const saved = updateReturnCharacter(sqlite, character.id, character.version, {
      authorization: {
        confirmedAt: new Date(NOW).toISOString(),
        note: '在 QQ 群里确认可以公开',
        source: 'qq',
      },
      name: character.name,
      nickname: null,
      slug: character.slug,
      workId: null,
    }, NOW)
    expect(saved.authorization).toEqual({
      confirmedAt: new Date(NOW).toISOString(),
      note: '在 QQ 群里确认可以公开',
      source: 'qq',
    })

    // 授权记录缺失不阻止发布：它不出现在阻断项里。
    const photo = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      NOW,
    )
    const cleared = updateReturnCharacter(sqlite, saved.id, saved.version, {
      authorization: emptyAuthorization,
      name: saved.name,
      nickname: null,
      slug: saved.slug,
      workId: null,
    }, NOW)
    expect(cleared.authorization).toEqual(emptyAuthorization)
    expect(checkReturnPhotoPublication(sqlite, photo.id).canPublish).toBe(true)
  })

  it('rejects duplicate slugs and unknown linked works', () => {
    characterFor()
    expect(() => characterFor('另一个设定', 'tianmu')).toThrow(/slug is already/i)
    expect(() => characterFor(
      '关联不存在的作品',
      'unknown-work',
      '99999999-9999-4999-8999-999999999999',
    )).toThrow(/Linked work was not found/)
  })

  it('moves the cover between photos and backfills it on delete', () => {
    const character = characterFor()
    const first = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      NOW,
    )
    const second = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
      NOW,
    )

    const moved = setReturnCharacterPrimaryPhoto(sqlite, second.id, second.version, NOW)
    expect(moved.photos.find(photo => photo.id === second.id)!.primary).toBe(true)
    expect(moved.photos.find(photo => photo.id === first.id)!.primary).toBe(false)

    // 删掉主图后，剩下那张自动补位，设定页不会失去圆形头像。
    const current = moved.photos.find(photo => photo.id === second.id)!
    deleteReturnPhotoDraft(sqlite, current.id, current.version, NOW)
    const after = getReturnCharacter(sqlite, character.id)
    expect(after.photos).toHaveLength(1)
    expect(after.photos[0]!.primary).toBe(true)
  })

  it('rejects sources narrower than the smallest public width', () => {
    const character = characterFor()
    const photo = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', {
        height: 600,
        width: 320,
      }),
      NOW,
    )
    const check = checkReturnPhotoPublication(sqlite, photo.id)
    expect(check.canPublish).toBe(false)
    expect(check.blockers).toContain('RETURN_PHOTO_SOURCE_TOO_SMALL')
    expect(check.requiredVariantCount).toBe(0)
  })

  it('derives the public width ladder from the source width', () => {
    const character = characterFor()
    const narrow = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', {
        height: 900,
        width: 600,
      }),
      NOW,
    )
    expect(checkReturnPhotoPublication(sqlite, narrow.id).requiredVariantCount)
      .toBe(2)

    const wide = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', {
        height: 2400,
        width: 1600,
      }),
      NOW,
    )
    expect(checkReturnPhotoPublication(sqlite, wide.id).requiredVariantCount)
      .toBe(6)
  })

  it('paginates the admin character list and finds by name', () => {
    for (let index = 0; index < 3; index += 1) {
      characterFor(`设定 ${index}`, `character-${index}`)
    }
    characterFor('牛肉包子', 'niurou')

    const all = listAdminReturnCharacters(sqlite)
    expect(all.resultCount).toBe(4)
    expect(all.page).toBe(1)
    expect(all.pageCount).toBe(1)

    const paged = listAdminReturnCharacters(sqlite, { page: 2, pageSize: 3 })
    expect(paged.items).toHaveLength(1)
    expect(paged.pageCount).toBe(2)

    const found = listAdminReturnCharacters(sqlite, { query: '牛肉' })
    expect(found.resultCount).toBe(1)
    expect(found.items[0]!.slug).toBe('niurou')
  })

  it('reports photo counts and refuses to delete a non-empty character', () => {
    const character = characterFor()
    const photo = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      NOW,
    )
    expect(returnPhotoSummaryForCharacter(sqlite, character.id))
      .toEqual({ publishedCount: 0, totalCount: 1 })

    // 底层的「只删空设定」入口仍然保护数据：连图删除由 runner 负责，
    // 它会先删返图再调用这里。
    const current = getReturnCharacter(sqlite, character.id)
    expect(() => deleteEmptyReturnCharacter(
      sqlite,
      character.id,
      current.version,
    )).toThrow(/Remove the return photos/i)

    deleteReturnPhotoDraft(sqlite, photo.id, photo.version, NOW)
    expect(returnPhotoSummaryForCharacter(sqlite, character.id))
      .toEqual({ publishedCount: 0, totalCount: 0 })
    expect(deleteEmptyReturnCharacter(
      sqlite,
      character.id,
      getReturnCharacter(sqlite, character.id).version,
    )).toEqual({ id: character.id })
  })

  it('deletes a character together with all of its photos', async () => {
    const character = characterFor()
    addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      NOW,
    )
    const second = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
      NOW,
    )
    // 一张已发布：级联删除必须先把它下架，不能留下公开可读的图片。
    sqlite.prepare(`
      UPDATE return_photos SET publication_status = 'published', published_at = ?
      WHERE id = ?
    `).run(NOW, second.id)

    const latest = getReturnCharacter(sqlite, character.id)
    await expect(deleteReturnCharacterCascade(
      sqlite,
      new FakeMediaStorage(),
      character.id,
      latest.version,
      USER_ID,
      NOW,
    )).resolves.toEqual({ id: character.id })

    expect(findReturnCharacter(sqlite, character.id)).toBeUndefined()
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM return_photos')
      .get()).toEqual({ total: 0 })
    // 私有永久原图保留：删除设定不碰 assets。
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM assets')
      .get()).toEqual({ total: 2 })
  })

  it('keeps a failed return-photo purge retryable before cascade deletion', async () => {
    const character = characterFor()
    const assetId = insertReturnAsset(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      { environmentPrefix: 'prod' },
    )
    const photo = addReturnPhotoFromUpload(sqlite, character.id, assetId, NOW)
    sqlite.prepare(`
      UPDATE return_photos
      SET publication_status = 'published', published_at = ?
      WHERE id = ?
    `).run(NOW, photo.id)
    const objectKey = `prod/web/returns/${photo.id}/return-wall-480.webp`
    const inputSha = sqlite.prepare(`
      SELECT sha256 FROM assets WHERE id = ?
    `).pluck().get(assetId) as string
    sqlite.prepare(`
      INSERT INTO asset_variants (
        id, asset_id, storage_scope, status, object_key, input_sha256,
        media_role, usage, width, height, format, quality, crop_identity,
        recipe_version, protection_mode, watermark_profile,
        watermark_config_digest, logo_digest, watermark_anchor,
        sha256, byte_size, created_at, updated_at
      ) VALUES (?, ?, 'PUBLIC', 'READY', ?, ?, 'return_photo', 'return-wall',
                480, 877, 'webp', 82, 'return-wall', 'return-display-v1',
                'none', 'none', 'none', 'none', 'none', ?, 10, ?, ?)
    `).run(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      assetId,
      objectKey,
      inputSha,
      'd'.repeat(64),
      NOW,
      NOW,
    )
    const cache = new FakePublicMediaCache()
    cache.submitError = true
    setPublicMediaCacheForTests(cache)
    const storage = new FakeMediaStorage()

    const result = await unpublishReturnPhoto(
      sqlite,
      storage,
      photo.id,
      photo.version,
      USER_ID,
      NOW + 1,
    )

    expect(result.returnPhoto.publicationStatus).toBe('unpublished')
    expect(result.operation).toMatchObject({
      edgePurgeFileCount: 1,
      edgePurgeStatus: 'FAILED',
      operationType: 'UNPUBLISH',
      status: 'FAILED',
    })

    const latest = getReturnCharacter(sqlite, character.id)
    await expect(deleteReturnCharacterCascade(
      sqlite,
      storage,
      character.id,
      latest.version,
      USER_ID,
      NOW + 2,
    )).rejects.toMatchObject({
      reason: 'PUBLICATION_CLEANUP_PENDING',
      statusCode: 409,
    })

    cache.submitError = false
    const retried = await retryReturnPhotoCleanup(
      sqlite,
      storage,
      result.operation.operationId,
      result.operation.version,
      USER_ID,
      NOW + 3,
    )
    expect(retried).toMatchObject({
      edgePurgeStatus: 'COMPLETE',
      status: 'DONE',
    })
    expect(cache.submittedUrls).toEqual([[
      `https://public-media.ditedog.com/${objectKey}`,
    ]])
    expect(sqlite.prepare(`
      SELECT edge_purge_task_id FROM publication_operations
      WHERE id = ?
    `).pluck().get(result.operation.operationId)).toBe('purge-task-1')

    await expect(deleteReturnCharacterCascade(
      sqlite,
      storage,
      character.id,
      latest.version,
      USER_ID,
      NOW + 4,
    )).resolves.toEqual({ id: character.id })
  })

  it('keeps a failed return-photo publish failed after cleanup retry succeeds', async () => {
    const character = characterFor()
    const assetId = insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    const photo = addReturnPhotoFromUpload(sqlite, character.id, assetId, NOW)
    const privateObjectKey = sqlite.prepare(`
      SELECT private_object_key FROM assets WHERE id = ?
    `).pluck().get(assetId) as string
    const storage = new FakeMediaStorage()
    storage.seedPrivate(
      privateObjectKey,
      createSyntheticSourcePng(1139, 2083),
      'image/png',
    )
    sqlite.exec(`
      CREATE TRIGGER test_abort_return_photo_publish
      BEFORE UPDATE OF publication_status ON return_photos
      WHEN NEW.publication_status = 'published'
      BEGIN
        SELECT RAISE(ABORT, 'test return-photo publish failure');
      END;
    `)
    storage.failDelete = true

    const failed = await publishReturnPhoto(
      sqlite,
      storage,
      photo.id,
      photo.version,
      USER_ID,
      NOW + 1,
    )
    expect(failed.returnPhoto.publicationStatus).toBe('draft')
    expect(failed.operation).toMatchObject({
      cleanupPendingCount: 6,
      failureCode: 'PUBLIC_CLEANUP_FAILED',
      failureStage: 'CLEANING_PUBLIC',
      operationType: 'PUBLISH',
      status: 'FAILED',
    })

    storage.failDelete = false
    const retried = await retryReturnPhotoCleanup(
      sqlite,
      storage,
      failed.operation.operationId,
      failed.operation.version,
      USER_ID,
      NOW + 2,
    )
    expect(retried).toMatchObject({
      cleanupPendingCount: 0,
      failureCode: 'PUBLIC_CLEANUP_FAILED',
      failureStage: 'CLEANING_PUBLIC',
      operationType: 'PUBLISH',
      status: 'FAILED',
    })
    expect(getReturnCharacter(sqlite, character.id).photos[0]).toMatchObject({
      id: photo.id,
      publicationStatus: 'draft',
    })
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE asset_id = ? AND storage_scope = 'PUBLIC'
    `).pluck().get(assetId)).toBe(0)
  })

  it('keeps return photos when the linked work is deleted', async () => {
    const workId = insertWork(
      '11111111-1111-4111-8111-111111111111',
      'tuan-zi',
      'draft',
    )
    const character = characterFor('天暮', 'tianmu', workId)
    const photo = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      NOW,
    )

    // 返图不再阻止作品永久删除：work_id 是 set null。
    await expect(deleteManagedWork(
      sqlite,
      new FakeMediaStorage(),
      workId,
      1,
      USER_ID,
      NOW,
    )).resolves.toMatchObject({ id: workId })

    const after = getReturnCharacter(sqlite, character.id)
    expect(after.work).toBeNull()
    expect(after.photos.map(item => item.id)).toEqual([photo.id])
  })

  it('enforces the database constraints for photos and covers', () => {
    const character = characterFor()
    const assetId = insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    const photo = addReturnPhotoFromUpload(sqlite, character.id, assetId, NOW)

    // 同一张私有原图不能被两条返图占用。
    expect(() => sqlite.prepare(`
      INSERT INTO return_photos (
        id, character_id, asset_id, alt, is_primary, publication_status,
        version, created_at, updated_at
      ) VALUES (
        '33333333-3333-4333-8333-333333333333', ?, ?, '重复占用', 0,
        'draft', 1, ?, ?
      )
    `).run(character.id, assetId, NOW, NOW)).toThrow(/UNIQUE constraint failed/)

    // 一个设定最多一张主图。
    const other = insertReturnAsset('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
    expect(() => sqlite.prepare(`
      INSERT INTO return_photos (
        id, character_id, asset_id, alt, is_primary, publication_status,
        version, created_at, updated_at
      ) VALUES (
        '44444444-4444-4444-8444-444444444444', ?, ?, '第二张主图', 1,
        'draft', 1, ?, ?
      )
    `).run(character.id, other, NOW, NOW)).toThrow(/UNIQUE constraint failed/)

    // 没有图片的记录不能当主图。
    expect(() => sqlite.prepare(`
      INSERT INTO return_photos (
        id, character_id, asset_id, alt, is_primary, publication_status,
        version, created_at, updated_at
      ) VALUES (
        '55555555-5555-4555-8555-555555555555', ?, NULL, '无图主图', 1,
        'draft', 1, ?, ?
      )
    `).run(character.id, NOW, NOW)).toThrow(/primary_asset/)

    // 已发布返图不能直接改归属设定或图片。
    sqlite.prepare(`
      UPDATE return_photos SET publication_status = 'published', published_at = ?
      WHERE id = ?
    `).run(NOW, photo.id)
    const second = characterFor('牛肉包子', 'niurou')
    expect(() => sqlite.prepare(`
      UPDATE return_photos SET character_id = ? WHERE id = ?
    `).run(second.id, photo.id)).toThrow(/require unpublishing first/)
  })

  it('updates a single photo alt with version checks', () => {
    const character = characterFor()
    const photo = addReturnPhotoFromUpload(
      sqlite,
      character.id,
      insertReturnAsset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      NOW,
    )
    const updated = updateReturnPhoto(sqlite, photo.id, photo.version, '展会现场的返图', NOW)
    expect(updated.alt).toBe('展会现场的返图')
    expect(() => updateReturnPhoto(sqlite, photo.id, photo.version, '旧版本', NOW))
      .toThrow(/version is stale/i)
  })
})
