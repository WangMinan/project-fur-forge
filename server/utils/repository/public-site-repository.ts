import type Database from 'better-sqlite3'
import {
  publicCommissionHeroDtoSchema,
  publicHomeDtoSchema,
} from '../../../shared/schemas/home'
import {
  PUBLIC_ADOPTIONS_PAGE_SIZE,
  PUBLIC_WORKS_PAGE_SIZE,
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
import type {
  PublicAdoptionListDto,
  PublicAdoptionListItemDto,
  PublicCommissionHeroDto,
  PublicFeaturedWorksDto,
  PublicHomeAggregateDto,
  PublicHomeDto,
  PublicSiteBusinessStatusDto,
  PublicSourceSetDto,
  PublicWorkDetailDto,
  PublicWorkListDto,
  PublicWorkSummaryDto,
} from '../../../shared/types/contracts'
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
  LEGACY_PUBLIC_RECIPE_VERSION,
  PUBLIC_RECIPE_VERSION,
  publicRecipeWidths,
} from '../recipe/media-recipe'
import { getRuntimeConfig } from '../runtime-config'
import { safeLog } from '../safe-log'
import { getPublicSiteContent } from '../service/site-content'
import { toPublicWorkDto } from '../recipe/work-mapper'

export interface PublicWorksQuery {
  page?: unknown
  purpose?: unknown
  suitType?: unknown
}

export interface PublicAdoptionsQuery {
  method?: unknown
  page?: unknown
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
  adoptionMethod: 'regular' | 'event_drop' | null
  businessStatus: 'preparing' | 'available' | 'event_sale' | 'scheduled' | 'in_production' | 'delivered' | null
  characterName: string
  eventName: string | null
  eventTime: string | null
  featured: number
  id: string
  ownerDisplay: string
  priceAmountMinor: number | null
  priceCurrency: 'CNY' | null
  publicationStatus: 'published'
  purpose: 'commission' | 'adoption' | 'showcase'
  slug: string
  sortOrder: number
  species: string
  suitType: 'full' | 'partial'
  version: number
}

interface WorkMediaRow {
  alt: string | null
  assetId: string
  position: number
  primary: number
  role: 'design_sheet' | 'studio_photo'
  workId: string
}

interface PublicVariantRow extends VariantRecord {
  assetId: string
}

