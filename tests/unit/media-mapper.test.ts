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
  id: '550e8400-e29b-41d4-a716-446655440001',
  storageScope: 'PUBLIC',
  status: 'READY',
  objectKey: 'prod/web/asset/work-card.webp',
  width: 768,
  height: 1024,
  format: 'webp',
  inputSha256: 'a'.repeat(64),
  internalErrorCode: null,
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

  it('requires enabled slides with complete public pairs', () => {
    const record: HeroSlideRecord = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      version: 1,
      enabled: true,
      altText: '蓝白犬兽装站在浅色背景前',
      sortOrder: 0,
      landscapeVariants: [publicVariant],
      portraitVariants: [{
        ...publicVariant,
        id: '550e8400-e29b-41d4-a716-446655440003',
        objectKey: 'prod/web/asset/portrait.webp',
      }],
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
    expect(toPublicHeroSlideDto({
      ...record,
      portraitVariants: [{
        ...publicVariant,
        storageScope: 'PRIVATE',
      }],
    }, 'https://media.example.com')).toBeNull()
  })
})
