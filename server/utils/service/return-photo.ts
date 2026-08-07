import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  adminReturnPhotoDtoSchema,
  adminReturnPhotoListDtoSchema,
  RETURN_WALL_PAGE_SIZE,
  returnPhotoPublicationCheckDtoSchema,
} from '../../../shared/schemas/return-photo'
import type {
  AdminReturnPhotoDto,
  ReturnPhotoBlocker,
  ReturnPhotoFields,
} from '../../../shared/types/contracts'
import { ServiceError } from '../service-error'
import {
  countReturnPhotos,
  countReturnPhotosForWork,
  deleteReturnPhotoRow,
  findAssetForReturnPhoto,
  findReturnPhoto,
  findReturnPhotoIdByAsset,
  insertReturnPhoto,
  listReturnPhotos,
  updateReturnPhotoAsset,
  updateReturnPhotoRow,
} from '../repository/return-photo-repository'
import type { ReturnPhotoRow } from '../repository/return-photo-repository'
import {
  countReadyReturnWallVariants,
  returnWallRequiredVariantCount,
  returnWallSourceTooSmall,
} from '../recipe/return-display-recipe'

/** 管理列表每页条数：与公开墙一致，景宸不需要记两套分页规则。 */
export const ADMIN_RETURN_PAGE_SIZE = RETURN_WALL_PAGE_SIZE

export function requireReturnPhoto(sqlite: Database.Database, id: string) {
  const row = findReturnPhoto(sqlite, id)
  if (!row) {
    throw new ServiceError(
      404,
      'NOT_FOUND',
      'Return photo was not found.',
      'RESOURCE_NOT_FOUND',
    )
  }
  return row
}

export function assertReturnPhotoVersion(
  row: ReturnPhotoRow,
  expectedVersion: number,
) {
  if (row.version !== expectedVersion) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Resource version is stale.',
      'VERSION_CONFLICT',
    )
  }
}

function requireWork(sqlite: Database.Database, workId: string) {
  const row = sqlite.prepare(`
    SELECT id, character_name AS characterName, slug,
           publication_status AS publicationStatus
    FROM works WHERE id = ?
  `).get(workId) as {
    characterName: string
    id: string
    publicationStatus: string
    slug: string
  } | undefined
  if (!row) {
    throw new ServiceError(
      400,
      'VALIDATION_ERROR',
      'Linked work was not found.',
      'RETURN_PHOTO_WORK_NOT_FOUND',
    )
  }
  return row
}

/**
 * 管理 DTO。授权三列在这里出现，是唯一允许它们离开数据库的出口；
 * 公开投影走 public-return-repository，结构上不包含这些字段。
 */
export function toAdminReturnPhotoDto(
  sqlite: Database.Database,
  row: ReturnPhotoRow,
): AdminReturnPhotoDto {
  return adminReturnPhotoDtoSchema.parse({
    id: row.id,
    version: row.version,
    publicationStatus: row.publicationStatus,
    alt: row.alt,
    sortOrder: row.sortOrder,
    work: {
      workId: row.workId,
      characterName: row.workCharacterName,
      slug: row.workSlug,
      publicationStatus: row.workPublicationStatus,
    },
    asset: row.assetId === null || row.assetStatus === null
      ? null
      : {
          assetId: row.assetId,
          status: row.assetStatus,
          width: row.assetWidth,
          height: row.assetHeight,
          mimeType: row.assetMimeType,
        },
    authorization: {
      source: row.authorizationSource,
      confirmedAt: row.authorizationConfirmedAt === null
        ? null
        : new Date(row.authorizationConfirmedAt).toISOString(),
      note: row.authorizationNote,
    },
    publicVariantCount: row.assetId === null
      ? 0
      : countReadyReturnWallVariants(sqlite, row.assetId),
    publishedAt: row.publishedAt === null
      ? null
      : new Date(row.publishedAt).toISOString(),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  })
}

export function getReturnPhoto(sqlite: Database.Database, id: string) {
  return toAdminReturnPhotoDto(sqlite, requireReturnPhoto(sqlite, id))
}