interface SnapshotEntry {
  designSheet: {
    alt: string
    assetId: string
    sources: PublicSourceSetDto
  } | null
  featured: boolean
  /** 只用于首页精选排序；公开列表按发布时间倒序，不看这个值。 */
  id: string
  purpose: PublishedWorkRow['purpose']
  sortOrder: number
  studioPhotos: Array<{
    alt: string
    assetId: string
    card: PublicSourceSetDto | null
    position: number
    primary: number
    sources: PublicSourceSetDto
  }>
  suitType: PublishedWorkRow['suitType']
  summary: PublicWorkSummaryDto
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
  usage: 'design-sheet' | 'detail' | 'work-card',
) {
  for (const recipeVersion of [
    PUBLIC_RECIPE_VERSION,
    LEGACY_PUBLIC_RECIPE_VERSION,
  ]) {
    try {
      const sources = toPublicSourceSetDto(
        variants.filter(variant => (
          variant.usage === usage
          && variant.recipeVersion === recipeVersion
        )),
        mediaBaseUrl,
        publicRecipeWidths(usage),
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
      // A complete previous recipe remains visible until v2 is complete.
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
      species, suit_type AS suitType, purpose,
      adoption_method AS adoptionMethod,
      business_status AS businessStatus,
      event_name AS eventName,
      event_time AS eventTime,
      owner_display AS ownerDisplay,
      price_amount_minor AS priceAmountMinor,
      price_currency AS priceCurrency,
      publication_status AS publicationStatus,
      sort_order AS sortOrder, featured
    FROM works
    WHERE publication_status = 'published'
    ORDER BY COALESCE(published_at, created_at) DESC, id
  `).all() as PublishedWorkRow[]
}

function loadTags(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT tag.work_id AS workId, tag.value
    FROM work_feature_tags AS tag
    JOIN works AS work ON work.id = tag.work_id
    WHERE work.publication_status = 'published'
    ORDER BY tag.work_id, tag.position
  `).all() as Array<{ value: string, workId: string }>
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
      AND relation.role IN ('design_sheet', 'studio_photo')
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
      AND variant.media_role IN ('design_sheet', 'studio_photo')
      AND variant.usage IN ('work-card', 'detail', 'design-sheet')
      AND variant.recipe_version IN ('recipe-v2', 'recipe-v1')
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
): SnapshotEntry[] {
  const tagsByWork = groupBy(loadTags(sqlite), tag => tag.workId)
  const mediaByWork = groupBy(loadWorkMedia(sqlite), media => media.workId)
  const variantsByAsset = groupBy(
    loadCurrentPublicVariants(sqlite),
    variant => variant.assetId,
  )
  const entries: SnapshotEntry[] = []

  for (const row of loadPublishedWorks(sqlite)) {
    const facts = toPublicWorkDto({
      ...row,
      featureTags: (tagsByWork.get(row.id) ?? []).map(tag => tag.value),
      priceCnyMinor: row.priceCurrency === 'CNY'
        ? row.priceAmountMinor
        : null,
      featured: row.featured === 1,
      sortOrder: row.sortOrder,
      ownerContact: null,
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
        const detail = sourceSet(variants, mediaBaseUrl, 'detail')
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
          card: sourceSet(variants, mediaBaseUrl, 'work-card'),
        }]
      })
    const primary = photos.find(photo => photo.primary === 1 && photo.card)
    const designCard = designSheet
      ? sourceSet(
          variantsByAsset.get(designSheet.assetId) ?? [],
          mediaBaseUrl,
          'work-card',
        )
      : null
    const card = primary?.card
      ? { assetId: primary.assetId, alt: primary.alt, sources: primary.card }
      : designSheet && designCard
        ? { assetId: designSheet.assetId, alt: designSheet.alt, sources: designCard }
        : null
    if (
      !card
      || (
        row.purpose === 'adoption'
        && row.adoptionMethod === 'regular'
        && !designSheet
      )
      || (row.purpose !== 'adoption' && !primary)
    ) {
      continue
    }
    entries.push({
      featured: row.featured === 1,
      designSheet,
      id: row.id,
      purpose: row.purpose,
      sortOrder: row.sortOrder,
      suitType: row.suitType,
      summary: publicWorkSummaryDtoSchema.parse({
        work: facts,
        href: `/works/${row.slug}`,
        card,
      }),
      studioPhotos: photos,
    })
  }

  return entries
}

const ENTRY_TITLES = {
  commission: '自设委托',
  adoption: '角色领养',
} as const

function publicBusinessStatuses(sqlite: Database.Database) {
  return getPublicSiteContent(sqlite).statuses
}

/**
 * 首页聚合投影：Hero 与业务入口为关键区块，精选作品和当前领养失败时受控降级。
 * 单次 SSR 只构建一份作品快照，避免精选与领养各自重复扫描。
 */
function homeAggregate(
  sqlite: Database.Database,
  mediaBaseUrl: string,
): PublicHomeAggregateDto {
  const hero = getPublicHome(sqlite, mediaBaseUrl)
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
    const entriesSnapshot = snapshot(sqlite, mediaBaseUrl)
    featured = featuredEntries(entriesSnapshot).map(entry => entry.summary)
    // 当前领养取最新两件：快照已按发布时间倒序。
    currentAdoptions = adoptionItems(entriesSnapshot).slice(0, 2)
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
    currentAdoptions: { available: adoptionsAvailable, items: currentAdoptions },
  })
}

/**
 * 首页精选：全站唯一使用人工 `sort_order` 的位置。
 * 快照本身按发布时间倒序，因此这里显式重排。
 */
function featuredEntries(entries: readonly SnapshotEntry[]) {
  return entries
    .filter(entry => entry.featured)
    .toSorted((left, right) => (
      left.sortOrder - right.sortOrder || (left.id < right.id ? -1 : 1)
    ))
    .slice(0, 6)
}

