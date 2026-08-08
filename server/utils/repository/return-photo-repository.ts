import type Database from 'better-sqlite3'

/**
 * T35-F1 返图仓储层：只放 SQL、行映射与条件更新（CAS）。
 *
 * 业务规则、DTO 组合与 OSS 副作用分别属于 service 与 runner，
 * 本文件不做校验，也不抛业务错误。
 *
 * 两级模型：设定 `return_characters` + 它的多张返图 `return_photos`。
 */

export interface ReturnCharacterRow {
  authorizationConfirmedAt: number | null
  authorizationNote: string | null
  authorizationSource: 'qq' | 'email' | 'other' | null
  createdAt: number
  id: string
  name: string
  nickname: string | null
  slug: string
  updatedAt: number
  version: number
  /** 关联作品可选；未关联或作品已删除时全部为 null。 */
  workCharacterName: string | null
  workId: string | null
  workPublicationStatus: 'draft' | 'published' | 'unpublished' | null
  workSlug: string | null
}

export interface ReturnPhotoRow {
  alt: string
  assetHeight: number | null
  assetId: string | null
  assetMimeType: 'image/jpeg' | 'image/png' | 'image/webp' | null
  assetStatus: 'PENDING' | 'READY' | 'FAILED' | null
  assetWidth: number | null
  characterId: string
  createdAt: number
  id: string
  primary: number
  publicationStatus: 'draft' | 'published' | 'unpublished'
  publishedAt: number | null
  updatedAt: number
  version: number
}

/**
 * 设定行 + 可选关联作品摘要。
 * 作品的私有联系人不在选择列内，因此管理 DTO 不可能顺手带出它。
 */
const selectCharacter = `
  SELECT
    character.id,
    character.slug,
    character.name,
    character.nickname,
    character.work_id AS workId,
    character.authorization_source AS authorizationSource,
    character.authorization_confirmed_at AS authorizationConfirmedAt,
    character.authorization_note AS authorizationNote,
    character.version,
    character.created_at AS createdAt,
    character.updated_at AS updatedAt,
    work.character_name AS workCharacterName,
    work.slug AS workSlug,
    work.publication_status AS workPublicationStatus
  FROM return_characters AS character
  LEFT JOIN works AS work ON work.id = character.work_id
`

/**
 * 返图行 + 资产摘要。
 * 私有 Object Key 不在选择列内。
 */
const selectPhoto = `
  SELECT
    photo.id,
    photo.character_id AS characterId,
    photo.asset_id AS assetId,
    photo.alt,
    photo.is_primary AS "primary",
    photo.publication_status AS publicationStatus,
    photo.version,
    photo.published_at AS publishedAt,
    photo.created_at AS createdAt,
    photo.updated_at AS updatedAt,
    asset.status AS assetStatus,
    asset.width AS assetWidth,
    asset.height AS assetHeight,
    asset.mime_type AS assetMimeType
  FROM return_photos AS photo
  LEFT JOIN assets AS asset
    ON asset.id = photo.asset_id AND asset.role = 'return_photo'
`

export function findReturnCharacter(sqlite: Database.Database, id: string) {
  return sqlite.prepare(`${selectCharacter} WHERE character.id = ?`)
    .get(id) as ReturnCharacterRow | undefined
}

export function findReturnCharacterBySlug(
  sqlite: Database.Database,
  slug: string,
) {
  return sqlite.prepare(`${selectCharacter} WHERE character.slug = ?`)
    .get(slug) as ReturnCharacterRow | undefined
}

export function findReturnPhoto(sqlite: Database.Database, id: string) {
  return sqlite.prepare(`${selectPhoto} WHERE photo.id = ?`)
    .get(id) as ReturnPhotoRow | undefined
}

/** 一个设定的全部返图；主图优先，其余按创建顺序稳定排列。 */
export function listReturnPhotosForCharacter(
  sqlite: Database.Database,
  characterId: string,
) {
  return sqlite.prepare(`
    ${selectPhoto} WHERE photo.character_id = ?
    ORDER BY photo.is_primary DESC, photo.created_at, photo.id
  `).all(characterId) as ReturnPhotoRow[]
}

