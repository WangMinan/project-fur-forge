import { createHash, randomBytes } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  publicReturnCharacterDtoSchema,
  publicReturnWallDtoSchema,
  RETURN_WALL_PAGE_SIZE,
} from '../../../shared/schemas/return-photo'
import type {
  PublicReturnCharacterDto,
  PublicReturnPhotoDto,
  PublicReturnWallDto,
} from '../../../shared/types/contracts'
import { toPublicSourceSetDto, toSafePublicAlt } from '../recipe/media-mapper'
import type { VariantRecord } from '../recipe/media-mapper'
import {
  completeReturnWallVariants,
  returnWallWidths,
} from '../recipe/return-display-recipe'
import { getDatabase } from '../database'
import { getRuntimeConfig } from '../runtime-config'
import type { RuntimeConfig } from '../runtime-config'

/**
 * T35-F1 公开返图投影。
 *
 * 这一层刻意只 SELECT 公开需要的列：返图 id、alt、所属设定的名称/昵称/slug
 * 和公开变体。授权来源 / 确认时间 / 内部备注、私有 Object Key、原文件名
 * 和 EXIF 根本不在查询里，因此不可能因为某个映射疏漏而进入公开响应。
 *
 * 可见性只要求返图自己是 published：设定的关联作品是否存在、是否已发布
 * 都不影响返图公开可见（T35-F1 解耦结论）。
 */

interface PublicReturnRow {
  alt: string
  assetHeight: number
  assetId: string
  assetWidth: number
  characterName: string
  characterNickname: string | null
  characterSlug: string
  characterId: string
  id: string
}

interface PublicReturnVariantRow extends VariantRecord {
  assetId: string
}

const publishedPhotoJoin = `
  FROM return_photos AS photo
  JOIN return_characters AS character ON character.id = photo.character_id
  JOIN assets AS asset ON asset.id = photo.asset_id
  WHERE photo.publication_status = 'published'
    AND asset.role = 'return_photo'
    AND asset.status = 'READY'
`

const publicPhotoColumns = `
  photo.id,
  photo.alt,
  photo.asset_id AS assetId,
  asset.width AS assetWidth,
  asset.height AS assetHeight,
  character.id AS characterId,
  character.name AS characterName,
  character.nickname AS characterNickname,
  character.slug AS characterSlug
`

function countPublishedReturns(sqlite: Database.Database) {
  return (sqlite.prepare(`
    SELECT COUNT(*) AS total ${publishedPhotoJoin}
  `).get() as { total: number }).total
}

/**
 * 公开返图墙排序：按 `seed` 确定性地打乱。
 *
 * 返图之间没有优劣顺序，因此墙上不用人工排序。打乱必须对同一个 seed
 * 保持确定：否则第 2 页会重复或漏掉第 1 页已经出现过的照片。
 *
 * 实现是「取全部已发布返图的 id → 按 sha256(id + seed) 排序 → 切出当页 →
 * 只取这一页的完整行」。id 列很窄，SQLite 也没有可用的哈希函数，
 * 因此排序放在应用层最省事。
 *
 * ponytail: 每次请求排一遍全部 id，返图量到十万级再考虑物化随机列。
 */
export function shuffledReturnPhotoIds(
  ids: readonly string[],
  seed: string,
) {
  return ids
    .map(id => ({
      id,
      key: createHash('sha256').update(`${seed}:${id}`).digest('hex'),
    }))
    .sort((left, right) => (left.key < right.key ? -1 : 1))
    .map(entry => entry.id)
}

function shuffledPhotoIds(
  sqlite: Database.Database,
  seed: string,
  limit: number,
  offset: number,
) {
  const ids = sqlite.prepare(`
    SELECT photo.id ${publishedPhotoJoin} ORDER BY photo.id
  `).pluck().all() as string[]
  return shuffledReturnPhotoIds(ids, seed)
    .slice(offset, offset + limit)
}