export interface ListReturnPhotosInput {
  page?: number | undefined
  publicationStatus?: string | undefined
  workId?: string | undefined
}

export function listAdminReturnPhotos(
  sqlite: Database.Database,
  input: ListReturnPhotosInput = {},
) {
  const page = input.page ?? 1
  const filter = {
    limit: ADMIN_RETURN_PAGE_SIZE,
    offset: (page - 1) * ADMIN_RETURN_PAGE_SIZE,
    publicationStatus: input.publicationStatus,
    workId: input.workId,
  }
  const { total } = countReturnPhotos(sqlite, filter)
  const rows = listReturnPhotos(sqlite, filter)
  return adminReturnPhotoListDtoSchema.parse({
    items: rows.map(row => toAdminReturnPhotoDto(sqlite, row)),
    page,
    pageSize: ADMIN_RETURN_PAGE_SIZE,
    pageCount: Math.ceil(total / ADMIN_RETURN_PAGE_SIZE),
    resultCount: total,
  })
}

function authorizationColumns(fields: ReturnPhotoFields) {
  return {
    authorizationConfirmedAt: fields.authorization.confirmedAt === null
      ? null
      : Date.parse(fields.authorization.confirmedAt),
    authorizationNote: fields.authorization.note,
    authorizationSource: fields.authorization.source,
  }
}

export function createReturnPhoto(
  sqlite: Database.Database,
  fields: ReturnPhotoFields,
  now = Date.now(),
) {
  requireWork(sqlite, fields.workId)
  const id = randomUUID()
  sqlite.transaction(() => {
    insertReturnPhoto(sqlite, {
      alt: fields.alt,
      assetId: null,
      id,
      sortOrder: fields.sortOrder,
      workId: fields.workId,
      ...authorizationColumns(fields),
    }, now)
  })()
  return toAdminReturnPhotoDto(sqlite, requireReturnPhoto(sqlite, id))
}

export function updateReturnPhoto(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  fields: ReturnPhotoFields,
  now = Date.now(),
) {
  const row = requireReturnPhoto(sqlite, id)
  assertReturnPhotoVersion(row, expectedVersion)
  if (row.publicationStatus === 'published' && row.workId !== fields.workId) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Unpublish the return photo before changing its linked work.',
      'RETURN_PHOTO_PUBLISHED_READONLY',
    )
  }
  requireWork(sqlite, fields.workId)
  const changed = updateReturnPhotoRow(sqlite, id, expectedVersion, {
    alt: fields.alt,
    sortOrder: fields.sortOrder,
    workId: fields.workId,
    ...authorizationColumns(fields),
  }, now)
  if (changed !== 1) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Resource version is stale.',
      'VERSION_CONFLICT',
    )
  }
  return toAdminReturnPhotoDto(sqlite, requireReturnPhoto(sqlite, id))
}

/**
 * 绑定刚上传完成的返图原图。
 * 资产必须是 READY 的 `return_photo`，且没有被其他返图占用。
 */
export function attachReturnPhotoAsset(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  assetId: string,
  now = Date.now(),
) {
  const row = requireReturnPhoto(sqlite, id)
  assertReturnPhotoVersion(row, expectedVersion)
  if (row.publicationStatus === 'published') {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Unpublish the return photo before replacing its image.',
      'RETURN_PHOTO_PUBLISHED_READONLY',
    )
  }
  const asset = findAssetForReturnPhoto(sqlite, assetId)
  if (!asset) {
    throw new ServiceError(
      404,
      'NOT_FOUND',
      'Asset was not found.',
      'RESOURCE_NOT_FOUND',
    )
  }
  if (asset.role !== 'return_photo') {
    throw new ServiceError(
      400,
      'VALIDATION_ERROR',
      'Asset media role does not match a return photo.',
      'RETURN_PHOTO_ASSET_ROLE_INVALID',
    )
  }
  if (asset.status !== 'READY') {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Return photo image is not ready yet.',
      'RETURN_PHOTO_ASSET_NOT_READY',
    )
  }
  const owner = findReturnPhotoIdByAsset(sqlite, assetId)
  if (owner && owner.id !== id) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Image is already used by another return photo.',
      'RETURN_PHOTO_ASSET_ALREADY_USED',
    )
  }
  const changed = updateReturnPhotoAsset(sqlite, id, expectedVersion, assetId, now)
  if (changed !== 1) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Resource version is stale.',
      'VERSION_CONFLICT',
    )
  }
  return toAdminReturnPhotoDto(sqlite, requireReturnPhoto(sqlite, id))
}

