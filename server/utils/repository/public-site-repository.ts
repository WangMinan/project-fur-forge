import { publicWorkAssetSources } from '../recipe/work-public-sources'
import { assetCompositions } from './work-composition-repository'
import { resolveComposition } from '../../../shared/utils/image-composition'
import type { CompositionUsage } from '../../../shared/schemas/image-composition'
import type { PublicMediaUsage } from '../recipe/media-recipe'
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
  toSafePublicAlt,
} from '../recipe/media-mapper'
import {
  getPublicCommissionHero,
  getPublicHome,
} from '../runner/home-management'
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
  imageCompositionVersion: number
  showAdoptionCoverInDetail: number
  showDesignSheetInDetail: number
  adoptionCoverSource: 'auto' | 'adoption_cover' | 'design_sheet'
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
  height: number
  position: number
  primary: number
  role: 'adoption_cover' | 'design_sheet' | 'studio_photo'
  width: number
  workId: string
}

interface SnapshotEntry {
  showAdoptionCoverInDetail: boolean
  showDesignSheetInDetail: boolean
  adoptionSourceAssetId?: string
  adoptionCatalog: PublicWorkSummaryDto['card'] | null
  homeAdoption: PublicWorkSummaryDto['card'] | null
  featuredSummary: PublicWorkSummaryDto | null
  adoption: {
    cover: PublicWorkSummaryDto['card']
    priceCnyMinor: number | null
    status: 'available' | 'adopted'
  } | null
  /** 卡片方向：竖版出厂照，或仅横版领养封面。 */
  cardOrientation: 'landscape' | 'portrait'
  designSheet: PublicWorkSummaryDto['card'] | null
  featured: boolean
  hasPortraitStudioPhoto: boolean
  /** 只用于首页精选排序；公开列表按发布时间倒序，不看这个值。 */
  id: string
  sortOrder: number
  studioPhotos: Array<{
    alt: string
    assetId: string
    card: PublicSourceSetDto | null
    position: number
    primary: number
    height: number
    sources: PublicSourceSetDto
    thumbnailSources?: PublicSourceSetDto
    width: number
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
      image_composition_version AS imageCompositionVersion, show_adoption_cover_in_detail AS showAdoptionCoverInDetail,
      show_design_sheet_in_detail AS showDesignSheetInDetail, adoption_cover_source AS adoptionCoverSource,
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
      relation.role,
      asset.width, asset.height
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

function snapshot(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'],
): SnapshotEntry[] {
  const mediaByWork = groupBy(loadWorkMedia(sqlite), media => media.workId)
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
    const composed = Boolean(row.imageCompositionVersion)
    const sources = (assetId: string, usage: PublicMediaUsage) => publicWorkAssetSources(sqlite, assetId, usage, mediaBaseUrl, appEnv)
    const fit = (item: WorkMediaRow, usage: CompositionUsage) => resolveComposition(item.role, usage, item.width, item.height, assetCompositions(sqlite, item.assetId)).mode === 'contain' ? 'contain' as const : 'cover' as const
    const cardFor = (item: WorkMediaRow | undefined, usage: PublicMediaUsage): PublicWorkSummaryDto['card'] | null => {
      if (!item) return null
      const output = sources(item.assetId, usage)
      if (!output) return null
      const thumbnail = composed ? sources(item.assetId, 'detail-thumbnail') : null
      return { assetId: item.assetId, alt: toSafePublicAlt(item.alt, row.characterName + '的作品图片'), sources: output,
        ...(thumbnail ? { thumbnailSources: thumbnail } : {}),
        ...(composed && ['work-catalog', 'home-featured', 'adoption-catalog', 'home-adoption'].includes(usage) ? { fit: usage === 'adoption-catalog' || usage === 'home-adoption' ? 'contain' as const : fit(item, usage as CompositionUsage) } : {}) }
    }
    const designMedia = media.find(item => item.role === 'design_sheet')
    const coverMedia = media.find(item => item.role === 'adoption_cover')
    const designSheet = cardFor(designMedia, 'design-sheet')
    const coverDetail = cardFor(coverMedia, composed ? 'detail' : 'adoption-card')
    const photos = media.filter(item => item.role === 'studio_photo').flatMap(photo => {
      const detail = cardFor(photo, 'detail')
      if (!detail) return []
      return [{ ...photo, alt: detail.alt, sources: detail.sources,
        ...(detail.thumbnailSources ? { thumbnailSources: detail.thumbnailSources } : {}),
        card: sources(photo.assetId, composed ? 'work-catalog' : 'work-card') }]
    })
    const primary = photos.find(photo => photo.primary === 1 && photo.card)
    const portrait = photos.find(photo => photo.primary === 1 && photo.height > photo.width && photo.card)
      ?? photos.find(photo => photo.height > photo.width && photo.card)
    const cardPhoto = portrait ?? primary
    const fallback = coverDetail ?? designSheet
    const adoption = row.purpose === 'adoption' && row.adoptionStatus !== null && fallback
      ? { cover: fallback, priceCnyMinor: row.priceCurrency === 'CNY' ? row.priceAmountMinor : null, status: row.adoptionStatus } : null
    const card = cardPhoto ? cardFor(cardPhoto, composed ? 'work-catalog' : 'work-card')
      : adoption ? (composed ? cardFor(coverDetail ? coverMedia : designMedia, 'work-catalog') : fallback) : null
    if (!card || (row.purpose === 'adoption' && !adoption)) continue
    const orientation = cardPhoto ? 'portrait' as const : 'landscape' as const
    const summary = publicWorkSummaryDtoSchema.parse({ work: facts, href: `/works/${row.slug}`, card, cardOrientation: orientation })
    const selected = row.adoptionCoverSource === 'adoption_cover' ? coverMedia
      : row.adoptionCoverSource === 'design_sheet' ? designMedia : designSheet ? designMedia : coverMedia
    const selectedLegacy = selected?.role === 'design_sheet' ? designSheet : coverDetail
    const featuredCard = cardPhoto ? cardFor(cardPhoto, composed ? 'home-featured' : 'work-card') : null
    entries.push({
      adoption, cardOrientation: orientation, featured: row.featured === 1, hasPortraitStudioPhoto: portrait !== undefined,
      designSheet, id: row.id, sortOrder: row.sortOrder, summary, studioPhotos: photos, updatedAt: row.updatedAt,
      showAdoptionCoverInDetail: Boolean(row.showAdoptionCoverInDetail), showDesignSheetInDetail: Boolean(row.showDesignSheetInDetail),
      ...(selected ? { adoptionSourceAssetId: selected.assetId } : {}),
      adoptionCatalog: composed ? cardFor(selected, 'adoption-catalog') : selectedLegacy,
      homeAdoption: composed ? cardFor(selected, 'home-adoption') : selectedLegacy,
      featuredSummary: featuredCard ? { ...summary, card: featuredCard } : null,
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
    const status = kind === 'commission' ? statuses.commission : null
    return {
      ...entry,
      title: ENTRY_TITLES[kind],
      status,
      summary: null,
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
    featured = featuredEntries(entriesSnapshot).map(entry => entry.featuredSummary!)
    // 首页与目录共用同一个领养 comparator；最多投影最新三件开放领养。
    currentAdoptions = adoptionItems(entriesSnapshot, 'home')
      .filter(item => item.work.adoptionStatus === 'available')
      .slice(0, 3)
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
    },
  })
}

/**
 * 首页精选：全站唯一使用服务端连续 `sort_order` 的位置。
 * 快照本身按发布时间倒序，因此这里显式重排。
 */
function featuredEntries(entries: readonly SnapshotEntry[]) {
  return entries
    .filter(entry => entry.featured && entry.hasPortraitStudioPhoto && entry.featuredSummary)
    .toSorted((left, right) => (
      left.sortOrder - right.sortOrder || (left.id < right.id ? -1 : 1)
    ))
    .slice(0, PUBLIC_FEATURED_LIMIT)
}

function adoptionItems(entries: readonly SnapshotEntry[], placement: 'catalog' | 'home' = 'catalog') {
  return entries
    .filter((entry): entry is SnapshotEntry & { adoption: NonNullable<SnapshotEntry['adoption']> } => (
      entry.adoption?.status === 'available' && Boolean(placement === 'home' ? entry.homeAdoption : entry.adoptionCatalog)
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
      /*
       * 公开领养列表与首页优先展示完整设定图，避免横版封面裁掉角色设定内容。
       * 尚未配置设定图的旧内容继续回退到独立领养封面。
       */
      cover: (placement === 'home' ? entry.homeAdoption : entry.adoptionCatalog)!,
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
    availableCount: items.filter(item => (
      item.work.adoptionStatus === 'available'
    )).length,
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
        ...(photo.thumbnailSources ? { thumbnailSources: photo.thumbnailSources } : {}),
      }))
      return publicWorkDetailDtoSchema.parse({
        work: match.summary.work,
        href: match.summary.href,
        ...(match.adoption
          ? {
              adoption: {
                adoptionStatus: match.adoption.status,
                ...(match.adoption.priceCnyMinor === null
                  ? {}
                  : {
                      price: {
                        currency: 'CNY',
                        minorUnits: match.adoption.priceCnyMinor,
                      },
                    }),
              },
            }
          : {}),
        media: {
          primaryAssetId,
          ...(match.adoptionSourceAssetId ? { adoptionSourceAssetId: match.adoptionSourceAssetId } : {}),
          card: match.summary.card,
          cardOrientation: match.cardOrientation,
          // 领养作品详情必须能看到横版封面，只做了单头时它是唯一的成果图；
          // 封面回落为设定图时不再重复进图集，设定图分区已展示同一张。
          ...(match.showAdoptionCoverInDetail && match.adoption && match.adoption.cover.assetId !== match.designSheet?.assetId
            ? { adoptionCover: match.adoption.cover }
            : {}),
          gallery,
          ...(match.showDesignSheetInDetail && match.designSheet
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
        .map(entry => entry.featuredSummary!)
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
