import type Database from 'better-sqlite3'
import {
  PUBLIC_ADOPTIONS_PAGE_SIZE,
  PUBLIC_WORKS_PAGE_SIZE,
  publicCatalogSearchQuerySchema,
  publicCatalogPageQuerySchema,
  publicAdoptionListDtoSchema,
  publicAdoptionListItemDtoSchema,
  publicAdoptionListQuerySchema,
  publicFeaturedWorksDtoSchema,
  publicHomeAggregateDtoSchema,
  publicWorkDetailDtoSchema,
  publicWorkListDtoSchema,
  publicWorkListQuerySchema,
  publicWorkSummaryDtoSchema,
} from '../../../shared/schemas/public-content'
import { includesSearchText } from '../../../shared/utils/search'
import type {
  PublicAdoptionListDto,
  PublicAdoptionListItemDto,
  PublicCommissionHeroDto,
  PublicFeaturedWorksDto,
  PublicHomeAggregateDto,
  PublicHomeDto,
  PublicSourceSetDto,
  PublicWorkDetailDto,
  PublicWorkListDto,
  PublicWorkSummaryDto,
} from '../../../shared/types/contracts'
import { PUBLIC_FEATURED_LIMIT } from '../../../shared/constants/featured'
import { getDatabase } from '../database'
import {
  toPublicSourceSetDto,
  toSafePublicAlt,
} from '../recipe/media-mapper'
import type { VariantRecord } from '../recipe/media-mapper'
import {
  getPublicCommissionHero,
  getPublicHome,
} from '../runner/home-management'
import {
  PUBLIC_RECIPE_VERSIONS,
  publicRecipeWidths,
} from '../recipe/media-recipe'
import { getRuntimeConfig } from '../runtime-config'
import type { RuntimeConfig } from '../runtime-config'
import { safeLog } from '../safe-log'
import { getPublicBusinessStatuses } from '../service/site-content'
import { toPublicWorkDto } from '../recipe/work-mapper'

export interface PublicWorksQuery {
  page?: unknown
  q?: unknown
}

export interface PublicAdoptionsQuery {
  page?: unknown
  q?: unknown
}

export interface PublicSiteRepository {
  getWorkBySlug(slug: string): PublicWorkDetailDto | null
  listAdoptions(query?: PublicAdoptionsQuery): PublicAdoptionListDto
  listWorks(query?: PublicWorksQuery): PublicWorkListDto
  listFeaturedWorks(): PublicFeaturedWorksDto
  getCommissionHero(): PublicCommissionHeroDto
  getHome(): PublicHomeDto
  getHomeAggregate(): PublicHomeAggregateDto
}

interface PublishedWorkRow {
  adoptionStatus: 'available' | 'adopted' | null
  characterName: string
  featured: number
  id: string
  priceAmountMinor: number | null
  priceCurrency: 'CNY' | null
  publicationStatus: 'published'
  purpose: 'commission' | 'adoption' | 'showcase'
  slug: string
  sortOrder: number
  species: string
  updatedAt: number
  version: number
}

interface WorkMediaRow {
  alt: string | null
  assetId: string
  position: number
  primary: number
  role: 'adoption_cover' | 'design_sheet' | 'studio_photo'
  workId: string
}

interface PublicVariantRow extends VariantRecord {
  assetId: string
}

interface SnapshotEntry {
  adoption: {
    cover: PublicWorkSummaryDto['card']
    priceCnyMinor: number | null
    status: 'available' | 'adopted'
  } | null
  /** 卡片方向：竖版 primary 出厂照，或仅横版领养封面。 */
  cardOrientation: 'landscape' | 'portrait'
  designSheet: {
    alt: string
    assetId: string
    sources: PublicSourceSetDto
  } | null
  featured: boolean
  /** 只用于首页精选排序；公开列表按发布时间倒序，不看这个值。 */
  id: string
  sortOrder: number
  studioPhotos: Array<{
    alt: string
    assetId: string
    card: PublicSourceSetDto | null
    position: number
    primary: number
    sources: PublicSourceSetDto
  }>
  summary: PublicWorkSummaryDto
  /** 只用于领养状态 bucket 内排序，不进入公开 DTO。 */
  updatedAt: number
}