/**
 * 发布前检查。可选授权记录缺失不是阻断项，
 * 因此这里完全不读授权三列。
 */
export function checkReturnPhotoPublication(
  sqlite: Database.Database,
  id: string,
) {
  const row = requireReturnPhoto(sqlite, id)
  const blockers: ReturnPhotoBlocker[] = []
  if (row.workPublicationStatus !== 'published') {
    blockers.push('RETURN_PHOTO_WORK_NOT_PUBLISHED')
  }
  if (row.alt.trim() === '') {
    blockers.push('RETURN_PHOTO_ALT_REQUIRED')
  }
  // 需要的变体数量由源图宽度决定：窄图只生成阶梯中不超过源宽的部分，
  // 不把小图放大成假的高清版本。
  const sourceWidth = row.assetWidth ?? 0
  const requiredVariantCount = returnWallRequiredVariantCount(sourceWidth)
  let missingVariantCount = requiredVariantCount
  if (row.assetId === null) {
    blockers.push('RETURN_PHOTO_ASSET_REQUIRED')
  }
  else if (row.assetStatus !== 'READY') {
    blockers.push('RETURN_PHOTO_ASSET_NOT_READY')
  }
  else if (returnWallSourceTooSmall(sourceWidth)) {
    blockers.push('RETURN_PHOTO_SOURCE_TOO_SMALL')
  }
  else {
    // 缺失变体不是发布前阻断项：公开变体正是由发布 operation 生成的。
    // 生成后再校验完整性，仍缺失才让 operation 失败。
    const ready = countReadyReturnWallVariants(sqlite, row.assetId)
    missingVariantCount = Math.max(0, requiredVariantCount - ready)
  }
  return returnPhotoPublicationCheckDtoSchema.parse({
    returnPhotoId: row.id,
    version: row.version,
    canPublish: blockers.length === 0,
    blockers,
    requiredVariantCount,
    missingVariantCount,
  })
}

/**
 * 草稿删除：阶段 D 不建设回收站，因此这里明确不可恢复。
 * 已发布记录必须先下架，公开对象清理由下架 operation 完成。
 */
export function deleteReturnPhotoDraft(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
) {
  const row = requireReturnPhoto(sqlite, id)
  assertReturnPhotoVersion(row, expectedVersion)
  if (row.publicationStatus === 'published') {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Unpublish the return photo before deleting it.',
      'RETURN_PHOTO_PUBLISHED_READONLY',
    )
  }
  if (deleteReturnPhotoRow(sqlite, id, expectedVersion) !== 1) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Resource version is stale.',
      'VERSION_CONFLICT',
    )
  }
  return { id }
}

/** 作品编辑页只显示数量摘要，不嵌入返图编辑器。 */
export function returnPhotoSummaryForWork(
  sqlite: Database.Database,
  workId: string,
) {
  const row = countReturnPhotosForWork(sqlite, workId)
  return {
    publishedCount: row.published ?? 0,
    totalCount: row.total,
  }
}

/** 作品永久删除前的关联检查；数据库 FK restrict 是最后一道防线。 */
export function assertWorkHasNoReturnPhotos(
  sqlite: Database.Database,
  workId: string,
) {
  if (countReturnPhotosForWork(sqlite, workId).total > 0) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Resolve linked return photos before deleting this work.',
      'WORK_HAS_RETURN_PHOTOS',
    )
  }
}