/** T37：常规领养与展会掉落共用同一份领养投影和设定图水印变体。 */
function adoptionItems(entries: readonly SnapshotEntry[]) {
  return entries.flatMap((entry): PublicAdoptionListItemDto[] => (
    entry.summary.work.purpose === 'adoption' && entry.designSheet
      ? [publicAdoptionListItemDtoSchema.parse({
          work: entry.summary.work,
          href: entry.summary.href,
          designSheet: entry.designSheet,
        })]
      : []
  ))
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

/**
 * 领养列表 DTO：应用筛选并给出各筛选下的真实数量。
 * 非法筛选参数不抛 500，收敛为“全部”并标记 valid=false。
 */
function adoptionListDto(
  items: readonly PublicAdoptionListItemDto[],
  query: PublicAdoptionsQuery,
) {
  const parsed = publicAdoptionListQuerySchema.safeParse({ method: query.method })
  const method = parsed.success ? parsed.data.method ?? 'all' : 'all'
  const page = catalogPage(query.page)
  const matches = (item: PublicAdoptionListItemDto) => (
    method === 'all' || item.work.adoptionMethod === method
  )
  const filtered = items.filter(matches)
  return publicAdoptionListDtoSchema.parse({
    ...paginateCatalog(filtered, page, PUBLIC_ADOPTIONS_PAGE_SIZE),
    filter: { valid: parsed.success, method },
    counts: {
      all: items.length,
      regular: items.filter(
        item => item.work.adoptionMethod === 'regular',
      ).length,
      event_drop: items.filter(
        item => item.work.adoptionMethod === 'event_drop',
      ).length,
    },
  })
}

function detailFor(entries: readonly SnapshotEntry[], slug: string) {
  const currentIndex = entries.findIndex(entry => entry.summary.work.slug === slug)
  const current = entries[currentIndex]
  if (!current) {
    return null
  }
  const samePurpose = entries.filter(entry => (
    entry !== current && entry.purpose === current.purpose
  ))
  const others = entries.filter(entry => (
    entry !== current && entry.purpose !== current.purpose
  ))
  return {
    current,
    next: entries[currentIndex + 1]?.summary ?? null,
    previous: entries[currentIndex - 1]?.summary ?? null,
    related: [...samePurpose, ...others].slice(0, 3),
  }
}

export function createSqlitePublicSiteRepository(
  sqlite: Database.Database,
  mediaBaseUrl: string,
): PublicSiteRepository {
  return {
    getWorkBySlug(slug) {
      const entries = snapshot(sqlite, mediaBaseUrl)
      const match = detailFor(entries, slug)
      if (!match) {
        return null
      }
      const primaryStudioPhotoAssetId = match.current.studioPhotos.find(
        photo => photo.primary === 1,
      )?.assetId ?? null
      const studioPhotos = match.current.studioPhotos.map(photo => ({
        assetId: photo.assetId,
        alt: photo.alt,
        position: photo.position,
        sources: photo.sources,
      }))
      return publicWorkDetailDtoSchema.parse({
        work: match.current.summary.work,
        href: match.current.summary.href,
        media: {
          primaryAssetId: primaryStudioPhotoAssetId,
          primaryStudioPhotoAssetId,
          card: match.current.summary.card,
          gallery: studioPhotos,
          studioPhotos,
          ...(match.current.designSheet
            ? { designSheet: match.current.designSheet }
            : {}),
        },
        navigation: {
          previous: match.previous
            ? {
                characterName: match.previous.work.characterName,
                href: match.previous.href,
              }
            : null,
          next: match.next
            ? {
                characterName: match.next.work.characterName,
                href: match.next.href,
              }
            : null,
        },
        related: match.related.map(entry => entry.summary),
      })
    },

    listAdoptions(query = {}) {
      return adoptionListDto(adoptionItems(snapshot(sqlite, mediaBaseUrl)), query)
    },

    listWorks(query = {}) {
      const page = catalogPage(query.page)
      const parsed = publicWorkListQuerySchema.safeParse({
        purpose: query.purpose,
        suitType: query.suitType,
      })
      if (!parsed.success) {
        return publicWorkListDtoSchema.parse({
          items: [],
          resultCount: 0,
          page,
          pageCount: 0,
          pageSize: PUBLIC_WORKS_PAGE_SIZE,
          filter: { valid: false, purpose: null, suitType: null },
        })
      }
      const items = snapshot(sqlite, mediaBaseUrl)
        .filter(entry => entry.studioPhotos.length > 0)
        .filter(entry => (
          (!parsed.data.purpose || entry.purpose === parsed.data.purpose)
          && (!parsed.data.suitType || entry.suitType === parsed.data.suitType)
        ))
        .map(entry => entry.summary)
      return publicWorkListDtoSchema.parse({
        ...paginateCatalog(items, page, PUBLIC_WORKS_PAGE_SIZE),
        filter: {
          valid: true,
          purpose: parsed.data.purpose ?? null,
          suitType: parsed.data.suitType ?? null,
        },
      })
    },

    listFeaturedWorks() {
      const items = featuredEntries(snapshot(sqlite, mediaBaseUrl))
        .map(entry => entry.summary)
      return publicFeaturedWorksDtoSchema.parse({
        items,
        resultCount: items.length,
      })
    },

    getHome() {
      return getPublicHome(sqlite, mediaBaseUrl)
    },
    getCommissionHero() {
      return getPublicCommissionHero(sqlite, mediaBaseUrl)
    },
    getHomeAggregate() {
      return homeAggregate(sqlite, mediaBaseUrl)
    },
  }
}

export interface FakePublicSiteSeed {
  details: PublicWorkDetailDto[]
  featuredSlugs: string[]
  home: PublicHomeDto
  commissionHero?: PublicCommissionHeroDto
  statuses?: {
    adoption: PublicSiteBusinessStatusDto | null
    commission: PublicSiteBusinessStatusDto | null
  }
}

export function createFakePublicSiteRepository(
  seed: FakePublicSiteSeed,
): PublicSiteRepository {
  const details = seed.details.map(detail => publicWorkDetailDtoSchema.parse(detail))
  const home = publicHomeDtoSchema.parse(seed.home)
  const commissionHero = publicCommissionHeroDtoSchema.parse(
    seed.commissionHero ?? { slide: null },
  )
  const bySlug = new Map(details.map(detail => [detail.work.slug, detail]))
  const summaryFor = (detail: PublicWorkDetailDto) => (
    publicWorkSummaryDtoSchema.parse({
      work: detail.work,
      href: detail.href,
      card: detail.media.card,
    })
  )
  return {
    getWorkBySlug(slug) {
      const detail = bySlug.get(slug)
      return detail ? publicWorkDetailDtoSchema.parse(detail) : null
    },
    listAdoptions(query = {}) {
      const items = details.flatMap(detail => (
        detail.work.purpose === 'adoption' && detail.media.designSheet
          ? [publicAdoptionListItemDtoSchema.parse({
              work: detail.work,
              href: detail.href,
              designSheet: detail.media.designSheet,
            })]
          : []
      ))
      return adoptionListDto(items, query)
    },
    listWorks(query = {}) {
      const page = catalogPage(query.page)
      const parsed = publicWorkListQuerySchema.safeParse({
        purpose: query.purpose,
        suitType: query.suitType,
      })
      const filtered = parsed.success
        ? details.filter(detail => (
            detail.media.studioPhotos.length > 0
            && (!parsed.data.purpose || detail.work.purpose === parsed.data.purpose)
            && (!parsed.data.suitType || detail.work.suitType === parsed.data.suitType)
          ))
        : []
      return publicWorkListDtoSchema.parse({
        ...paginateCatalog(
          filtered.map(summaryFor),
          page,
          PUBLIC_WORKS_PAGE_SIZE,
        ),
        filter: parsed.success
          ? {
              valid: true,
              purpose: parsed.data.purpose ?? null,
              suitType: parsed.data.suitType ?? null,
            }
          : { valid: false, purpose: null, suitType: null },
      })
    },
    listFeaturedWorks() {
      const items = seed.featuredSlugs.flatMap((slug) => {
        const detail = bySlug.get(slug)
        return detail ? [summaryFor(detail)] : []
      }).slice(0, 6)
      return publicFeaturedWorksDtoSchema.parse({
        items,
        resultCount: items.length,
      })
    },
    getHome() {
      return publicHomeDtoSchema.parse(home)
    },
    getCommissionHero() {
      return publicCommissionHeroDtoSchema.parse(commissionHero)
    },
    getHomeAggregate() {
      const entryCard = (kind: 'adoption' | 'commission') => {
        const entry = home.entries[kind]
        const status = seed.statuses?.[kind] ?? null
        return entry
          ? {
              ...entry,
              title: ENTRY_TITLES[kind],
              status,
              summary: status?.detail ?? null,
            }
          : null
      }
      const featured = seed.featuredSlugs.flatMap((slug) => {
        const detail = bySlug.get(slug)
        return detail ? [summaryFor(detail)] : []
      }).slice(0, 6)
      return publicHomeAggregateDtoSchema.parse({
        hero: home,
        entries: {
          commission: entryCard('commission'),
          adoption: entryCard('adoption'),
        },
        featured: { available: true, items: featured },
        currentAdoptions: {
          available: true,
          items: this.listAdoptions().items.slice(0, 2),
        },
      })
    },
  }
}

export function getPublicSiteRepository() {
  return createSqlitePublicSiteRepository(
    getDatabase().sqlite,
    getRuntimeConfig().mediaBaseUrl,
  )
}