function groupBy<T, K>(values: readonly T[], keyFor: (value: T) => K) {
  const grouped = new Map<K, T[]>()
  for (const value of values) {
    const key = keyFor(value)
    grouped.set(key, [...(grouped.get(key) ?? []), value])
  }
  return grouped
}

function sourceSet(
  variants: readonly PublicVariantRow[],
  mediaBaseUrl: string,
  usage: 'adoption-card' | 'design-sheet' | 'detail' | 'work-card',
  appEnv: RuntimeConfig['appEnv'],
) {
  for (const recipeVersion of PUBLIC_RECIPE_VERSIONS) {
    try {
      const sources = toPublicSourceSetDto(
        variants.filter(variant => (
          variant.usage === usage
          && variant.recipeVersion === recipeVersion
        )),
        mediaBaseUrl,
        publicRecipeWidths(usage),
        appEnv,
      )
      if (
        usage === 'work-card'
        && [...sources.webp, ...sources.fallback].some(variant => (
          variant.height !== Math.round(variant.width * 4 / 3)
        ))
      ) {
        continue
      }
      return sources
    }
    catch {
      // A complete previous recipe remains visible until the current recipe is complete.
    }
  }
  return null
}

/**
 * T35-F5：公开列表排序为「越新的越靠前」。
 *
 * 人工 `sort_order` 只服务首页精选（见 `listFeaturedWorks`），
 * 因此发布新作品不需要重排整站顺序。
 * `published_at` 理论上可能缺失，回落到 `created_at` 保证顺序稳定。
 */
function loadPublishedWorks(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT
      id, version, slug, character_name AS characterName,
      species, purpose, adoption_status AS adoptionStatus,
      price_amount_minor AS priceAmountMinor,
      price_currency AS priceCurrency,
      publication_status AS publicationStatus,
      sort_order AS sortOrder, featured,
      updated_at AS updatedAt
    FROM works
    WHERE publication_status = 'published'
    ORDER BY COALESCE(published_at, created_at) DESC, id
  `).all() as PublishedWorkRow[]
}

function loadWorkMedia(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT
      relation.work_id AS workId,
      relation.asset_id AS assetId,
      relation.alt_text AS alt,
      relation.position,
      relation.is_primary AS "primary",
      relation.role
    FROM work_assets AS relation
    JOIN works AS work ON work.id = relation.work_id
    JOIN assets AS asset ON asset.id = relation.asset_id
    WHERE work.publication_status = 'published'
      AND relation.role IN ('adoption_cover', 'design_sheet', 'studio_photo')
      AND asset.role = relation.role
      AND asset.status = 'READY'
    ORDER BY relation.work_id, relation.position
  `).all() as WorkMediaRow[]
}

