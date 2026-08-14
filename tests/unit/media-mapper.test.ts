import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  toAdminAssetDto,
  toPublicHeroSlideDto,
  toPublicVariantDto,
} from '../../server/utils/recipe/media-mapper'
import type {
  AssetRecord,
  HeroSlideRecord,
  VariantRecord,
} from '../../server/utils/recipe/media-mapper'
import {
  LEGACY_SITE_DISPLAY_RECIPE_VERSION,
  SITE_DISPLAY_RECIPE_VERSION,
} from '../../server/utils/recipe/site-display-recipe'

const asset: AssetRecord = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  version: 1,
  role: 'studio_photo',
  status: 'READY',
  mimeType: 'image/png',
  width: 1200,
  height: 1600,
  privateObjectKey: 'prod/original/private-key.png',
  sha256: 'a'.repeat(64),
  internalErrorCode: 'PRIVATE_PROCESSING_DETAIL',
}

const publicVariant: VariantRecord = {
  byteSize: 2_048,
  id: '550e8400-e29b-41d4-a716-446655440001',
  storageScope: 'PUBLIC',
  status: 'READY',
  objectKey: 'prod/web/asset/work-card.webp',
  width: 768,
  height: 1024,
  format: 'webp',
  inputSha256: 'a'.repeat(64),
  internalErrorCode: null,
  logoDigest: 'b'.repeat(64),
  mediaRole: 'studio_photo',
  protectionMode: 'watermark',
  recipeVersion: 'recipe-v1',
  sha256: 'c'.repeat(64),
  usage: 'work-card',
  watermarkAnchor: 'center',
  watermarkConfigDigest: 'd'.repeat(64),
  watermarkOpacityPercent: 50,
  watermarkProfile: 'brand-centered-v2',
  watermarkProfileId: '550e8400-e29b-41d4-a716-446655440009',
  watermarkScalePercent: 60,
}

let variantSequence = 10

function heroVariants(
  role: 'home_hero_landscape' | 'home_hero_portrait',
  options: {
    placement?: 'commission' | 'home'
    recipeVersion?: typeof LEGACY_SITE_DISPLAY_RECIPE_VERSION | typeof SITE_DISPLAY_RECIPE_VERSION
    siteDisplay?: boolean
  } = {},
) {
  const widths = role === 'home_hero_landscape'
    ? options.siteDisplay
      && options.placement !== 'commission'
      && options.recipeVersion !== LEGACY_SITE_DISPLAY_RECIPE_VERSION
      ? [768, 1280, 1920, 2880, 3840]
      : [768, 1280, 1920]
    : [480, 768, 1080]
  const orientation = role === 'home_hero_landscape' ? 'landscape' : 'portrait'
  const usage = options.siteDisplay && options.placement === 'commission'
    ? `commission-hero-${orientation}`
    : `home-hero-${orientation}`
  const unwatermarked = {
    logoDigest: 'none',
    protectionMode: 'none',
    recipeVersion: options.recipeVersion ?? SITE_DISPLAY_RECIPE_VERSION,
    watermarkAnchor: 'none',
    watermarkConfigDigest: 'none',
    watermarkOpacityPercent: null,
    watermarkProfile: 'none',
    watermarkProfileId: null,
    watermarkScalePercent: null,
  } as const

  return widths.flatMap(width => (['webp', 'jpeg'] as const).map(format => ({
    ...publicVariant,
    ...(options.siteDisplay ? unwatermarked : {}),
    format,
    id: `550e8400-e29b-41d4-a716-${String(
      variantSequence++,
    ).padStart(12, '0')}`,
    mediaRole: role,
    objectKey: `prod/web/asset/${usage}/${width}.${format}`,
    usage,
    width,
    height: role === 'home_hero_landscape'
      ? Math.round(width * 9 / 16)
      : Math.round(width * 16 / 9),
  })))
}