export interface ReturnCharacterListFilter {
  limit: number
  offset: number
  /** 名称或昵称的包含匹配；未提供时不过滤。 */
  query?: string | undefined
}

function characterListConditions(filter: ReturnCharacterListFilter) {
  if (filter.query === undefined) {
    return { values: [] as unknown[], where: '' }
  }
  const pattern = `%${filter.query}%`
  return {
    values: [pattern, pattern],
    where: 'WHERE (character.name LIKE ? OR character.nickname LIKE ?)',
  }
}

export function countReturnCharacters(
  sqlite: Database.Database,
  filter: ReturnCharacterListFilter,
) {
  const { values, where } = characterListConditions(filter)
  return sqlite.prepare(`
    SELECT COUNT(*) AS total FROM return_characters AS character ${where}
  `).get(...values) as { total: number }
}

export interface ReturnCharacterListRow extends ReturnCharacterRow {
  photoCount: number
  primaryAssetId: string | null
  publishedPhotoCount: number
}

/** 列表排序：最近改动的设定在前，后接稳定 ID。 */
export function listReturnCharacters(
  sqlite: Database.Database,
  filter: ReturnCharacterListFilter,
) {
  const { values, where } = characterListConditions(filter)
  return sqlite.prepare(`
    SELECT
      character.id,
      character.slug,
      character.name,
      character.nickname,
      character.work_id AS workId,
      character.authorization_source AS authorizationSource,
      character.authorization_confirmed_at AS authorizationConfirmedAt,
      character.authorization_note AS authorizationNote,
      character.version,
      character.created_at AS createdAt,
      character.updated_at AS updatedAt,
      work.character_name AS workCharacterName,
      work.slug AS workSlug,
      work.publication_status AS workPublicationStatus,
      (
        SELECT COUNT(*) FROM return_photos
        WHERE character_id = character.id
      ) AS photoCount,
      (
        SELECT COUNT(*) FROM return_photos
        WHERE character_id = character.id
          AND publication_status = 'published'
      ) AS publishedPhotoCount,
      (
        SELECT asset_id FROM return_photos
        WHERE character_id = character.id AND is_primary = 1
      ) AS primaryAssetId
    FROM return_characters AS character
    LEFT JOIN works AS work ON work.id = character.work_id
    ${where}
    ORDER BY character.updated_at DESC, character.id
    LIMIT ? OFFSET ?
  `).all(...values, filter.limit, filter.offset) as ReturnCharacterListRow[]
}

export interface ReturnCharacterInsert {
  authorizationConfirmedAt: number | null
  authorizationNote: string | null
  authorizationSource: string | null
  id: string
  name: string
  nickname: string | null
  slug: string
  workId: string | null
}

export function insertReturnCharacter(
  sqlite: Database.Database,
  input: ReturnCharacterInsert,
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO return_characters (
      id, slug, name, nickname, work_id,
      authorization_source, authorization_confirmed_at, authorization_note,
      version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    input.id,
    input.slug,
    input.name,
    input.nickname,
    input.workId,
    input.authorizationSource,
    input.authorizationConfirmedAt,
    input.authorizationNote,
    now,
    now,
  )
}

export interface ReturnCharacterUpdate {
  authorizationConfirmedAt: number | null
  authorizationNote: string | null
  authorizationSource: string | null
  name: string
  nickname: string | null
  slug: string
  workId: string | null
}

/** 条件更新：版本不匹配时返回 0，调用方转 409，不猜测新版本。 */
export function updateReturnCharacterRow(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  input: ReturnCharacterUpdate,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE return_characters
    SET slug = ?, name = ?, nickname = ?, work_id = ?,
        authorization_source = ?, authorization_confirmed_at = ?,
        authorization_note = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?
  `).run(
    input.slug,
    input.name,
    input.nickname,
    input.workId,
    input.authorizationSource,
    input.authorizationConfirmedAt,
    input.authorizationNote,
    now,
    id,
    expectedVersion,
  ).changes
}

export function deleteReturnCharacterRow(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
) {
  return sqlite.prepare(`
    DELETE FROM return_characters WHERE id = ? AND version = ?
  `).run(id, expectedVersion).changes
}

export function countReturnPhotosForCharacter(
  sqlite: Database.Database,
  characterId: string,
) {
  return sqlite.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN publication_status = 'published' THEN 1 ELSE 0 END)
        AS published
    FROM return_photos WHERE character_id = ?
  `).get(characterId) as { published: number | null, total: number }
}

