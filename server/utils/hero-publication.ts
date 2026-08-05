import type Database from 'better-sqlite3'
import type { HeroPlacement } from '../../shared/types/contracts'
import {
  LEGACY_PUBLIC_RECIPE_VERSION,
  PUBLIC_RECIPE_VERSION,
  SITE_DISPLAY_RECIPE_VERSION,
} from './media-recipe'

export type HeroMediaRole
  = | 'home_hero_landscape'
    | 'home_hero_portrait'

export interface HeroVariantCandidate {
  byteSize: number | null
  format: 'webp' | 'jpeg' | 'png'
  logoDigest: string
  mediaRole: string
  recipeVersion: string
  sha256: string | null
  status: string
  storageScope: string
  usage: string
  watermarkAnchor: string
  watermarkConfigDigest: string
  watermarkOpacityPercent: number | null
  watermarkProfile: string
  watermarkProfileId: string | null
  watermarkScalePercent: number | null
  height: number
  width: number
}

export const HERO_RECIPE = {
  home_hero_landscape: {
    usage: 'home-hero-landscape',
    widths: [768, 1280, 1920],
  },
  home_hero_portrait: {
    usage: 'home-hero-portrait',
    widths: [480, 768, 1080],
  },
} as const

const digestPattern = /^[0-9a-f]{64}$/

function correctGeometry(
  role: HeroMediaRole,
  variant: HeroVariantCandidate,
) {
  return (HERO_RECIPE[role].widths as readonly number[]).includes(variant.width)
    && variant.height === Math.round(
      variant.width * (role === 'home_hero_landscape' ? 9 / 16 : 16 / 9),
    )
}

function readyOutput(variant: HeroVariantCandidate) {
  return variant.storageScope === 'PUBLIC'
    && variant.status === 'READY'
    && variant.sha256 !== null
    && digestPattern.test(variant.sha256)
    && variant.byteSize !== null
    && variant.byteSize > 0
}

function eligibleSiteDisplayVariants<T extends HeroVariantCandidate>(
  role: HeroMediaRole,
  variants: readonly T[],
) {
  const recipe = HERO_RECIPE[role]
  return variants.filter(variant =>
    readyOutput(variant)
    && variant.mediaRole === role
    && variant.usage === recipe.usage
    && variant.recipeVersion === SITE_DISPLAY_RECIPE_VERSION
    && variant.watermarkProfile === 'none'
    && variant.watermarkProfileId === null
    && variant.watermarkConfigDigest === 'none'
    && variant.logoDigest === 'none'
    && variant.watermarkAnchor === 'none'
    && variant.watermarkOpacityPercent === null
    && variant.watermarkScalePercent === null
    && correctGeometry(role, variant),
  )
}

function eligibleProtectedHeroVariants<T extends HeroVariantCandidate>(
  role: HeroMediaRole,
  variants: readonly T[],
  activeProfileId: string,
  recipeVersion: string,
) {
  const recipe = HERO_RECIPE[role]
  return variants.filter(variant =>
    readyOutput(variant)
    && variant.mediaRole === role
    && variant.usage === recipe.usage
    && variant.recipeVersion === recipeVersion
    && variant.watermarkProfile === 'brand-centered-v2'
    && variant.watermarkProfileId === activeProfileId
    && digestPattern.test(variant.watermarkConfigDigest)
    && digestPattern.test(variant.logoDigest)
    && variant.watermarkAnchor === 'center'
    && variant.watermarkOpacityPercent !== null
    && variant.watermarkOpacityPercent >= 10
    && variant.watermarkOpacityPercent <= 90
    && variant.watermarkScalePercent !== null
    && variant.watermarkScalePercent >= 20
    && variant.watermarkScalePercent <= 90
    && correctGeometry(role, variant),
  )
}

function completeVariantSet<T extends HeroVariantCandidate>(
  role: HeroMediaRole,
  variants: readonly T[],
) {
  const recipe = HERO_RECIPE[role]
  const complete = recipe.widths.every(width => (
    variants.some(variant => variant.width === width && variant.format === 'webp')
    && variants.some(variant => (
      variant.width === width
      && (variant.format === 'jpeg' || variant.format === 'png')
    ))
  ))
  if (!complete) {
    throw new Error(`${role} requires complete WebP and fallback variants.`)
  }
  return variants
}

export function missingHeroVariantCount(
  role: HeroMediaRole,
  variants: readonly HeroVariantCandidate[],
) {
  const eligible = eligibleSiteDisplayVariants(role, variants)
  let missing = 0
  for (const width of HERO_RECIPE[role].widths) {
    const formats = new Set(
      eligible
        .filter(variant => variant.width === width)
        .map(variant => variant.format),
    )
    if (!formats.has('webp')) {
      missing += 1
    }
    if (!formats.has('jpeg') && !formats.has('png')) {
      missing += 1
    }
  }
  return missing
}

