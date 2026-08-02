import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  apiErrorSchema,
  apiSuccessSchema,
  idempotentRequestSchema,
  idempotencyKeySchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from '../../shared/schemas/api'
import {
  adminWorkDtoSchema,
  createWorkRequestSchema,
  publicWorkDtoSchema,
  returnPhotoConsentSchema,
  updateWorkRequestSchema,
  workFeatureTagsSchema,
} from '../../shared/schemas/work'
import {
  toAdminWorkDto,
  toPublicWorkDto,
} from '../../server/utils/work-mapper'
import {
  createWatermarkProfileRequestSchema,
  createWatermarkUploadSessionRequestSchema,
} from '../../shared/schemas/watermark'
import type { WorkRecord } from '../../server/utils/work-mapper'

const baseRecord: WorkRecord = {
  id: '018f47a0-5a8d-7c3c-84c2-75ecf3f7ca3b',
  version: 3,
  slug: 'blue-dog',
  characterName: '蓝犬',
  species: '犬',
  suitType: 'full',
  purpose: 'adoption',
  publicationStatus: 'published',
  ownerDisplay: '不公开',
  featureTags: [
    '纯海绵头',
    '内置风扇',
  ],
  adoptionMethod: 'event_drop',
  businessStatus: 'event_sale',
  currentEventName: '测试展会',
  featured: true,
  priceCnyMinor: 1_560_000,
  sortOrder: 4,
  ownerContact: 'private-contact',
  assetIds: [
    'be9c4a94-32cd-4d17-9050-f7f57fed9742',
  ],
  originalObjectKeys: ['private/original/secret.jpg'],
}

describe('shared API contracts', () => {
  it('validates resource versions, idempotency keys and envelopes', () => {
    expect(resourceVersionSchema.parse(0)).toBe(0)
    expect(idempotencyKeySchema.parse('work:create:018f47a0')).toBe(
      'work:create:018f47a0',
    )
    expect(apiSuccessSchema(resourceVersionSchema).parse({
      data: 2,
    })).toEqual({ data: 2 })
    expect(idempotentRequestSchema(resourceVersionSchema).parse({
      idempotencyKey: 'work:create:018f47a0',
      payload: 0,
    })).toEqual({
      idempotencyKey: 'work:create:018f47a0',
      payload: 0,
    })
    expect(versionedRequestSchema(resourceVersionSchema).parse({
      expectedVersion: 2,
      payload: 3,
    })).toEqual({
      expectedVersion: 2,
      payload: 3,
    })
    expect(apiErrorSchema.parse({
      error: {
        code: 'CONFLICT',
        message: 'Resource changed.',
      },
    })).toEqual({
      error: {
        code: 'CONFLICT',
        message: 'Resource changed.',
      },
    })
  })

  it('defaults centered watermark controls and rejects out-of-range or disable input', () => {
    const base = {
      expectedVersion: 1,
      payload: {
        sourceAssetId: '550e8400-e29b-41d4-a716-446655440000',
      },
    }
    expect(createWatermarkProfileRequestSchema.parse(base).payload)
      .toMatchObject({ opacityPercent: 50, scalePercent: 60 })
    expect(createWatermarkProfileRequestSchema.safeParse({
      ...base,
      payload: { ...base.payload, opacityPercent: 9 },
    }).success).toBe(false)
    expect(createWatermarkProfileRequestSchema.safeParse({
      ...base,
      payload: { ...base.payload, scalePercent: 91 },
    }).success).toBe(false)
    expect(createWatermarkProfileRequestSchema.safeParse({
      ...base,
      payload: { ...base.payload, enabled: false },
    }).success).toBe(false)
    expect(createWatermarkUploadSessionRequestSchema.safeParse({
      expectedVersion: 1,
      payload: {
        expected: {
          contentType: 'image/jpeg',
          byteSize: 1024,
          contentMd5: 'AAAAAAAAAAAAAAAAAAAAAA==',
          sha256: 'a'.repeat(64),
          width: 512,
          height: 512,
        },
      },
    }).success).toBe(false)
  })
})

describe('work feature tags', () => {
  it('normalizes 0-8 unique tags with 1-24 characters', () => {
    expect(workFeatureTagsSchema.parse([])).toEqual([])
    expect(workFeatureTagsSchema.parse([
      '  内置风扇  ',
      ...Array.from({ length: 7 }, (_, index) => `属性${index}`),
    ])).toHaveLength(8)
    expect(workFeatureTagsSchema.safeParse(Array.from(
      { length: 9 },
      (_, index) => `属性${index}`,
    )).success).toBe(false)
    expect(workFeatureTagsSchema.safeParse([
      '内置风扇',
      ' 内置风扇 ',
    ]).success).toBe(false)
    expect(workFeatureTagsSchema.safeParse(['']).success).toBe(false)
    expect(workFeatureTagsSchema.safeParse(['犬'.repeat(25)]).success).toBe(
      false,
    )
  })
})

