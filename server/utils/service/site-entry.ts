import type Database from 'better-sqlite3'
import { publicHomeEntryDtoSchema } from '../../../shared/schemas/home'
import type {
  HomeEntryKind,
  PublicHomeEntryDto,
} from '../../../shared/types/contracts'
import {
  toPublicSourceSetDto,
  toSafePublicAlt,
} from '../recipe/media-mapper'
import type { VariantRecord } from '../recipe/media-mapper'
import type { MediaStorage } from '../media-storage'
import type { RuntimeConfig } from '../runtime-config'
import {
  assetSupportsSiteDisplay,
  completeSiteDisplayVariants,
  generateSiteDisplayVariants,
  HOME_ENTRY_USAGES,
  siteDisplayWidths,
} from '../recipe/site-display-recipe'

interface HomeEntrySourceRow {
  altText: string | null
  assetId: string
}

/**
 * 首页委托入口源：当前启用的委托页 Hero 横版资产。
 * 入口只借用业务源，不复用委托 Hero 的公开 URL。
 */
export function commissionEntrySource(
  sqlite: Database.Database,
): HomeEntrySourceRow | null {
  return sqlite.prepare(`
    SELECT slide.landscape_asset_id AS assetId, slide.alt_text AS altText
    FROM site_hero_slides AS slide
    JOIN assets AS asset ON asset.id = slide.landscape_asset_id
    WHERE slide.placement = 'commission' AND slide.enabled = 1
      AND asset.status = 'READY' AND asset.role = 'home_hero_landscape'
    ORDER BY slide.sort_order, slide.id
    LIMIT 1
  `).get() as HomeEntrySourceRow | undefined ?? null
}

/**
 * 首页领养入口源：当前已发布的第一件常规领养设定图。
 * 领养列表与详情继续引用有水印变体。
 */
export function adoptionEntrySource(
  sqlite: Database.Database,
): HomeEntrySourceRow | null {
  return sqlite.prepare(`
    SELECT relation.asset_id AS assetId, relation.alt_text AS altText
    FROM works AS work
    JOIN work_assets AS relation ON relation.work_id = work.id
    JOIN assets AS asset ON asset.id = relation.asset_id
    WHERE work.publication_status = 'published'
      AND work.purpose = 'adoption' AND work.adoption_method = 'regular'
      AND relation.role = 'design_sheet' AND asset.status = 'READY'
      AND asset.role = 'design_sheet'
    ORDER BY work.sort_order, work.id
    LIMIT 1
  `).get() as HomeEntrySourceRow | undefined ?? null
}

export function homeEntrySource(
  sqlite: Database.Database,
  kind: HomeEntryKind,
) {
  return kind === 'commission'
    ? commissionEntrySource(sqlite)
    : adoptionEntrySource(sqlite)
}

const ENTRY_LABELS = {
  commission: { alt: '自设委托作品照片', href: '/commission' },
  adoption: { alt: '角色领养设定图', href: '/adoptions' },
} as const satisfies Record<HomeEntryKind, { alt: string, href: string }>

export function homeEntryUsageReady(
  sqlite: Database.Database,
  kind: HomeEntryKind,
) {
  const source = homeEntrySource(sqlite, kind)
  return source
    ? assetSupportsSiteDisplay(sqlite, source.assetId, [HOME_ENTRY_USAGES[kind]])
    : false
}

/** 入口变体缺失时受控隐藏，不回退到作品水印图或私有原图。 */
export function projectHomeEntry(
  kind: HomeEntryKind,
  source: HomeEntrySourceRow | null,
  variants: readonly VariantRecord[],
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicHomeEntryDto | null {
  if (!source) {
    return null
  }
  const usage = HOME_ENTRY_USAGES[kind]
  const complete = completeSiteDisplayVariants(usage, variants)
  if (!complete) {
    return null
  }
  return publicHomeEntryDtoSchema.parse({
    kind,
    href: ENTRY_LABELS[kind].href,
    alt: toSafePublicAlt(source.altText, ENTRY_LABELS[kind].alt),
    sources: toPublicSourceSetDto(
      complete,
      mediaBaseUrl,
      siteDisplayWidths(usage),
      appEnv,
    ),
  })
}

export async function ensureHomeEntryVariants(
  sqlite: Database.Database,
  storage: MediaStorage,
  kind: HomeEntryKind,
  now = Date.now(),
) {
  const source = homeEntrySource(sqlite, kind)
  if (!source) {
    return []
  }
  return generateSiteDisplayVariants(
    sqlite,
    storage,
    source.assetId,
    [HOME_ENTRY_USAGES[kind]],
    now,
  )
}