describe('media DTO mapping', () => {
  it('keeps private keys and internal fields out of admin projection', () => {
    const dto = toAdminAssetDto(asset)
    const serialized = JSON.stringify(dto)

    expect(dto).toEqual({
      assetId: asset.id,
      version: 1,
      role: 'studio_photo',
      status: 'READY',
      mimeType: 'image/png',
      width: 1200,
      height: 1600,
    })
    expect(serialized).not.toContain('private-key')
    expect(serialized).not.toContain('sha256')
    expect(serialized).not.toContain('PRIVATE_PROCESSING_DETAIL')
  })

  it('only projects READY public variants and derives URL outside SQLite', () => {
    expect(toPublicVariantDto(
      publicVariant,
      'https://public-media.ditedog.com',
    )).toMatchObject({
      src: 'https://public-media.ditedog.com/prod/web/asset/work-card.webp',
    })
    expect(toPublicVariantDto({
      ...publicVariant,
      storageScope: 'PRIVATE',
      objectKey: 'prod/draft/private.webp',
    }, 'https://media.example.com')).toBeNull()
    expect(toPublicVariantDto({
      ...publicVariant,
      status: 'PENDING',
    }, 'https://media.example.com')).toBeNull()
    expect(() => toPublicVariantDto({
      ...publicVariant,
      objectKey: 'prod/web/../private.webp',
    }, 'https://public-media.ditedog.com')).toThrow(/web derivative/)
    expect(() => toPublicVariantDto({
      ...publicVariant,
      objectKey: 'prod/original/private.webp',
    }, 'https://public-media.ditedog.com')).toThrow(/web derivative/)
    expect(() => toPublicVariantDto({
      ...publicVariant,
      objectKey: 'test/run/web/asset/work-card.webp',
    }, 'https://public-media.ditedog.com', 'production')).toThrow(/web derivative/)
    expect(toPublicVariantDto({
      ...publicVariant,
      objectKey: 'dev/web/asset/work-card.webp',
    }, 'https://public-media.ditedog.com', 'development')).toMatchObject({
      src: 'https://public-media.ditedog.com/dev/web/asset/work-card.webp',
    })
  })

  it('maps complete hero recipes and rejects incomplete publication data', () => {
    const record: HeroSlideRecord = {
      activeWatermarkProfileId: publicVariant.watermarkProfileId!,
      id: '550e8400-e29b-41d4-a716-446655440002',
      version: 1,
      enabled: true,
      altText: '蓝白犬兽装站在浅色背景前',
      placement: 'home',
      sortOrder: 0,
      landscapeVariants: heroVariants('home_hero_landscape'),
      portraitVariants: heroVariants('home_hero_portrait'),
      linkedWork: {
        publicationStatus: 'published',
        slug: 'blue-dog',
      },
    }
    const dto = toPublicHeroSlideDto(record, 'https://media.example.com')
    const serialized = JSON.stringify(dto)

    expect(dto).toMatchObject({
      alt: record.altText,
      linkedWorkHref: '/works/blue-dog',
    })
    expect(dto).not.toHaveProperty('id')
    expect(dto?.landscape.webp.map(variant => variant.width)).toEqual([
      768,
      1280,
      1920,
    ])
    expect(serialized).not.toContain('variantId')
    expect(serialized).not.toContain('version')
    expect(serialized).not.toContain('PRIVATE')
    expect(serialized).not.toContain('internalErrorCode')
    expect(toPublicHeroSlideDto({
      ...record,
      enabled: false,
    }, 'https://media.example.com')).toBeNull()
    expect(() => toPublicHeroSlideDto({
      ...record,
      portraitVariants: record.portraitVariants.map(variant => ({
        ...variant,
        storageScope: 'PRIVATE',
      })),
    }, 'https://media.example.com')).toThrow(/requires complete WebP/)
    expect(() => toPublicHeroSlideDto({
      ...record,
      landscapeVariants: record.landscapeVariants.map(variant => ({
        ...variant,
        usage: 'detail',
      })),
    }, 'https://media.example.com')).toThrow(/requires complete WebP/)
    expect(() => toPublicHeroSlideDto({
      ...record,
      portraitVariants: record.portraitVariants.map(variant => ({
        ...variant,
        logoDigest: 'none',
        watermarkAnchor: 'none',
        watermarkConfigDigest: 'none',
        watermarkOpacityPercent: null,
        watermarkProfile: 'none',
        watermarkProfileId: null,
        watermarkScalePercent: null,
      })),
    }, 'https://media.example.com')).toThrow(/requires complete WebP/)
    expect(() => toPublicHeroSlideDto({
      ...record,
      landscapeVariants: record.landscapeVariants.map(variant => ({
        ...variant,
        height: 1,
      })),
    }, 'https://media.example.com')).toThrow(/requires complete WebP/)
  })

  it('prefers unwatermarked site display variants for home and commission heroes', () => {
    const base = {
      activeWatermarkProfileId: publicVariant.watermarkProfileId!,
      id: '550e8400-e29b-41d4-a716-446655440003',
      version: 1,
      enabled: true as const,
      altText: '蓝白犬兽装站在浅色背景前',
      sortOrder: 0,
      linkedWork: null,
    }
    const home: HeroSlideRecord = {
      ...base,
      placement: 'home',
      landscapeVariants: [
        ...heroVariants('home_hero_landscape'),
        ...heroVariants('home_hero_landscape', { siteDisplay: true }),
      ],
      portraitVariants: [
        ...heroVariants('home_hero_portrait'),
        ...heroVariants('home_hero_portrait', { siteDisplay: true }),
      ],
    }
    const homeDto = toPublicHeroSlideDto(home, 'https://media.example.com')
    const homeSources = [
      ...homeDto!.landscape.webp,
      ...homeDto!.landscape.fallback,
      ...homeDto!.portrait.webp,
      ...homeDto!.portrait.fallback,
    ]
    expect(homeSources).toHaveLength(16)
    expect(homeSources.every(source => source.src.includes('/home-hero-'))).toBe(true)

    const commission: HeroSlideRecord = {
      ...base,
      // 委托 Hero 只有独立 commission-hero usage 的无水印变体。
      activeWatermarkProfileId: null,
      placement: 'commission',
      landscapeVariants: heroVariants('home_hero_landscape', {
        placement: 'commission',
        siteDisplay: true,
      }),
      portraitVariants: heroVariants('home_hero_portrait', {
        placement: 'commission',
        siteDisplay: true,
      }),
    }
    const commissionDto = toPublicHeroSlideDto(
      commission,
      'https://media.example.com',
    )
    expect(commissionDto!.landscape.webp.every(
      source => source.src.includes('/commission-hero-landscape/'),
    )).toBe(true)
    expect(commissionDto!.portrait.webp.every(
      source => source.src.includes('/commission-hero-portrait/'),
    )).toBe(true)
    expect(() => toPublicHeroSlideDto({
      ...commission,
      portraitVariants: [],
    }, 'https://media.example.com')).toThrow(/no complete site display variants/)
  })

  it('falls back to one complete v1 hero set and never mixes recipe generations', () => {
    const legacy: HeroSlideRecord = {
      activeWatermarkProfileId: null,
      id: '550e8400-e29b-41d4-a716-446655440004',
      version: 1,
      enabled: true,
      altText: '旧首页首图',
      placement: 'home',
      sortOrder: 0,
      linkedWork: null,
      landscapeVariants: heroVariants('home_hero_landscape', {
        recipeVersion: LEGACY_SITE_DISPLAY_RECIPE_VERSION,
        siteDisplay: true,
      }),
      portraitVariants: heroVariants('home_hero_portrait', {
        recipeVersion: LEGACY_SITE_DISPLAY_RECIPE_VERSION,
        siteDisplay: true,
      }),
    }

    expect(toPublicHeroSlideDto(legacy, 'https://media.example.com')!
      .landscape.webp.map(variant => variant.width)).toEqual([768, 1280, 1920])

    const mixed = {
      ...legacy,
      landscapeVariants: heroVariants('home_hero_landscape', {
        siteDisplay: true,
      }),
    }
    expect(() => toPublicHeroSlideDto(mixed, 'https://media.example.com'))
      .toThrow(/no complete site display variants/)
  })
})