describe('T22 work mutation contracts', () => {
  const common = {
    slug: 'new-work',
    characterName: ' 新角色 ',
    species: '犬科',
    suitType: 'partial' as const,
    ownerDisplay: ' 公开角色主 ',
    ownerContact: null,
    featureTags: [' 柔软 ', '大尾巴'],
    sortOrder: 7,
    featured: true,
  }

  it('uses a strict purpose union for commission, showcase and regular adoption', () => {
    for (const purpose of ['commission', 'showcase'] as const) {
      expect(createWorkRequestSchema.parse({ ...common, purpose })).toMatchObject({
        purpose,
        ownerDisplay: '公开角色主',
        featureTags: ['柔软', '大尾巴'],
        sortOrder: 7,
        featured: true,
      })
    }
    expect(createWorkRequestSchema.parse({
      ...common,
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      priceCnyMinor: 1,
    })).toMatchObject({
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      priceCnyMinor: 1,
    })
    expect(updateWorkRequestSchema.parse({
      expectedVersion: 3,
      payload: { ...common, purpose: 'showcase' },
    }).expectedVersion).toBe(3)
  })

  it('rejects cross-purpose fields, event management and invalid CNY minor units', () => {
    expect(createWorkRequestSchema.safeParse({
      ...common,
      purpose: 'showcase',
      adoptionMethod: 'regular',
    }).success).toBe(false)
    expect(createWorkRequestSchema.safeParse({
      ...common,
      purpose: 'adoption',
      adoptionMethod: 'event_drop',
      businessStatus: 'event_sale',
      currentEventName: '未建模展会',
      priceCnyMinor: 100,
    }).success).toBe(false)
    for (const priceCnyMinor of [0, -1, 1.5]) {
      expect(createWorkRequestSchema.safeParse({
        ...common,
        purpose: 'adoption',
        adoptionMethod: 'regular',
        businessStatus: 'available',
        priceCnyMinor,
      }).success).toBe(false)
    }
    expect(createWorkRequestSchema.safeParse({
      ...common,
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      priceCnyMinor: 100,
      priceCurrency: 'USD',
    }).success).toBe(false)
  })
})

describe('return photo consent records', () => {
  it('keeps every consent field nullable and private from work DTOs', () => {
    expect(returnPhotoConsentSchema.parse({
      consentSource: null,
      consentConfirmedAt: null,
      consentNote: null,
    })).toEqual({
      consentSource: null,
      consentConfirmedAt: null,
      consentNote: null,
    })
    expect(returnPhotoConsentSchema.parse({
      consentSource: 'qq',
      consentConfirmedAt: '2026-07-30T12:00:00+08:00',
      consentNote: '已在聊天中确认',
    })).toMatchObject({
      consentSource: 'qq',
    })
    expect(returnPhotoConsentSchema.safeParse({
      consentSource: 'chat',
      consentConfirmedAt: null,
      consentNote: null,
    }).success).toBe(false)
  })
})

describe('work DTO mapping', () => {
  it('publishes adoption price and ordered tags without private fields', () => {
    const publicDto = toPublicWorkDto({
      ...baseRecord,
      signedUrl: 'https://oss.test/private.jpg?signature=test-signature',
      consentNote: 'private-consent',
      passwordHash: 'private-password-hash',
      sessionToken: 'private-session-token',
      internalErrorMessage: 'private-error-detail',
      draftVariantUrl: 'https://oss.test/private-draft.jpg',
    } as WorkRecord & {
      signedUrl: string
      consentNote: string
      passwordHash: string
      sessionToken: string
      internalErrorMessage: string
      draftVariantUrl: string
    })
    const serialized = JSON.stringify(publicDto)

    expect(publicDto).toMatchObject({
      price: {
        currency: 'CNY',
        minorUnits: 1_560_000,
      },
      featureTags: [
        '纯海绵头',
        '内置风扇',
      ],
    })
    expect(serialized).not.toContain('private-contact')
    expect(serialized).not.toContain('private-consent')
    expect(serialized).not.toContain('test-signature')
    expect(serialized).not.toContain('secret.jpg')
    expect(serialized).not.toContain('ownerContact')
    expect(serialized).not.toContain('originalObjectKeys')
    expect(serialized).not.toContain('signedUrl')
    expect(serialized).not.toContain('consentNote')
    expect(serialized).not.toContain('private-password-hash')
    expect(serialized).not.toContain('private-session-token')
    expect(serialized).not.toContain('private-error-detail')
    expect(serialized).not.toContain('private-draft')
    expect(publicWorkDtoSchema.safeParse({
      ...publicDto,
      ownerContact: 'private-contact',
    }).success).toBe(false)
  })

  it('does not project price for non-adoption work', () => {
    const publicDto = toPublicWorkDto({
      ...baseRecord,
      purpose: 'commission',
      adoptionMethod: null,
      businessStatus: null,
    })

    expect(publicDto).not.toHaveProperty('price')
    expect(adminWorkDtoSchema.safeParse({
      ...toAdminWorkDto({
        ...baseRecord,
        purpose: 'commission',
        adoptionMethod: null,
        businessStatus: null,
        priceCnyMinor: null,
      }),
      priceCnyMinor: 1_560_000,
    }).success).toBe(false)
  })

  it('keeps drafts private and exposes private fields only in admin DTOs', () => {
    expect(toPublicWorkDto({
      ...baseRecord,
      publicationStatus: 'draft',
    })).toBeNull()

    const adminDto = toAdminWorkDto(baseRecord)
    expect(adminDto.private).toEqual({
      ownerContact: 'private-contact',
    })
    expect(adminDto.assetIds).toEqual(baseRecord.assetIds)
    expect(JSON.stringify(adminDto)).not.toContain('secret.jpg')
    expect(adminWorkDtoSchema.safeParse({
      ...adminDto,
      originalObjectKeys: ['private/original/secret.jpg'],
    }).success).toBe(false)
  })

  it('rejects non-CNY public prices', () => {
    const publicDto = toPublicWorkDto(baseRecord)!
    expect(publicWorkDtoSchema.safeParse({
      ...publicDto,
      price: {
        currency: 'USD',
        minorUnits: 1_560_000,
      },
    }).success).toBe(false)
  })
})