export function completeHeroVariants<T extends HeroVariantCandidate>(
  role: HeroMediaRole,
  variants: readonly T[],
) {
  return completeVariantSet(
    role,
    eligibleSiteDisplayVariants(role, variants),
  )
}

/**
 * Public reads prefer the new unwatermarked site-display recipe. Existing
 * enabled slides may temporarily fall back to the previous active-profile
 * recipe while T34-F1 migration regenerates their public derivatives.
 */
export function completePublicHeroVariants<T extends HeroVariantCandidate>(
  role: HeroMediaRole,
  variants: readonly T[],
  activeProfileId?: string | null,
) {
  try {
    return completeHeroVariants(role, variants)
  }
  catch {
    if (!activeProfileId) {
      throw new Error(`${role} requires a complete site display recipe.`)
    }
  }

  for (const recipeVersion of [PUBLIC_RECIPE_VERSION, LEGACY_PUBLIC_RECIPE_VERSION]) {
    try {
      return completeVariantSet(
        role,
        eligibleProtectedHeroVariants(
          role,
          variants,
          activeProfileId,
          recipeVersion,
        ),
      )
    }
    catch {
      // Continue to the next compatibility recipe.
    }
  }
  throw new Error(`${role} requires complete public variants.`)
}

export function validateHeroSlidesForPublication(
  sqlite: Database.Database,
  placement: HeroPlacement = 'home',
) {
  const rows = sqlite.prepare(`
    SELECT
      slide.id,
      slide.alt_text AS altText,
      slide.sort_order AS sortOrder,
      slide.landscape_asset_id AS landscapeAssetId,
      slide.portrait_asset_id AS portraitAssetId,
      landscape.role AS landscapeRole,
      landscape.status AS landscapeStatus,
      portrait.role AS portraitRole,
      portrait.status AS portraitStatus,
      linked.publication_status AS linkedWorkStatus
    FROM site_hero_slides AS slide
    JOIN assets AS landscape ON landscape.id = slide.landscape_asset_id
    JOIN assets AS portrait ON portrait.id = slide.portrait_asset_id
    LEFT JOIN works AS linked ON linked.id = slide.linked_work_id
    WHERE slide.enabled = 1 AND slide.placement = ?
    ORDER BY slide.sort_order
  `).all(placement) as Array<{
    id: string
    altText: string
    sortOrder: number
    landscapeAssetId: string
    portraitAssetId: string
    landscapeRole: string
    landscapeStatus: string
    portraitRole: string
    portraitStatus: string
    linkedWorkStatus: string | null
  }>

  if (rows.length < 1 || rows.length > 5) {
    throw new Error('Enabled hero slides must contain 1 to 5 items.')
  }

  const selectVariants = sqlite.prepare(`
    SELECT
      storage_scope AS storageScope,
      status,
      media_role AS mediaRole,
      usage,
      width,
      height,
      format,
      recipe_version AS recipeVersion,
      watermark_profile AS watermarkProfile,
      watermark_profile_id AS watermarkProfileId,
      watermark_config_digest AS watermarkConfigDigest,
      logo_digest AS logoDigest,
      watermark_anchor AS watermarkAnchor,
      watermark_opacity_percent AS watermarkOpacityPercent,
      watermark_scale_percent AS watermarkScalePercent,
      sha256,
      byte_size AS byteSize
    FROM asset_variants
    WHERE asset_id = ?
  `)

  for (const row of rows) {
    if (
      row.altText.trim() === ''
      || row.sortOrder < 0
      || row.sortOrder > 4
      || row.landscapeRole !== 'home_hero_landscape'
      || row.portraitRole !== 'home_hero_portrait'
      || row.landscapeStatus !== 'READY'
      || row.portraitStatus !== 'READY'
      || (row.linkedWorkStatus !== null && row.linkedWorkStatus !== 'published')
    ) {
      throw new Error(`Hero slide ${row.id} is not publication-ready.`)
    }

    try {
      completeHeroVariants(
        'home_hero_landscape',
        selectVariants.all(row.landscapeAssetId) as HeroVariantCandidate[],
      )
      completeHeroVariants(
        'home_hero_portrait',
        selectVariants.all(row.portraitAssetId) as HeroVariantCandidate[],
      )
    }
    catch {
      throw new Error(
        `Hero slide ${row.id} does not have a complete site display recipe.`,
      )
    }
  }

  return rows.length
}
