import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  toAdminAssetDto,
  toPublicHeroSlideDto,
  toPublicVariantDto,
} from '../../server/utils/media-mapper'
import type {
  AssetRecord,
  HeroSlideRecord,
  VariantRecord,
} from '../../server/utils/media-mapper'

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
) {
  const widths = role === 'home_hero_landscape'
    ? [768, 1280, 1920]
    : [480, 768, 1080]
  const usage = role === 'home_hero_landscape'
    ? 'home-hero-landscape'
    : 'home-hero-portrait'

  return widths.flatMap(width => (['webp', 'jpeg'] as const).map(format => ({
    ...publicVariant,
    format,
    id: `550e8400-e29b-41d4-a716-${String(
      variantSequence++,
    ).padStart(12, '0')}`,
    mediaRole: role,
    objectKey: `prod/web/asset/${role}/${width}.${format}`,
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
      'https://media.example.com',
    )).toMatchObject({
      src: 'https://media.example.com/prod/web/asset/work-card.webp',
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
    }, 'https://media.example.com')).toThrow(/dot segments/)
  })

  it('maps complete hero recipes and rejects incomplete publication data', () => {
    const record: HeroSlideRecord = {
      activeWatermarkProfileId: publicVariant.watermarkProfileId!,
      id: '550e8400-e29b-41d4-a716-446655440002',
      version: 1,
      enabled: true,
      altText: '蓝白犬兽装站在浅色背景前',
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
      linkedWorkSlug: 'blue-dog',
    })
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
    }, 'https://media.example.com')).toThrow(/requires WebP and fallback/)
    expect(() => toPublicHeroSlideDto({
      ...record,
      landscapeVariants: record.landscapeVariants.map(variant => ({
        ...variant,
        usage: 'detail',
      })),
    }, 'https://media.example.com')).toThrow(/requires WebP and fallback/)
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
    }, 'https://media.example.com')).toThrow(/requires WebP and fallback/)
    expect(() => toPublicHeroSlideDto({
      ...record,
      landscapeVariants: record.landscapeVariants.map(variant => ({
        ...variant,
        height: 1,
      })),
    }, 'https://media.example.com')).toThrow(/requires WebP and fallback/)
  })
})
