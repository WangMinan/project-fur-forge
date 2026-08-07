import type Database from 'better-sqlite3'

/**
 * T35 返图仓储层：只放 SQL、行映射与条件更新（CAS）。
 *
 * 业务规则、DTO 组合与 OSS 副作用分别属于 service 与 runner，
 * 本文件不做校验，也不抛业务错误。
 */

export interface ReturnPhotoRow {
  alt: string
  assetId: string
  assetHeight: number | null
  assetMimeType: 'image/jpeg' | 'image/png' | 'image/webp' | null
  assetStatus: 'PENDING' | 'READY' | 'FAILED' | null
  assetWidth: number | null
  authorizationConfirmedAt: number | null
  authorizationNote: string | null
  authorizationSource: 'qq' | 'email' | 'other' | null
  createdAt: number
  id: string
  publicationStatus: 'draft' | 'published' | 'unpublished'
  publishedAt: number | null
  sortOrder: number
  updatedAt: number
  version: number
  workCharacterName: string
  workId: string
  workPublicationStatus: 'draft' | 'published' | 'unpublished'
  workSlug: string
}

/**
 * 返图行 + 关联作品与资产摘要。
 * 私有 Object Key 不在选择列内，因此管理 DTO 不可能顺手带出它。
 */
const selectReturnPhoto = `
  SELECT
    photo.id,
    photo.work_id AS workId,
    photo.asset_id AS assetId,
    photo.alt,
    photo.sort_order AS sortOrder,
    photo.publication_status AS publicationStatus,
    photo.authorization_source AS authorizationSource,
    photo.authorization_confirmed_at AS authorizationConfirmedAt,
    photo.authorization_note AS authorizationNote,
    photo.version,
    photo.published_at AS publishedAt,
    photo.created_at AS createdAt,
    photo.updated_at AS updatedAt,
    work.character_name AS workCharacterName,
    work.slug AS workSlug,
    work.publication_status AS workPublicationStatus,
    asset.status AS assetStatus,
    asset.width AS assetWidth,
    asset.height AS assetHeight,
    asset.mime_type AS assetMimeType
  FROM return_photos AS photo
  JOIN works AS work ON work.id = photo.work_id
  LEFT JOIN assets AS asset
    ON asset.id = photo.asset_id AND asset.role = 'return_photo'
`

export function findReturnPhoto(sqlite: Database.Database, id: string) {
  return sqlite.prepare(`${selectReturnPhoto} WHERE photo.id = ?`)
    .get(id) as ReturnPhotoRow | undefined
}

export interface ReturnPhotoListFilter {
  limit: number
  offset: number
  publicationStatus?: string | undefined
  workId?: string | undefined
}

function listConditions(filter: ReturnPhotoListFilter) {
  const clauses: string[] = []
  const values: unknown[] = []
  if (filter.workId !== undefined) {
    clauses.push('photo.work_id = ?')
    values.push(filter.workId)
  }
  if (filter.publicationStatus !== undefined) {
    clauses.push('photo.publication_status = ?')
    values.push(filter.publicationStatus)
  }
  return {
    values,
    where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
  }
}

export function countReturnPhotos(
  sqlite: Database.Database,
  filter: ReturnPhotoListFilter,
) {
  const { values, where } = listConditions(filter)
  return sqlite.prepare(`
    SELECT COUNT(*) AS total FROM return_photos AS photo ${where}
  `).get(...values) as { total: number }
}

/** 管理列表排序与公开一致：人工 sort_order 后接稳定 ID。 */
export function listReturnPhotos(
  sqlite: Database.Database,
  filter: ReturnPhotoListFilter,
) {
  const { values, where } = listConditions(filter)
  return sqlite.prepare(`
    ${selectReturnPhoto} ${where}
    ORDER BY photo.sort_order, photo.id
    LIMIT ? OFFSET ?
  `).all(...values, filter.limit, filter.offset) as ReturnPhotoRow[]
}

export function countReturnPhotosForWork(
  sqlite: Database.Database,
  workId: string,
) {
  return sqlite.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN publication_status = 'published' THEN 1 ELSE 0 END)
        AS published
    FROM return_photos WHERE work_id = ?
  `).get(workId) as { published: number | null, total: number }
}

export interface ReturnPhotoInsert {
  alt: string
  /** 新建草稿时为 null：图片随后通过 return 归属的上传会话补齐。 */
  assetId: string | null
  authorizationConfirmedAt: number | null
  authorizationNote: string | null
  authorizationSource: string | null
  id: string
  sortOrder: number
  workId: string
}

export function insertReturnPhoto(
  sqlite: Database.Database,
  input: ReturnPhotoInsert,
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO return_photos (
      id, work_id, asset_id, alt, sort_order, publication_status,
      authorization_source, authorization_confirmed_at, authorization_note,
      version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, 1, ?, ?)
  `).run(
    input.id,
    input.workId,
    input.assetId,
    input.alt,
    input.sortOrder,
    input.authorizationSource,
    input.authorizationConfirmedAt,
    input.authorizationNote,
    now,
    now,
  )
}

export interface ReturnPhotoUpdate {
  alt: string
  authorizationConfirmedAt: number | null
  authorizationNote: string | null
  authorizationSource: string | null
  sortOrder: number
  workId: string
}

/** 条件更新：版本不匹配时返回 0，调用方转 409，不猜测新版本。 */
export function updateReturnPhotoRow(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  input: ReturnPhotoUpdate,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE return_photos
    SET work_id = ?, alt = ?, sort_order = ?,
        authorization_source = ?, authorization_confirmed_at = ?,
        authorization_note = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?
  `).run(
    input.workId,
    input.alt,
    input.sortOrder,
    input.authorizationSource,
    input.authorizationConfirmedAt,
    input.authorizationNote,
    now,
    id,
    expectedVersion,
  ).changes
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
