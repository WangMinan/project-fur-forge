import type Database from 'better-sqlite3'

export type HeroMediaRole =
  | 'home_hero_landscape'
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
  watermarkProfile: string
  height: number
  width: number
}

const heroRecipe = {
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
const watermarkAnchors = new Set([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
])

export function completeHeroVariants<T extends HeroVariantCandidate>(
  role: HeroMediaRole,
  variants: readonly T[],
) {
  const recipe = heroRecipe[role]
  const eligible = variants.filter(variant =>
    variant.storageScope === 'PUBLIC'
    && variant.status === 'READY'
    && variant.mediaRole === role
    && variant.usage === recipe.usage
    && variant.recipeVersion === 'recipe-v1'
    && variant.watermarkProfile === 'brand-standard-v1'
    && digestPattern.test(variant.logoDigest)
    && watermarkAnchors.has(variant.watermarkAnchor)
    && variant.sha256 !== null
    && digestPattern.test(variant.sha256)
    && variant.byteSize !== null
    && variant.byteSize > 0
    && (recipe.widths as readonly number[]).includes(variant.width)
    && variant.height === Math.round(
      variant.width * (
        role === 'home_hero_landscape' ? 9 / 16 : 16 / 9
      ),
    ),
  )

  for (const width of recipe.widths) {
    const formats = new Set(
      eligible
        .filter(variant => variant.width === width)
        .map(variant => variant.format),
    )

    if (
      !formats.has('webp')
      || (!formats.has('jpeg') && !formats.has('png'))
    ) {
      throw new Error(
        `${role} requires WebP and fallback variants at width ${width}.`,
      )
    }
  }

  return eligible
}

export function validateHeroSlidesForPublication(
  sqlite: Database.Database,
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
    WHERE slide.enabled = 1
    ORDER BY slide.sort_order
  `).all() as Array<{
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
    throw new Error(
      'Enabled hero slides must contain 1 to 5 items.',
    )
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
      logo_digest AS logoDigest,
      watermark_anchor AS watermarkAnchor,
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
      || (row.linkedWorkStatus !== null
        && row.linkedWorkStatus !== 'published')
    ) {
      throw new Error(
        `Hero slide ${row.id} is not publication-ready.`,
      )
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
        `Hero slide ${row.id} does not have a complete public recipe.`,
      )
    }
  }

  return rows.length
}