function loadReturnsByIds(
  sqlite: Database.Database,
  ids: readonly string[],
) {
  if (ids.length === 0) {
    return []
  }
  const placeholders = ids.map(() => '?').join(', ')
  const rows = sqlite.prepare(`
    SELECT ${publicPhotoColumns}
    ${publishedPhotoJoin}
      AND photo.id IN (${placeholders})
  `).all(...ids) as PublicReturnRow[]
  // SQL 的 IN 不保证顺序，按打乱后的 id 顺序重排。
  const byId = new Map(rows.map(row => [row.id, row]))
  return ids.flatMap(id => (byId.has(id) ? [byId.get(id)!] : []))
}

/** 一个设定的全部已发布返图；主图优先，其余按创建顺序稳定排列。 */
function loadCharacterReturns(sqlite: Database.Database, slug: string) {
  return sqlite.prepare(`
    SELECT ${publicPhotoColumns}, photo.is_primary AS isPrimary
    ${publishedPhotoJoin}
      AND character.slug = ?
    ORDER BY photo.is_primary DESC, photo.created_at, photo.id
  `).all(slug) as Array<PublicReturnRow & { isPrimary: number }>
}

/** 设定的公开身份与可选作品入口。作品未发布时不给公开入口。 */
function loadCharacter(sqlite: Database.Database, slug: string) {
  return sqlite.prepare(`
    SELECT
      character.id,
      character.name,
      character.nickname,
      character.slug,
      work.character_name AS workCharacterName,
      work.slug AS workSlug,
      work.publication_status AS workPublicationStatus
    FROM return_characters AS character
    LEFT JOIN works AS work ON work.id = character.work_id
    WHERE character.slug = ?
  `).get(slug) as {
    id: string
    name: string
    nickname: string | null
    slug: string
    workCharacterName: string | null
    workPublicationStatus: string | null
    workSlug: string | null
  } | undefined
}

/**
 * 只取 `return-wall` / `return-display-v1` / `protection_mode='none'` 变体。
 * 查询里没有 watermark_profile 关联，因此活动 profile 切换
 * 不会改变返图的 URL、摘要或可见性。
 */
function loadReturnVariants(
  sqlite: Database.Database,
  assetIds: readonly string[],
) {
  if (assetIds.length === 0) {
    return []
  }
  const placeholders = assetIds.map(() => '?').join(', ')
  return sqlite.prepare(`
    SELECT
      variant.id, variant.asset_id AS assetId,
      variant.byte_size AS byteSize,
      variant.storage_scope AS storageScope,
      variant.status, variant.object_key AS objectKey,
      variant.width, variant.height, variant.format,
      variant.input_sha256 AS inputSha256,
      variant.internal_error_code AS internalErrorCode,
      variant.logo_digest AS logoDigest,
      variant.media_role AS mediaRole,
      variant.recipe_version AS recipeVersion,
      variant.protection_mode AS protectionMode,
      variant.sha256, variant.usage,
      variant.watermark_anchor AS watermarkAnchor,
      variant.watermark_config_digest AS watermarkConfigDigest,
      variant.watermark_opacity_percent AS watermarkOpacityPercent,
      variant.watermark_profile AS watermarkProfile,
      variant.watermark_profile_id AS watermarkProfileId,
      variant.watermark_scale_percent AS watermarkScalePercent
    FROM asset_variants AS variant
    WHERE variant.asset_id IN (${placeholders})
      AND variant.storage_scope = 'PUBLIC'
      AND variant.status = 'READY'
      AND variant.usage = 'return-wall'
      AND variant.recipe_version = 'return-display-v1'
      AND variant.protection_mode = 'none'
      AND length(variant.sha256) = 64
      AND variant.sha256 NOT GLOB '*[^0-9a-f]*'
      AND variant.byte_size > 0
    ORDER BY variant.asset_id, variant.width, variant.format
  `).all(...assetIds) as PublicReturnVariantRow[]
}

/**
 * 把返图行映射为公开 DTO。
 * 变体不完整或 URL 组装失败的单条返图受控跳过：
 * 不回退私有原图，也不让整页 500。
 */
