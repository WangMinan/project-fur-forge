import { describe, expect, it } from 'vitest'
import { updateHomeSettingsRequestSchema } from '../../shared/schemas/home'
import {
  adminOfficialChannelsSchema,
  contactDouyinSchema,
  publicSiteContentDtoSchema,
  updateAboutContentRequestSchema,
  updateCommissionContentRequestSchema,
  updateCommissionFaqRequestSchema,
  updateContactContentRequestSchema,
  updateSiteBusinessStatusRequestSchema,
} from '../../shared/schemas/site-content'

const officialChannels = (qq: string | null = '3114559925', douyin: string | null = null) => [
  { platform: 'qq', account: qq, qrCodeAssetId: null },
  { platform: 'douyin', account: douyin, qrCodeAssetId: null },
  { platform: 'qq_group', account: null, qrCodeAssetId: null },
  { platform: 'xiaohongshu', account: null, qrCodeAssetId: null },
  { platform: 'bilibili', account: null, qrCodeAssetId: null },
] as const

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
    privacyPolicy: null,
  },
  contact: {
    officialChannels: [],
    antiScam: null,
  },
}

const FAQ_ID_A = '11111111-1111-4111-8111-111111111111'
const FAQ_ID_B = '22222222-2222-4222-8222-222222222222'
const qrCodeSources = {
  webp: [],
  fallback: [{
    src: 'https://media.example.test/test/web/qr/contact-qr-v1/contact-qr/320/qr.png',
    width: 320,
    height: 320,
    format: 'png' as const,
  }],
}

describe('restricted site content contracts', () => {
  it('accepts empty drafts per section and validates official channels', () => {
    // T34-F3：每个分区独立请求，只携带自己的字段。
    expect(updateCommissionContentRequestSchema.safeParse({
      expectedVersion: 1,
      payload: { intro: null, estimateNote: null, emailAction: null },
    }).success).toBe(true)
    expect(updateCommissionFaqRequestSchema.safeParse({
      expectedVersion: 1,
      payload: { faqs: [] },
    }).success).toBe(true)
    expect(updateAboutContentRequestSchema.safeParse({
      expectedVersion: 1,
      payload: { studioFacts: null, makingScope: null },
    }).success).toBe(true)
    // T02：邮箱与固定五平台数组属于同一个 contact 分区。
    expect(updateContactContentRequestSchema.safeParse({
      expectedVersion: 1,
      payload: {
        email: 'studio@example.test',
        officialChannels: officialChannels(),
        antiScam: null,
      },
    }).success).toBe(true)
    expect(updateContactContentRequestSchema.safeParse({
      expectedVersion: 1,
      payload: { officialChannels: officialChannels(), antiScam: null },
    }).success).toBe(false)
    for (const invalid of [
      { email: 'invalid', officialChannels: officialChannels() },
      { email: 'studio@example.test', officialChannels: officialChannels('0123') },
    ]) {
      expect(updateContactContentRequestSchema.safeParse({
        expectedVersion: 1,
        payload: { ...invalid, antiScam: null },
      }).success).toBe(false)
    }
    // 分区请求不接受其它分区字段，避免整包覆盖复活。
    expect(updateCommissionContentRequestSchema.safeParse({
      expectedVersion: 1,
      payload: { intro: null, estimateNote: null, emailAction: null, studioFacts: 'x' },
    }).success).toBe(false)
    expect(contactDouyinSchema.safeParse('to3114559925').success).toBe(true)
    expect(contactDouyinSchema.safeParse('@invalid handle').success).toBe(false)
    expect(adminOfficialChannelsSchema.safeParse(officialChannels()).success).toBe(true)
    expect(adminOfficialChannelsSchema.safeParse([
      officialChannels()[1],
      officialChannels()[0],
      ...officialChannels().slice(2),
    ]).success).toBe(false)
    // 首屏设置只写口号与轮播行为。
    expect(updateHomeSettingsRequestSchema.safeParse({
      expectedVersion: 1,
      payload: {
        tagline: '短口号',
        autoRotate: false,
        autoRotateIntervalMs: 6000,
      },
    }).success).toBe(true)
    // 旧版前端继续提交邮箱/QQ 会被拒绝，因此不会出现两个可编辑入口。
    expect(updateHomeSettingsRequestSchema.safeParse({
      expectedVersion: 1,
      payload: {
        tagline: '短口号',
        contactEmail: 'studio@example.test',
        contactQq: '3114559925',
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
      expect(updateCommissionContentRequestSchema.safeParse({
        expectedVersion: 1,
        payload: { intro, estimateNote: null, emailAction: null },
      }).success).toBe(false)
    }
    expect(updateCommissionFaqRequestSchema.safeParse({
      expectedVersion: 1,
      payload: {
        faqs: [
          { id: FAQ_ID_A, question: '怎么联系？', answer: '通过邮件联系。' },
          { id: FAQ_ID_B, question: '怎么联系？', answer: '通过公开渠道联系。' },
        ],
      },
    }).success).toBe(false)
    // 稳定 ID：缺失或重复都不接受。
    expect(updateCommissionFaqRequestSchema.safeParse({
      expectedVersion: 1,
      payload: { faqs: [{ question: '问', answer: '答' }] },
    }).success).toBe(false)
    expect(updateCommissionFaqRequestSchema.safeParse({
      expectedVersion: 1,
      payload: {
        faqs: [
          { id: FAQ_ID_A, question: '问一', answer: '答一' },
          { id: FAQ_ID_A, question: '问二', answer: '答二' },
        ],
      },
    }).success).toBe(false)
    expect(updateCommissionFaqRequestSchema.safeParse({
      expectedVersion: 1,
      payload: {
        faqs: [
          { id: FAQ_ID_A, question: '问一', answer: '答一' },
          { id: FAQ_ID_B, question: '问二', answer: '答二' },
        ],
      },
    }).success).toBe(true)
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
        termsHref: '/service',
      },
      about: {
        ...emptyContent.about,
        officialChannels: [{
          platform: 'qq',
          account: '123456789',
          qrCodeSources,
        }],
      },
      contact: {
        email: 'studio@example.test',
        officialChannels: [{
          platform: 'qq',
          account: '123456789',
          qrCodeSources,
        }],
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