/** 设定的公开可见性只看它自己的返图，不看关联作品。 */
export function countPublishedReturnPhotosForCharacter(
  sqlite: Database.Database,
  characterId: string,
) {
  return (sqlite.prepare(`
    SELECT COUNT(*) AS total FROM return_photos
    WHERE character_id = ? AND publication_status = 'published'
  `).get(characterId) as { total: number }).total
}

export function slugTakenByOther(
  sqlite: Database.Database,
  slug: string,
  excludeId: string | null,
) {
  return Boolean(sqlite.prepare(`
    SELECT 1 FROM return_characters
    WHERE slug = ? AND (? IS NULL OR id != ?)
    LIMIT 1
  `).pluck().get(slug, excludeId, excludeId))
}

export interface ReturnPhotoInsert {
  alt: string
  /** 新建时为 null：图片随后通过设定归属的上传会话补齐。 */
  assetId: string | null
  characterId: string
  id: string
}

export function insertReturnPhoto(
  sqlite: Database.Database,
  input: ReturnPhotoInsert,
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO return_photos (
      id, character_id, asset_id, alt, is_primary, publication_status,
      version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, 'draft', 1, ?, ?)
  `).run(
    input.id,
    input.characterId,
    input.assetId,
    input.alt,
    now,
    now,
  )
}

export function updateReturnPhotoAlt(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  alt: string,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE return_photos
    SET alt = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?
  `).run(alt, now, id, expectedVersion).changes
}

/** 替换返图图片：只允许非 published 记录，由 SQL 条件兜住。 */
export function updateReturnPhotoAsset(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  assetId: string,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE return_photos
    SET asset_id = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND version = ? AND publication_status != 'published'
  `).run(assetId, now, id, expectedVersion).changes
}

/**
 * 切换设定主图。先清空该设定的旧主图再设置新主图，
 * 因此 `return_photos_primary_unique` 部分唯一索引不会被瞬时违反。
 * 调用方负责放在同一个事务里。
 */
export function clearCharacterPrimary(
  sqlite: Database.Database,
  characterId: string,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE return_photos
    SET is_primary = 0, version = version + 1, updated_at = ?
    WHERE character_id = ? AND is_primary = 1
  `).run(now, characterId).changes
}

export function setReturnPhotoPrimary(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE return_photos
    SET is_primary = 1, version = version + 1, updated_at = ?
    WHERE id = ? AND version = ? AND asset_id IS NOT NULL
  `).run(now, id, expectedVersion).changes
}

/** 该设定里下一个可当主图的返图：用于删除主图后自动补位。 */
export function findPrimaryCandidate(
  sqlite: Database.Database,
  characterId: string,
  excludePhotoId: string,
) {
  return sqlite.prepare(`
    SELECT id, version FROM return_photos
    WHERE character_id = ? AND id != ? AND asset_id IS NOT NULL
    ORDER BY created_at, id
    LIMIT 1
  `).get(characterId, excludePhotoId) as
    { id: string, version: number } | undefined
}

export function publishReturnPhotoRow(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE return_photos
    SET publication_status = 'published', published_at = ?,
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ? AND publication_status != 'published'
  `).run(now, now, id, expectedVersion).changes
}

/** 下架保留 published_at 历史值，与作品下架语义一致。 */
export function unpublishReturnPhotoRow(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE return_photos
    SET publication_status = 'unpublished',
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ? AND publication_status = 'published'
  `).run(now, id, expectedVersion).changes
}

export function deleteReturnPhotoRow(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
) {
  return sqlite.prepare(`
    DELETE FROM return_photos
    WHERE id = ? AND version = ? AND publication_status != 'published'
  `).run(id, expectedVersion).changes
}

/** 设定被编辑后 bump 版本：上传会话归属校验依赖它。 */
export function touchReturnCharacter(
  sqlite: Database.Database,
  id: string,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE return_characters SET updated_at = ? WHERE id = ?
  `).run(now, id).changes
}

