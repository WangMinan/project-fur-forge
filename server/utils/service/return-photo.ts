import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  adminReturnCharacterDtoSchema,
  adminReturnCharacterListDtoSchema,
  adminReturnPhotoDtoSchema,
  returnPhotoPublicationCheckDtoSchema,
} from '../../../shared/schemas/return-photo'
import type {
  AdminReturnCharacterDto,
  AdminReturnPhotoDto,
  ReturnCharacterFields,
  ReturnPhotoBlocker,
} from '../../../shared/types/contracts'
import { ServiceError } from '../service-error'
import { hasBlockingPublicationCleanup } from '../repository/publication-repository'
import {
  clearCharacterPrimary,
  countReturnCharacters,
  countReturnPhotosForCharacter,
  deleteReturnCharacterRow,
  deleteReturnPhotoRow,
  findPrimaryCandidate,
  findReturnCharacter,
  findReturnPhoto,
  findReturnPhotoIdByAsset,
  insertReturnCharacter,
  insertReturnPhoto,
  listReturnCharacters,
  listReturnPhotosForCharacter,
  setReturnPhotoPrimary,
  slugTakenByOther,
  touchReturnCharacter,
  updateReturnCharacterRow,
  updateReturnPhotoAlt,
} from '../repository/return-photo-repository'
import type {
  ReturnCharacterListRow,
  ReturnCharacterRow,
  ReturnPhotoRow,
} from '../repository/return-photo-repository'
import {
  countReadyReturnWallVariants,
  returnWallRequiredVariantCount,
  returnWallSourceTooSmall,
} from '../recipe/return-display-recipe'

/** 管理列表每页条数默认值；列表允许按需覆盖。 */
export const ADMIN_RETURN_PAGE_SIZE = 20

export function requireReturnCharacter(
  sqlite: Database.Database,
  id: string,
) {
  const row = findReturnCharacter(sqlite, id)
  if (!row) {
    throw new ServiceError(
      404,
      'NOT_FOUND',
      'Return character was not found.',
      'RETURN_CHARACTER_NOT_FOUND',
    )
  }
  return row
}

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

function assertVersion(actual: number, expected: number) {
  if (actual !== expected) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Resource version is stale.',
      'VERSION_CONFLICT',
    )
  }
}

export function assertReturnPhotoVersion(
  row: ReturnPhotoRow,
  expectedVersion: number,
) {
  assertVersion(row.version, expectedVersion)
}

/** 关联作品是可选的，但填了就必须存在。作品发布状态不做任何要求。 */
function requireWorkExists(sqlite: Database.Database, workId: string) {
  const found = sqlite.prepare('SELECT 1 FROM works WHERE id = ?')
    .pluck().get(workId)
  if (!found) {
    throw new ServiceError(
      400,
      'VALIDATION_ERROR',
      'Linked work was not found.',
      'RETURN_PHOTO_WORK_NOT_FOUND',
    )
  }
}

function assertSlugAvailable(
  sqlite: Database.Database,
  slug: string,
  excludeId: string | null,
) {
  if (slugTakenByOther(sqlite, slug, excludeId)) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Return character slug is already in use.',
      'RETURN_CHARACTER_SLUG_TAKEN',
    )
  }
}

function workSummary(row: ReturnCharacterRow | ReturnCharacterListRow) {
  return row.workId === null || row.workCharacterName === null
    || row.workSlug === null || row.workPublicationStatus === null
    ? null
    : {
        workId: row.workId,
        characterName: row.workCharacterName,
        slug: row.workSlug,
        publicationStatus: row.workPublicationStatus,
      }
}

function authorizationDto(row: ReturnCharacterRow | ReturnCharacterListRow) {
  return {
    source: row.authorizationSource,
    confirmedAt: row.authorizationConfirmedAt === null
      ? null
      : new Date(row.authorizationConfirmedAt).toISOString(),
    note: row.authorizationNote,
  }
}

