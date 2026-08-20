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
import type { RuntimeConfig } from '../runtime-config'
import {
  HOME_ENTRY_USAGES,
  resolveCompleteSiteDisplayVariants,
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
    SELECT item.asset_id AS assetId, item.alt_text AS altText
    FROM site_hero_items AS item
    JOIN assets AS asset ON asset.id = item.asset_id
    WHERE item.placement = 'commission'
      AND item.orientation = 'landscape' AND item.enabled = 1
      AND asset.status = 'READY' AND asset.role = 'home_hero_landscape'
    ORDER BY item.sort_order, item.id
    LIMIT 1
  `).get() as HomeEntrySourceRow | undefined ?? null
}

/**
 * 首页领养入口源：当前已发布领养的独立横版封面。
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
      AND work.purpose = 'adoption'
      AND relation.role = 'adoption_cover' AND asset.status = 'READY'
      AND asset.role = 'adoption_cover'
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
  adoption: { alt: '角色领养横版封面', href: '/adoptions' },
} as const satisfies Record<HomeEntryKind, { alt: string, href: string }>

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
  const complete = resolveCompleteSiteDisplayVariants(usage, variants)
  if (!complete) {
    return null
  }
  return publicHomeEntryDtoSchema.parse({
    kind,
    href: ENTRY_LABELS[kind].href,
    alt: toSafePublicAlt(source.altText, ENTRY_LABELS[kind].alt),
    sources: toPublicSourceSetDto(
      complete.variants,
      mediaBaseUrl,
      complete.widths,
      appEnv,
    ),
  })
}
