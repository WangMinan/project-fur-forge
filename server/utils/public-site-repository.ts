import type Database from 'better-sqlite3'
import { publicHomeDtoSchema } from '../../shared/schemas/home'
import {
  publicAdoptionListDtoSchema,
  publicFeaturedWorksDtoSchema,
  publicWorkDetailDtoSchema,
  publicWorkListDtoSchema,
  publicWorkListQuerySchema,
  publicWorkSummaryDtoSchema,
} from '../../shared/schemas/public-content'
import type {
  PublicAdoptionListDto,
  PublicFeaturedWorksDto,
  PublicHomeDto,
  PublicSourceSetDto,
  PublicWorkDetailDto,
  PublicWorkListDto,
  PublicWorkSummaryDto,
} from '../../shared/types/contracts'
import { getDatabase } from './database'
import {
  toPublicSourceSetDto,
  toSafePublicAlt,
} from './media-mapper'
import type { VariantRecord } from './media-mapper'
import { getPublicHome } from './home-management'
import { publicRecipeWidths } from './media-recipe'
import { getRuntimeConfig } from './runtime-config'
import { toPublicWorkDto } from './work-mapper'

export interface PublicWorksQuery {
  purpose?: unknown
  suitType?: unknown
}

export interface PublicSiteRepository {
  getWorkBySlug(slug: string): PublicWorkDetailDto | null
  listAdoptions(): PublicAdoptionListDto
  listWorks(query?: PublicWorksQuery): PublicWorkListDto
  listFeaturedWorks(): PublicFeaturedWorksDto
  getHome(): PublicHomeDto
}

interface PublishedWorkRow {
  adoptionMethod: 'regular' | 'event_drop' | null
  businessStatus: 'preparing' | 'available' | 'event_sale' | 'scheduled' | 'in_production' | 'delivered' | null
  characterName: string
  currentEventName: string | null
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
  purpose: PublishedWorkRow['purpose']
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
  try {
    const sources = toPublicSourceSetDto(
      variants.filter(variant => variant.usage === usage),
      mediaBaseUrl,
      publicRecipeWidths(usage),
    )
    if (
      usage === 'work-card'
      && [...sources.webp, ...sources.fallback].some(variant => (
        variant.height !== Math.round(variant.width * 4 / 3)
      ))
    ) {
      return null
    }
    return sources
  }
  catch {
    return null
  }
}

function loadPublishedWorks(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT
      id, version, slug, character_name AS characterName,
      species, suit_type AS suitType, purpose,
      adoption_method AS adoptionMethod,
      business_status AS businessStatus,
      current_event_name AS currentEventName,
      owner_display AS ownerDisplay,
      price_amount_minor AS priceAmountMinor,
      price_currency AS priceCurrency,
      publication_status AS publicationStatus,
      sort_order AS sortOrder, featured
    FROM works
    WHERE publication_status = 'published'
    ORDER BY sort_order, id
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
      AND variant.recipe_version = 'recipe-v1'
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
      purpose: row.purpose,
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

function detailFor(entries: readonly SnapshotEntry[], slug: string) {
  const current = entries.find(entry => entry.summary.work.slug === slug)
  if (!current) {
    return null
  }
  const samePurpose = entries.filter(entry => (
    entry !== current && entry.purpose === current.purpose
  ))
  const others = entries.filter(entry => (
    entry !== current && entry.purpose !== current.purpose
  ))
  return { current, related: [...samePurpose, ...others].slice(0, 3) }
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
        related: match.related.map(entry => entry.summary),
      })
    },

    listAdoptions() {
      const items = snapshot(sqlite, mediaBaseUrl).flatMap(entry => (
        entry.summary.work.purpose === 'adoption'
        && entry.summary.work.adoptionMethod === 'regular'
        && entry.designSheet
          ? [{
              work: entry.summary.work,
              href: entry.summary.href,
              designSheet: entry.designSheet,
            }]
          : []
      ))
      return publicAdoptionListDtoSchema.parse({
        items,
        resultCount: items.length,
      })
    },

    listWorks(query = {}) {
      const parsed = publicWorkListQuerySchema.safeParse(query)
      if (!parsed.success) {
        return publicWorkListDtoSchema.parse({
          items: [],
          resultCount: 0,
          filter: { valid: false, purpose: null, suitType: null },
        })
      }
      const items = snapshot(sqlite, mediaBaseUrl)
        .filter(entry => (
          (!parsed.data.purpose || entry.purpose === parsed.data.purpose)
          && (!parsed.data.suitType || entry.suitType === parsed.data.suitType)
        ))
        .map(entry => entry.summary)
      return publicWorkListDtoSchema.parse({
        items,
        resultCount: items.length,
        filter: {
          valid: true,
          purpose: parsed.data.purpose ?? null,
          suitType: parsed.data.suitType ?? null,
        },
      })
    },

    listFeaturedWorks() {
      const items = snapshot(sqlite, mediaBaseUrl)
        .filter(entry => entry.featured)
        .slice(0, 6)
        .map(entry => entry.summary)
      return publicFeaturedWorksDtoSchema.parse({
        items,
        resultCount: items.length,
      })
    },

    getHome() {
      return getPublicHome(sqlite, mediaBaseUrl)
    },
  }
}

export interface FakePublicSiteSeed {
  details: PublicWorkDetailDto[]
  featuredSlugs: string[]
  home: PublicHomeDto
}

export function createFakePublicSiteRepository(
  seed: FakePublicSiteSeed,
): PublicSiteRepository {
  const details = seed.details.map(detail => publicWorkDetailDtoSchema.parse(detail))
  const home = publicHomeDtoSchema.parse(seed.home)
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
    listAdoptions() {
      const items = details.flatMap(detail => (
        detail.work.purpose === 'adoption'
        && detail.work.adoptionMethod === 'regular'
        && detail.media.designSheet
          ? [{
              work: detail.work,
              href: detail.href,
              designSheet: detail.media.designSheet,
            }]
          : []
      ))
      return publicAdoptionListDtoSchema.parse({
        items,
        resultCount: items.length,
      })
    },
    listWorks(query = {}) {
      const parsed = publicWorkListQuerySchema.safeParse(query)
      const filtered = parsed.success
        ? details.filter(detail => (
            (!parsed.data.purpose || detail.work.purpose === parsed.data.purpose)
            && (!parsed.data.suitType || detail.work.suitType === parsed.data.suitType)
          ))
        : []
      return publicWorkListDtoSchema.parse({
        items: filtered.map(summaryFor),
        resultCount: filtered.length,
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
  }
}

export function getPublicSiteRepository() {
  return createSqlitePublicSiteRepository(
    getDatabase().sqlite,
    getRuntimeConfig().mediaBaseUrl,
  )
}
