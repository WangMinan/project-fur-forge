import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  toPublicVariantDto,
} from '../../server/utils/recipe/media-mapper'
import type {
  VariantRecord,
} from '../../server/utils/recipe/media-mapper'

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
}

describe('media DTO mapping', () => {
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
})
