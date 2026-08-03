import { describe, expect, it } from 'vitest'
import { updateHomeSettingsRequestSchema } from '../../shared/schemas/home'
import {
  contactDouyinSchema,
  publicSiteContentDtoSchema,
  updateSiteBusinessStatusRequestSchema,
  updateSiteContentRequestSchema,
} from '../../shared/schemas/site-content'

const emptyContent = {
  commission: {
    intro: null,
    estimateNote: null,
    emailAction: null,
    faqs: [],
  },
  about: {
    studioFacts: null,
    makingScope: null,
    basicTerms: null,
  },
  contact: {
    douyin: null,
    antiScam: null,
  },
}

describe('restricted site content contracts', () => {
  it('accepts empty drafts and validates official channels', () => {
    expect(updateSiteContentRequestSchema.safeParse({
      expectedVersion: 1,
      payload: emptyContent,
    }).success).toBe(true)
    expect(contactDouyinSchema.safeParse('to3114559925').success).toBe(true)
    expect(contactDouyinSchema.safeParse('@invalid handle').success).toBe(false)
    expect(updateHomeSettingsRequestSchema.safeParse({
      expectedVersion: 1,
      payload: {
        tagline: '短口号',
        contactEmail: 'invalid',
        contactQq: '0123',
        autoRotate: false,
        autoRotateIntervalMs: 6000,
      },
    }).success).toBe(false)
  })

  it('rejects long text, HTML, script protocols and duplicate FAQ items', () => {
    for (const intro of [
      'x'.repeat(241),
      '<script>alert(1)</script>',
      '[打开](javascript:alert(1))',
      '<iframe src="https://example.test"></iframe>',
    ]) {
      expect(updateSiteContentRequestSchema.safeParse({
        expectedVersion: 1,
        payload: {
          ...emptyContent,
          commission: { ...emptyContent.commission, intro },
        },
      }).success).toBe(false)
    }
    expect(updateSiteContentRequestSchema.safeParse({
      expectedVersion: 1,
      payload: {
        ...emptyContent,
        commission: {
          ...emptyContent.commission,
          faqs: [
            { question: '怎么联系？', answer: '通过邮件联系。' },
            { question: '怎么联系？', answer: '通过公开渠道联系。' },
          ],
        },
      },
    }).success).toBe(false)
  })

  it('keeps business status values enumerated and public DTOs strict', () => {
    expect(updateSiteBusinessStatusRequestSchema.safeParse({
      expectedVersion: 0,
      payload: {
        tone: 'open',
        label: '可接受委托',
        detail: '以当前公开说明为准。',
      },
    }).success).toBe(true)
    expect(updateSiteBusinessStatusRequestSchema.safeParse({
      expectedVersion: 0,
      payload: {
        tone: 'busy',
        label: '自定义',
        detail: '非法枚举。',
      },
    }).success).toBe(false)

    const publicDto = {
      statuses: { commission: null, adoption: null },
      commission: {
        ...emptyContent.commission,
        email: 'studio@example.test',
        termsHref: '/about#terms',
      },
      about: {
        ...emptyContent.about,
        officialChannels: {
          email: 'studio@example.test',
          qq: '123456789',
          douyin: null,
        },
      },
      contact: {
        email: 'studio@example.test',
        qq: '123456789',
        douyin: null,
        antiScam: null,
      },
    }
    expect(publicSiteContentDtoSchema.safeParse(publicDto).success).toBe(true)
    expect(publicSiteContentDtoSchema.safeParse({
      ...publicDto,
      version: 1,
    }).success).toBe(false)
  })
})
