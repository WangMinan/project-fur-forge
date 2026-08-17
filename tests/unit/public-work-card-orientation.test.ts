import { describe, expect, it } from 'vitest'
import {
  publicWorkDetailDtoSchema,
  publicWorkSummaryDtoSchema,
} from '../../shared/schemas/public-content'
import type { PublicSourceSetDto } from '../../shared/types/contracts'

/**
 * FU-12～FU-15 公开契约：卡片方向与领养封面进入 DTO，前后导航移除。
 */
const sources: PublicSourceSetDto = {
  webp: [
    { src: 'https://media.example.test/a-768.webp', width: 768, height: 432, format: 'webp' },
  ],
  fallback: [
    { src: 'https://media.example.test/a-768.jpg', width: 768, height: 432, format: 'jpeg' },
  ],
}

const card = {
  assetId: '11111111-1111-4111-8111-111111111111',
  alt: '小绿狗的领养封面',
  sources,
}

const work = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'green-doggy',
  characterName: '小绿狗',
  species: '狗',
}

describe('public work card orientation', () => {
  it('defaults to the portrait studio-photo card when unspecified', () => {
    const summary = publicWorkSummaryDtoSchema.parse({
      work,
      href: '/works/green-doggy',
      card,
    })
    expect(summary.cardOrientation).toBe('portrait')
  })

  it('carries a landscape orientation for cover-only adoptions', () => {
    const summary = publicWorkSummaryDtoSchema.parse({
      work,
      href: '/works/green-doggy',
      card,
      cardOrientation: 'landscape',
    })
    expect(summary.cardOrientation).toBe('landscape')
  })

  it('rejects an unknown orientation', () => {
    expect(() => publicWorkSummaryDtoSchema.parse({
      work,
      href: '/works/green-doggy',
      card,
      cardOrientation: 'square',
    })).toThrow()
  })
})

describe('public work detail media', () => {
  const detail = {
    work,
    href: '/works/green-doggy',
    media: {
      primaryAssetId: null,
      card,
      cardOrientation: 'landscape' as const,
      adoptionCover: card,
      gallery: [],
    },
  }

  it('accepts an adoption cover with an empty gallery', () => {
    const parsed = publicWorkDetailDtoSchema.parse(detail)
    expect(parsed.media.adoptionCover?.assetId).toBe(card.assetId)
    expect(parsed.media.gallery).toEqual([])
    expect(parsed.media.primaryAssetId).toBeNull()
  })

  it('no longer accepts previous/next navigation', () => {
    expect(() => publicWorkDetailDtoSchema.parse({
      ...detail,
      navigation: { previous: null, next: null },
    })).toThrow()
  })

  it('no longer accepts related works', () => {
    expect(() => publicWorkDetailDtoSchema.parse({
      ...detail,
      related: [],
    })).toThrow()
  })
})