function toPublicItems(
  rows: readonly PublicReturnRow[],
  variants: readonly PublicReturnVariantRow[],
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'],
): PublicReturnPhotoDto[] {
  return rows.flatMap((row) => {
    const complete = completeReturnWallVariants(
      row.assetWidth,
      variants.filter(variant => variant.assetId === row.assetId),
    )
    if (!complete) {
      return []
    }
    let sources
    try {
      sources = toPublicSourceSetDto(
        complete,
        mediaBaseUrl,
        returnWallWidths(row.assetWidth),
        appEnv,
      )
    }
    catch {
      return []
    }
    // 固有宽高取最大宽度变体，浏览器据此预留空间避免 CLS。
    const largest = complete.reduce(
      (widest, variant) => (variant.width > widest.width ? variant : widest),
      complete[0]!,
    )
    return [{
      id: row.id,
      image: {
        alt: toSafePublicAlt(row.alt, `${row.characterName}的返图`),
        height: largest.height,
        sources,
        width: largest.width,
      },
      character: {
        id: row.characterId,
        href: `/returns/${row.characterSlug}`,
        name: row.characterName,
        nickname: row.characterNickname,
        slug: row.characterSlug,
      },
    }]
  })
}

export function getPublicReturnWall(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  page = 1,
  seed = returnWallSeed(),
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicReturnWallDto {
  const total = countPublishedReturns(sqlite)
  const pageCount = Math.ceil(total / RETURN_WALL_PAGE_SIZE)
  const rows = loadReturnsByIds(sqlite, shuffledPhotoIds(
    sqlite,
    seed,
    RETURN_WALL_PAGE_SIZE,
    (page - 1) * RETURN_WALL_PAGE_SIZE,
  ))
  const variants = loadReturnVariants(sqlite, rows.map(row => row.assetId))

  return publicReturnWallDtoSchema.parse({
    items: toPublicItems(rows, variants, mediaBaseUrl, appEnv),
    page,
    pageCount,
    pageSize: RETURN_WALL_PAGE_SIZE,
    resultCount: total,
    seed,
  })
}

/** 设定页：找不到设定或它没有任何已发布返图时返回 null（由路由转 404）。 */
export function getPublicReturnCharacter(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  slug: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicReturnCharacterDto | null {
  const character = loadCharacter(sqlite, slug)
  if (!character) {
    return null
  }
  const rows = loadCharacterReturns(sqlite, slug)
  const variants = loadReturnVariants(sqlite, rows.map(row => row.assetId))
  const photos = toPublicItems(rows, variants, mediaBaseUrl, appEnv)
  if (photos.length === 0) {
    return null
  }
  // 主图排在最前（SQL 已按 is_primary DESC 排序），因此取第一张。
  const primary = photos[0]!

  return publicReturnCharacterDtoSchema.parse({
    character: {
      id: character.id,
      href: `/returns/${character.slug}`,
      name: character.name,
      nickname: character.nickname,
      slug: character.slug,
    },
    primaryImage: primary.image,
    photos,
    // 只有已发布的关联作品才给公开入口。
    work: character.workSlug !== null
      && character.workCharacterName !== null
      && character.workPublicationStatus === 'published'
      ? {
          characterName: character.workCharacterName,
          href: `/works/${character.workSlug}`,
          slug: character.workSlug,
        }
      : null,
  })
}

/**
 * 为一次返图墙浏览创建随机种子。
 *
 * 无 seed 的页面/API 请求每次生成新值；响应把 seed 返回给页面，分页普通链接
 * 再显式传递同一值，因此新请求会重新打乱，同一次浏览跨页仍不会重复或遗漏。
 */
export function returnWallSeed(bytes = randomBytes(16)) {
  if (bytes.length !== 16) {
    throw new Error('Return wall seed entropy must be exactly 16 bytes.')
  }
  return bytes.toString('hex')
}

export function getPublicReturnWallForRequest(
  page = 1,
  seed = returnWallSeed(),
) {
  const config = getRuntimeConfig()
  return getPublicReturnWall(
    getDatabase().sqlite,
    config.mediaBaseUrl,
    page,
    seed,
    config.appEnv,
  )
}

export function getPublicReturnCharacterForRequest(slug: string) {
  const config = getRuntimeConfig()
  return getPublicReturnCharacter(
    getDatabase().sqlite,
    config.mediaBaseUrl,
    slug,
    config.appEnv,
  )
}