/**
 * 返图 operation 复用 publication_operations 表与其 lease/heartbeat 列，
 * 只用 entity_type='RETURN_PHOTO' 区分，不新建第二套任务状态机。
 */
export function hasActiveReturnPhotoOperation(
  sqlite: Database.Database,
  returnPhotoId: string,
) {
  return Boolean(sqlite.prepare(`
    SELECT 1 FROM publication_operations
    WHERE entity_type = 'RETURN_PHOTO' AND entity_id = ?
      AND status NOT IN ('FAILED', 'DONE')
    LIMIT 1
  `).pluck().get(returnPhotoId))
}

export function insertReturnPhotoOperation(
  sqlite: Database.Database,
  input: {
    id: string
    requestedVersion: number
    returnPhotoId: string
    status: string
    type: 'PUBLISH' | 'UNPUBLISH'
  },
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO publication_operations (
      id, operation_type, entity_type, entity_id, requested_version,
      status, started_at, updated_at
    ) VALUES (?, ?, 'RETURN_PHOTO', ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.type,
    input.returnPhotoId,
    input.requestedVersion,
    input.status,
    now,
    now,
  )
}

export function findDoneReturnPhotoOperation(
  sqlite: Database.Database,
  returnPhotoId: string,
  requestedVersion: number,
  operationType: 'PUBLISH' | 'UNPUBLISH',
) {
  return sqlite.prepare(`
    SELECT id FROM publication_operations
    WHERE entity_type = 'RETURN_PHOTO' AND entity_id = ?
      AND requested_version = ? AND operation_type = ? AND status = 'DONE'
    ORDER BY started_at DESC LIMIT 1
  `).get(returnPhotoId, requestedVersion, operationType) as
    { id: string } | undefined
}

export function findReturnPhotoOperationType(
  sqlite: Database.Database,
  operationId: string,
) {
  return sqlite.prepare(`
    SELECT operation_type FROM publication_operations
    WHERE id = ? AND entity_type = 'RETURN_PHOTO'
  `).pluck().get(operationId) as string | undefined
}

/** 该返图当前引用的公开对象 Key；下架与失败清理都按精确清单执行。 */
export function findReturnPhotoPublicKeys(
  sqlite: Database.Database,
  returnPhotoId: string,
  readyOnly = false,
) {
  return sqlite.prepare(`
    SELECT variant.object_key
    FROM asset_variants AS variant
    JOIN return_photos AS photo ON photo.asset_id = variant.asset_id
    WHERE photo.id = ? AND variant.storage_scope = 'PUBLIC'
      AND variant.usage = 'return-wall'
      AND variant.recipe_version = 'return-display-v1'
      ${readyOnly ? "AND variant.status = 'READY'" : ''}
    ORDER BY variant.object_key
  `).pluck().all(returnPhotoId) as string[]
}

/**
 * 返图审计记录。只记录动作与结果，不写 alt、授权正文、私有 Key 或联系人。
 */
export function insertReturnPhotoAuditLog(
  sqlite: Database.Database,
  input: {
    action: string
    actorUserId: string
    id: string
    result: 'SUCCESS' | 'FAILURE'
    returnPhotoId: string
  },
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, entity_type, entity_id, result, created_at
    ) VALUES (?, ?, ?, 'RETURN_PHOTO', ?, ?, ?)
  `).run(
    input.id,
    input.actorUserId,
    input.action,
    input.returnPhotoId,
    input.result,
    now,
  )
}

export function findAssetForReturnPhoto(
  sqlite: Database.Database,
  assetId: string,
) {
  return sqlite.prepare(`
    SELECT id, role, status, width, height, byte_size AS byteSize,
           mime_type AS mimeType
    FROM assets WHERE id = ?
  `).get(assetId) as {
    byteSize: number
    height: number
    id: string
    mimeType: string
    role: string
    status: string
    width: number
  } | undefined
}

export function findReturnPhotoIdByAsset(
  sqlite: Database.Database,
  assetId: string,
) {
  return sqlite.prepare(`
    SELECT id FROM return_photos WHERE asset_id = ?
  `).get(assetId) as { id: string } | undefined
}