export function toAdminReturnPhotoDto(
  sqlite: Database.Database,
  row: ReturnPhotoRow,
): AdminReturnPhotoDto {
  return adminReturnPhotoDtoSchema.parse({
    id: row.id,
    version: row.version,
    characterId: row.characterId,
    publicationStatus: row.publicationStatus,
    alt: row.alt,
    primary: row.primary === 1,
    asset: row.assetId === null || row.assetStatus === null
      ? null
      : {
          assetId: row.assetId,
          status: row.assetStatus,
          width: row.assetWidth,
          height: row.assetHeight,
          mimeType: row.assetMimeType,
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

/**
 * 管理 DTO。授权三列在这里出现，是唯一允许它们离开数据库的出口；
 * 公开投影走 public-return-repository，结构上不包含这些字段。
 */
export function toAdminReturnCharacterDto(
  sqlite: Database.Database,
  row: ReturnCharacterRow,
): AdminReturnCharacterDto {
  return adminReturnCharacterDtoSchema.parse({
    id: row.id,
    version: row.version,
    slug: row.slug,
    name: row.name,
    nickname: row.nickname,
    work: workSummary(row),
    authorization: authorizationDto(row),
    photos: listReturnPhotosForCharacter(sqlite, row.id)
      .map(photo => toAdminReturnPhotoDto(sqlite, photo)),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  })
}

export function getReturnCharacter(sqlite: Database.Database, id: string) {
  return toAdminReturnCharacterDto(sqlite, requireReturnCharacter(sqlite, id))
}

export interface ListReturnCharactersInput {
  page?: number | undefined
  pageSize?: number | undefined
  query?: string | undefined
}

export function listAdminReturnCharacters(
  sqlite: Database.Database,
  input: ListReturnCharactersInput = {},
) {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? ADMIN_RETURN_PAGE_SIZE
  const filter = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    query: input.query,
  }
  const { total } = countReturnCharacters(sqlite, filter)
  const rows = listReturnCharacters(sqlite, filter)
  return adminReturnCharacterListDtoSchema.parse({
    items: rows.map(row => ({
      id: row.id,
      version: row.version,
      slug: row.slug,
      name: row.name,
      nickname: row.nickname,
      work: workSummary(row),
      primaryAssetId: row.primaryAssetId,
      photoCount: row.photoCount,
      publishedPhotoCount: row.publishedPhotoCount,
      updatedAt: new Date(row.updatedAt).toISOString(),
    })),
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
    resultCount: total,
  })
}

function authorizationColumns(fields: ReturnCharacterFields) {
  return {
    authorizationConfirmedAt: fields.authorization.confirmedAt === null
      ? null
      : Date.parse(fields.authorization.confirmedAt),
    authorizationNote: fields.authorization.note,
    authorizationSource: fields.authorization.source,
  }
}

export function createReturnCharacter(
  sqlite: Database.Database,
  fields: ReturnCharacterFields,
  now = Date.now(),
) {
  if (fields.workId !== null) {
    requireWorkExists(sqlite, fields.workId)
  }
  assertSlugAvailable(sqlite, fields.slug, null)
  const id = randomUUID()
  insertReturnCharacter(sqlite, {
    id,
    name: fields.name,
    nickname: fields.nickname,
    slug: fields.slug,
    workId: fields.workId,
    ...authorizationColumns(fields),
  }, now)
  return toAdminReturnCharacterDto(sqlite, requireReturnCharacter(sqlite, id))
}

export function updateReturnCharacter(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  fields: ReturnCharacterFields,
  now = Date.now(),
) {
  const row = requireReturnCharacter(sqlite, id)
  assertVersion(row.version, expectedVersion)
  if (fields.workId !== null) {
    requireWorkExists(sqlite, fields.workId)
  }
  assertSlugAvailable(sqlite, fields.slug, id)
  const changed = updateReturnCharacterRow(sqlite, id, expectedVersion, {
    name: fields.name,
    nickname: fields.nickname,
    slug: fields.slug,
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
  return toAdminReturnCharacterDto(sqlite, requireReturnCharacter(sqlite, id))
}

/**
 * 删除已经没有返图的设定。
 *
 * 连带删除返图（含已发布的下架与公开对象清理）由 runner 层的
 * `deleteReturnCharacterCascade` 负责，因为那需要 OSS 副作用。
 * 这里是最后一步：数据库 FK restrict 是兜底防线。
 */
export function deleteEmptyReturnCharacter(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
) {
  const row = requireReturnCharacter(sqlite, id)
  assertVersion(row.version, expectedVersion)
  if (countReturnPhotosForCharacter(sqlite, id).total > 0) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Remove the return photos before deleting this character.',
      'RETURN_CHARACTER_HAS_PHOTOS',
    )
  }
  if (deleteReturnCharacterRow(sqlite, id, expectedVersion) !== 1) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Resource version is stale.',
      'VERSION_CONFLICT',
    )
  }
  return { id }
}

/**
 * 上传完成后为设定新增一张返图。
 *
 * 一个设定可以有多张返图，所以“上传一张图”本身就是“加一张返图”，
 * 不需要先建空记录再补图。alt 先留占位，由景宸在列表里逐张填写；
 * 发布检查会拦住没写 alt 的照片。
 *
 * 设定的第一张图自动成为主图，省掉一次多余点击。
 */
export function addReturnPhotoFromUpload(
  sqlite: Database.Database,
  characterId: string,
  assetId: string,
  now = Date.now(),
) {
  const character = requireReturnCharacter(sqlite, characterId)
  const owner = findReturnPhotoIdByAsset(sqlite, assetId)
  if (owner) {
    // 同一张私有原图只能属于一条返图；重复完成同一个会话时直接回放。
    return toAdminReturnPhotoDto(sqlite, requireReturnPhoto(sqlite, owner.id))
  }
  const id = randomUUID()
  sqlite.transaction(() => {
    insertReturnPhoto(sqlite, {
      alt: character.name,
      assetId,
      characterId,
      id,
    }, now)
    const hasPrimary = listReturnPhotosForCharacter(sqlite, characterId)
      .some(photo => photo.primary === 1 && photo.id !== id)
    if (!hasPrimary) {
      setReturnPhotoPrimary(
        sqlite,
        id,
        requireReturnPhoto(sqlite, id).version,
        now,
      )
    }
    touchReturnCharacter(sqlite, characterId, now)
  })()
  return toAdminReturnPhotoDto(sqlite, requireReturnPhoto(sqlite, id))
}

export function updateReturnPhoto(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  alt: string,
  now = Date.now(),
) {
  const row = requireReturnPhoto(sqlite, id)
  assertReturnPhotoVersion(row, expectedVersion)
  if (updateReturnPhotoAlt(sqlite, id, expectedVersion, alt, now) !== 1) {
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
 * 指定设定主图。旧主图先清空再设置新主图，
 * 因此部分唯一索引不会被瞬时违反。
 */
export function setReturnCharacterPrimaryPhoto(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  now = Date.now(),
) {
  const row = requireReturnPhoto(sqlite, id)
  assertReturnPhotoVersion(row, expectedVersion)
  if (row.assetId === null) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Upload an image before making it the character cover.',
      'RETURN_PHOTO_IMAGE_REQUIRED',
    )
  }
  sqlite.transaction(() => {
    clearCharacterPrimary(sqlite, row.characterId, now)
    const current = requireReturnPhoto(sqlite, id)
    if (setReturnPhotoPrimary(sqlite, id, current.version, now) !== 1) {
      throw new ServiceError(
        409,
        'CONFLICT',
        'Resource version is stale.',
        'VERSION_CONFLICT',
      )
    }
  })()
  return toAdminReturnCharacterDto(
    sqlite,
    requireReturnCharacter(sqlite, row.characterId),
  )
}

/**
 * 发布前检查。返图的发布条件只看它自己：
 * 关联作品是否存在、是否已发布都不参与判断。
 * 可选授权记录缺失也不是阻断项，因此这里不读授权列。
 */
export function checkReturnPhotoPublication(
  sqlite: Database.Database,
  id: string,
) {
  const row = requireReturnPhoto(sqlite, id)
  const blockers: ReturnPhotoBlocker[] = []
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
 * 删掉主图时自动把设定里下一张有图的返图补为主图。
 */
export function deleteReturnPhotoDraft(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  now = Date.now(),
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
  if (hasBlockingPublicationCleanup(sqlite, 'RETURN_PHOTO', id)) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Finish public media cleanup before deleting the return photo.',
      'PUBLICATION_CLEANUP_PENDING',
    )
  }
  sqlite.transaction(() => {
    if (deleteReturnPhotoRow(sqlite, id, expectedVersion) !== 1) {
      throw new ServiceError(
        409,
        'CONFLICT',
        'Resource version is stale.',
        'VERSION_CONFLICT',
      )
    }
    if (row.primary === 1) {
      const next = findPrimaryCandidate(sqlite, row.characterId, id)
      if (next) {
        setReturnPhotoPrimary(sqlite, next.id, next.version, now)
      }
    }
    touchReturnCharacter(sqlite, row.characterId, now)
  })()
  return { id }
}

/** 设定编辑页显示的张数摘要。 */
export function returnPhotoSummaryForCharacter(
  sqlite: Database.Database,
  characterId: string,
) {
  const row = countReturnPhotosForCharacter(sqlite, characterId)
  return {
    publishedCount: row.published ?? 0,
    totalCount: row.total,
  }
}
