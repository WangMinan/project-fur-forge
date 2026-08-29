import { describe, expect, it } from 'vitest'
import {
  apiErrorSchema,
  apiSuccessSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from '../../shared/schemas/api'
import {
  adminWorkDtoSchema,
  createWorkRequestSchema,
  featuredWorkOrderRequestSchema,
  publicAdoptionWorkDtoSchema,
  publicWorkDtoSchema,
  updateWorkRequestSchema,
} from '../../shared/schemas/work'
import {
  toAdminWorkDto,
  toPublicWorkDto,
} from '../../server/utils/recipe/work-mapper'
import type { WorkRecord } from '../../server/utils/recipe/work-mapper'

const baseRecord: WorkRecord = {
  id: '018f47a0-5a8d-7c3c-84c2-75ecf3f7ca3b',
  version: 3,
  slug: 'blue-dog',
  characterName: '蓝犬',
  species: '犬',
  purpose: 'adoption',
  publicationStatus: 'published',
  adoptionStatus: 'available',
  featured: true,
  priceCnyMinor: 1_560_000,
  sortOrder: 4,
  assetIds: ['be9c4a94-32cd-4d17-9050-f7f57fed9742'],
  originalObjectKeys: ['private/original/secret.jpg'],
}

describe('shared API contracts', () => {
  it('validates resource versions and envelopes', () => {
    expect(resourceVersionSchema.parse(0)).toBe(0)
    expect(apiSuccessSchema(resourceVersionSchema).parse({ data: 2 }))
      .toEqual({ data: 2 })
    expect(versionedRequestSchema(resourceVersionSchema).parse({
      expectedVersion: 2,
      payload: 3,
    })).toEqual({ expectedVersion: 2, payload: 3 })
    expect(apiErrorSchema.parse({
      error: { code: 'CONFLICT', message: 'Resource changed.' },
    })).toEqual({
      error: { code: 'CONFLICT', message: 'Resource changed.' },
    })
  })

  it('accepts a complete featured order and rejects duplicate IDs', () => {
    const first = '11111111-1111-4111-8111-111111111111'
    const second = '22222222-2222-4222-8222-222222222222'
    expect(featuredWorkOrderRequestSchema.parse({
      payload: {
        items: [
          { id: first, expectedVersion: 2 },
          { id: second, expectedVersion: 4 },
        ],
      },
    }).payload.items).toHaveLength(2)
    expect(featuredWorkOrderRequestSchema.safeParse({
      payload: {
        items: [
          { id: first, expectedVersion: 2 },
          { id: first, expectedVersion: 2 },
        ],
      },
    }).success).toBe(false)
  })
})

describe('T22 work mutation contracts', () => {
  const common = {
    slug: 'new-work',
    characterName: ' 新角色 ',
    species: '犬科',
    sortOrder: 7,
    featured: true,
  }

  it('uses a strict purpose union and explicit adoption status', () => {
    for (const purpose of ['commission', 'showcase'] as const) {
      expect(createWorkRequestSchema.parse({ ...common, purpose })).toEqual({
        ...common,
        characterName: '新角色',
        purpose,
      })
    }
    expect(createWorkRequestSchema.parse({
      ...common,
      purpose: 'adoption',
      adoptionStatus: 'available',
      priceCnyMinor: 1,
    })).toMatchObject({
      purpose: 'adoption',
      adoptionStatus: 'available',
      priceCnyMinor: 1,
    })
    expect(updateWorkRequestSchema.parse({
      expectedVersion: 3,
      payload: { ...common, purpose: 'showcase' },
    }).expectedVersion).toBe(3)
  })

  it('rejects every retired field, cross-purpose fields and invalid prices', () => {
    const legacyFields = {
      suitType: 'partial',
      ownerDisplay: '角色主',
      ownerContact: 'private',
      featureTags: ['柔软'],
      adoptionMethod: 'regular',
      businessStatus: 'available',
      eventName: '展会',
      eventTime: '日期',
    }
    for (const [field, value] of Object.entries(legacyFields)) {
      expect(createWorkRequestSchema.safeParse({
        ...common,
        purpose: 'commission',
        [field]: value,
      }).success).toBe(false)
    }
    expect(createWorkRequestSchema.safeParse({
      ...common,
      purpose: 'showcase',
      adoptionStatus: 'available',
    }).success).toBe(false)
    expect(createWorkRequestSchema.safeParse({
      ...common,
      purpose: 'adoption',
      priceCnyMinor: 100,
    }).success).toBe(false)
    for (const priceCnyMinor of [0, -1, 1.5]) {
      expect(createWorkRequestSchema.safeParse({
        ...common,
        purpose: 'adoption',
        adoptionStatus: 'available',
        priceCnyMinor,
      }).success).toBe(false)
    }
    expect(createWorkRequestSchema.safeParse({
      ...common,
      purpose: 'adoption',
      adoptionStatus: 'available',
      priceCnyMinor: 100,
      priceCurrency: 'USD',
    }).success).toBe(false)
  })
})

describe('work DTO mapping', () => {
  it('publishes only the minimal name/species identity', () => {
    const publicDto = toPublicWorkDto({
      ...baseRecord,
      signedUrl: 'https://oss.test/private.jpg?signature=test-signature',
      passwordHash: 'private-password-hash',
      sessionToken: 'private-session-token',
    } as WorkRecord & {
      signedUrl: string
      passwordHash: string
      sessionToken: string
    })
    const serialized = JSON.stringify(publicDto)

    expect(publicDto).toEqual({
      id: baseRecord.id,
      slug: 'blue-dog',
      characterName: '蓝犬',
      species: '犬',
    })
    for (const forbidden of [
      'price',
      'purpose',
      'adoptionStatus',
      'private-contact',
      'test-signature',
      'secret.jpg',
      'ownerContact',
      'originalObjectKeys',
      'private-password-hash',
      'private-session-token',
    ]) {
      expect(serialized).not.toContain(forbidden)
    }
    expect(publicWorkDtoSchema.safeParse({
      ...publicDto,
      ownerContact: 'private-contact',
    }).success).toBe(false)
  })

  it('keeps adoption status and optional CNY price in the adoption-specific DTO', () => {
    expect(publicAdoptionWorkDtoSchema.parse({
      id: baseRecord.id,
      slug: baseRecord.slug,
      characterName: baseRecord.characterName,
      species: baseRecord.species,
      adoptionStatus: 'available',
      price: { currency: 'CNY', minorUnits: 1_560_000 },
    })).toMatchObject({ adoptionStatus: 'available' })
    expect(publicAdoptionWorkDtoSchema.safeParse({
      id: baseRecord.id,
      slug: baseRecord.slug,
      characterName: baseRecord.characterName,
      species: baseRecord.species,
      adoptionStatus: 'available',
      price: { currency: 'USD', minorUnits: 1_560_000 },
    }).success).toBe(false)
  })

  it('keeps drafts private and never projects storage identities', () => {
    expect(toPublicWorkDto({
      ...baseRecord,
      publicationStatus: 'draft',
    })).toBeNull()

    const adminDto = toAdminWorkDto(baseRecord)
    expect(adminDto).toMatchObject({
      adoptionStatus: 'available',
      assetIds: baseRecord.assetIds,
      priceCnyMinor: 1_560_000,
    })
    expect(JSON.stringify(adminDto)).not.toContain('secret.jpg')
    expect(adminWorkDtoSchema.safeParse({
      ...adminDto,
      originalObjectKeys: ['private/original/secret.jpg'],
    }).success).toBe(false)
  })

  it('clears adoption-only fields from non-adoption admin DTOs', () => {
    expect(toAdminWorkDto({
      ...baseRecord,
      purpose: 'commission',
    })).toMatchObject({
      adoptionStatus: null,
      priceCnyMinor: null,
    })
  })
})