function loadCurrentPublicVariants(sqlite: Database.Database) {
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
      variant.sha256, variant.usage,
      variant.watermark_anchor AS watermarkAnchor,
      variant.watermark_config_digest AS watermarkConfigDigest,
      variant.watermark_opacity_percent AS watermarkOpacityPercent,
      variant.watermark_profile AS watermarkProfile,
      variant.watermark_profile_id AS watermarkProfileId,
      variant.watermark_scale_percent AS watermarkScalePercent
    FROM asset_variants AS variant
    JOIN site_branding AS branding ON branding.id = 'site'
    JOIN watermark_profiles AS profile
      ON profile.id = branding.active_watermark_profile_id
    WHERE variant.storage_scope = 'PUBLIC'
      AND variant.status = 'READY'
      AND variant.media_role IN ('adoption_cover', 'design_sheet', 'studio_photo')
      AND variant.usage IN ('adoption-card', 'work-card', 'detail', 'design-sheet')
      AND variant.recipe_version IN ('recipe-v3', 'recipe-v2', 'recipe-v1')
      AND variant.watermark_profile = 'brand-centered-v2'
      AND variant.watermark_profile_id = profile.id
      AND variant.watermark_config_digest = profile.config_digest
      AND variant.logo_digest = profile.logo_digest
      AND variant.watermark_anchor = 'center'
      AND variant.watermark_opacity_percent = profile.opacity_percent
      AND variant.watermark_scale_percent = profile.scale_percent
      AND profile.status = 'ACTIVE'
      AND length(variant.sha256) = 64
      AND variant.sha256 NOT GLOB '*[^0-9a-f]*'
      AND variant.byte_size > 0
    ORDER BY variant.asset_id, variant.usage, variant.width, variant.format
  `).all() as PublicVariantRow[]
}

function snapshot(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'],
): SnapshotEntry[] {
  const mediaByWork = groupBy(loadWorkMedia(sqlite), media => media.workId)
  const variantsByAsset = groupBy(
    loadCurrentPublicVariants(sqlite),
    variant => variant.assetId,
  )
  const entries: SnapshotEntry[] = []

  for (const row of loadPublishedWorks(sqlite)) {
    const facts = toPublicWorkDto({
      ...row,
      priceCnyMinor: row.priceCurrency === 'CNY'
        ? row.priceAmountMinor
        : null,
      featured: row.featured === 1,
      sortOrder: row.sortOrder,
      assetIds: [],
      originalObjectKeys: [],
    })
    if (!facts) {
      continue
    }
    const media = mediaByWork.get(row.id) ?? []
    const designSheet = media
      .filter(item => item.role === 'design_sheet')
      .flatMap((item) => {
        const sources = sourceSet(
          variantsByAsset.get(item.assetId) ?? [],
          mediaBaseUrl,
          'design-sheet',
          appEnv,
        )
        return sources ? [{
          assetId: item.assetId,
          alt: toSafePublicAlt(
            item.alt,
            `${row.characterName}的完整设定图`,
          ),
          sources,
        }] : []
      })[0] ?? null
    const photos = media
      .filter(item => item.role === 'studio_photo')
      .flatMap((photo) => {
        const variants = variantsByAsset.get(photo.assetId) ?? []
        const detail = sourceSet(variants, mediaBaseUrl, 'detail', appEnv)
        if (!detail) {
          return []
        }
        return [{
          ...photo,
          alt: toSafePublicAlt(
            photo.alt,
            `${row.characterName}的出厂照`,
          ),
          sources: detail,
          card: sourceSet(variants, mediaBaseUrl, 'work-card', appEnv),
        }]
      })
    const primary = photos.find(photo => photo.primary === 1 && photo.card)
    const coverMedia = media.find(item => item.role === 'adoption_cover')
    const coverSources = coverMedia
      ? sourceSet(
          variantsByAsset.get(coverMedia.assetId) ?? [],
          mediaBaseUrl,
          'adoption-card',
          appEnv,
        )
      : null
    /*
     * 封面缺失时以完整设定图代替：发布门禁允许二者存其一，
     * /adoptions 卡片、首页当前领养与详情都沿这一回落。
     */
    const adoptionCover = coverMedia && coverSources
      ? {
          assetId: coverMedia.assetId,
          alt: toSafePublicAlt(coverMedia.alt, `${row.characterName}的领养封面`),
          sources: coverSources,
        }
      : designSheet
    const adoption = row.purpose === 'adoption'
      && row.adoptionStatus !== null
      && adoptionCover
      ? {
          cover: adoptionCover,
          priceCnyMinor: row.priceCurrency === 'CNY' ? row.priceAmountMinor : null,
          status: row.adoptionStatus,
        }
      : null
    /*
     * 只做了单头的领养作品没有竖版出厂照，卡片回落到横版领养封面或设定图；
     * 有 primary 出厂照时仍优先竖版出厂照。commission/showcase 没有封面可回落，
     * 缺少卡片时依旧整条丢弃。
     */
    const card = primary?.card
      ? {
          card: { assetId: primary.assetId, alt: primary.alt, sources: primary.card },
          orientation: 'portrait' as const,
        }
      : adoption
        ? { card: adoption.cover, orientation: 'landscape' as const }
        : null
    if (!card || (row.purpose === 'adoption' && !adoption)) {
      continue
    }
    entries.push({
      adoption,
      cardOrientation: card.orientation,
      featured: row.featured === 1,
      designSheet,
      id: row.id,
      sortOrder: row.sortOrder,
      summary: publicWorkSummaryDtoSchema.parse({
        work: facts,
        href: `/works/${row.slug}`,
        card: card.card,
        cardOrientation: card.orientation,
      }),
      studioPhotos: photos,
      updatedAt: row.updatedAt,
    })
  }

  return entries
}

const ENTRY_TITLES = {
  commission: '自设委托',
  adoption: '角色领养',
} as const

function publicBusinessStatuses(sqlite: Database.Database) {
  return getPublicBusinessStatuses(sqlite)
}

/**
 * 首页聚合投影：Hero 与业务入口为关键区块，精选作品和当前领养失败时受控降级。
 * 单次 SSR 只构建一份作品快照，避免精选与领养各自重复扫描。
 */
function homeAggregate(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'],
): PublicHomeAggregateDto {
  const hero = getPublicHome(sqlite, mediaBaseUrl, appEnv)
  const statuses = publicBusinessStatuses(sqlite)
  const entryCard = (kind: 'adoption' | 'commission') => {
    const entry = hero.entries[kind]
    if (!entry) {
      return null
    }
    const status = statuses[kind]
    return {
      ...entry,
      title: ENTRY_TITLES[kind],
      status,
      summary: status?.detail ?? null,
    }
  }

  let entries: PublicHomeAggregateDto['entries'] = {
    commission: null,
    adoption: null,
  }
  try {
    entries = {
      commission: entryCard('commission'),
      adoption: entryCard('adoption'),
    }
  }
  catch (error) {
    safeLog('error', 'Home business entries projection failed.', {
      errorName: (error as { name?: unknown }).name,
    })
  }

  let featured: PublicWorkSummaryDto[] = []
  let featuredAvailable = true
  let currentAdoptions: PublicAdoptionListItemDto[] = []
  let adoptionsAvailable = true
  try {
    const entriesSnapshot = snapshot(sqlite, mediaBaseUrl, appEnv)
    featured = featuredEntries(entriesSnapshot).map(entry => entry.summary)
    // 首页与目录共用同一个领养 comparator；只投影第一件开放领养。
    currentAdoptions = adoptionItems(entriesSnapshot)
      .filter(item => item.work.adoptionStatus === 'available')
      .slice(0, 1)
  }
  catch (error) {
    featuredAvailable = false
    adoptionsAvailable = false
    safeLog('error', 'Home work snapshot projection failed.', {
      errorName: (error as { name?: unknown }).name,
    })
  }

  return publicHomeAggregateDtoSchema.parse({
    hero,
    entries,
    featured: { available: featuredAvailable, items: featured },
    currentAdoptions: {
      available: adoptionsAvailable,
      items: currentAdoptions,
      status: statuses.adoption,
    },
  })
}

/**
 * 首页精选：全站唯一使用服务端连续 `sort_order` 的位置。
 * 快照本身按发布时间倒序，因此这里显式重排。
 */
function featuredEntries(entries: readonly SnapshotEntry[]) {
  return entries
    .filter(entry => entry.featured)
    .toSorted((left, right) => (
      left.sortOrder - right.sortOrder || (left.id < right.id ? -1 : 1)
    ))
    .slice(0, PUBLIC_FEATURED_LIMIT)
}

function adoptionItems(entries: readonly SnapshotEntry[]) {
  return entries
    .filter((entry): entry is SnapshotEntry & { adoption: NonNullable<SnapshotEntry['adoption']> } => (
      entry.adoption !== null
    ))
    .toSorted(comparePublicAdoptions)
    .map((entry): PublicAdoptionListItemDto => publicAdoptionListItemDtoSchema.parse({
      work: {
        ...entry.summary.work,
        adoptionStatus: entry.adoption.status,
        ...(entry.adoption.priceCnyMinor === null
          ? {}
          : {
              price: {
                currency: 'CNY',
                minorUnits: entry.adoption.priceCnyMinor,
              },
            }),
      },
      href: entry.summary.href,
      cover: entry.adoption.cover,
    }))
}

function comparePublicAdoptions(
  left: SnapshotEntry & { adoption: NonNullable<SnapshotEntry['adoption']> },
  right: SnapshotEntry & { adoption: NonNullable<SnapshotEntry['adoption']> },
) {
  const bucket = { available: 0, adopted: 1 } as const
  return bucket[left.adoption.status] - bucket[right.adoption.status]
    || right.updatedAt - left.updatedAt
    || left.id.localeCompare(right.id)
}

function catalogPage(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = publicCatalogPageQuerySchema.safeParse(
    raw === undefined || raw === '' ? {} : { page: Number(raw) },
  )
  return parsed.success ? parsed.data.page ?? 1 : 1
}

function paginateCatalog<T>(items: readonly T[], page: number, pageSize: number) {
  const resultCount = items.length
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount: Math.ceil(resultCount / pageSize),
    pageSize,
    resultCount,
  }
}

function adoptionListDto(
  items: readonly PublicAdoptionListItemDto[],
  query: PublicAdoptionsQuery,
) {
  const parsed = publicAdoptionListQuerySchema.safeParse({ q: query.q })
  const search = publicCatalogSearchQuerySchema.safeParse(query.q)
  const page = catalogPage(query.page)
  const filtered = parsed.success && search.success
    ? items.filter(item => includesSearchText(
        item.work.characterName,
        search.data ?? '',
      ))
    : []
  return publicAdoptionListDtoSchema.parse({
    ...paginateCatalog(filtered, page, PUBLIC_ADOPTIONS_PAGE_SIZE),
    filter: { valid: parsed.success && search.success },
  })
}

function detailFor(entries: readonly SnapshotEntry[], slug: string) {
  return entries.find(entry => entry.summary.work.slug === slug) ?? null
}

export function createSqlitePublicSiteRepository(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicSiteRepository {
  return {
    getWorkBySlug(slug) {
      const entries = snapshot(sqlite, mediaBaseUrl, appEnv)
      const match = detailFor(entries, slug)
      if (!match) {
        return null
      }
      const primaryAssetId = match.studioPhotos.find(
        photo => photo.primary === 1,
      )?.assetId ?? null
      const gallery = match.studioPhotos.map(photo => ({
        assetId: photo.assetId,
        alt: photo.alt,
        position: photo.position,
        sources: photo.sources,
      }))
      return publicWorkDetailDtoSchema.parse({
        work: match.summary.work,
        href: match.summary.href,
        media: {
          primaryAssetId,
          card: match.summary.card,
          cardOrientation: match.cardOrientation,
          // 领养作品详情必须能看到横版封面，只做了单头时它是唯一的成果图；
          // 封面回落为设定图时不再重复进图集，设定图分区已展示同一张。
          ...(match.adoption && match.adoption.cover.assetId !== match.designSheet?.assetId
            ? { adoptionCover: match.adoption.cover }
            : {}),
          gallery,
          ...(match.designSheet
            ? { designSheet: match.designSheet }
            : {}),
        },
      })
    },

    listAdoptions(query = {}) {
      return adoptionListDto(adoptionItems(snapshot(sqlite, mediaBaseUrl, appEnv)), query)
    },

    listWorks(query = {}) {
      const page = catalogPage(query.page)
      const parsed = publicWorkListQuerySchema.safeParse({ q: query.q })
      const search = publicCatalogSearchQuerySchema.safeParse(query.q)
      if (!parsed.success) {
        return publicWorkListDtoSchema.parse({
          items: [],
          resultCount: 0,
          page,
          pageCount: 0,
          pageSize: PUBLIC_WORKS_PAGE_SIZE,
          filter: { valid: false },
        })
      }
      // 快照只保留有卡片的作品；仅横版封面的领养作品同样要出现在作品展示中。
      const items = search.success ? snapshot(sqlite, mediaBaseUrl, appEnv)
        .filter(entry => (
          includesSearchText(
            entry.summary.work.characterName,
            search.data ?? '',
          )
        ))
        .map(entry => entry.summary)
        : []
      return publicWorkListDtoSchema.parse({
        ...paginateCatalog(items, page, PUBLIC_WORKS_PAGE_SIZE),
        filter: { valid: true },
      })
    },

    listFeaturedWorks() {
      const items = featuredEntries(snapshot(sqlite, mediaBaseUrl, appEnv))
        .map(entry => entry.summary)
      return publicFeaturedWorksDtoSchema.parse({
        items,
        resultCount: items.length,
      })
    },

    getHome() {
      return getPublicHome(sqlite, mediaBaseUrl, appEnv)
    },
    getCommissionHero() {
      return getPublicCommissionHero(sqlite, mediaBaseUrl, appEnv)
    },
    getHomeAggregate() {
      return homeAggregate(sqlite, mediaBaseUrl, appEnv)
    },
  }
}

export function getPublicSiteRepository() {
  const config = getRuntimeConfig()
  return createSqlitePublicSiteRepository(
    getDatabase().sqlite,
    config.mediaBaseUrl,
    config.appEnv,
  )
}
