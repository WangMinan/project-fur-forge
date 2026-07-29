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
  workFeatureTagsSchema,
} from '../../shared/schemas/work'
import {
  toAdminWorkDto,
  toPublicWorkDto,
} from '../../server/utils/work-mapper'
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
  priceCnyMinor: 1_560_000,
  ownerContact: 'private-contact',
  depositNote: 'private-deposit',
  paymentNote: 'private-payment',
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

describe('work DTO mapping', () => {
  it('publishes adoption price and ordered tags without private fields', () => {
    const publicDto = toPublicWorkDto(baseRecord)
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
    expect(serialized).not.toContain('private-deposit')
    expect(serialized).not.toContain('private-payment')
    expect(serialized).not.toContain('secret.jpg')
    expect(serialized).not.toContain('ownerContact')
    expect(serialized).not.toContain('originalObjectKeys')
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

    expect(toAdminWorkDto(baseRecord).private).toEqual({
      ownerContact: 'private-contact',
      depositNote: 'private-deposit',
      paymentNote: 'private-payment',
      originalObjectKeys: ['private/original/secret.jpg'],
    })
  })
})
