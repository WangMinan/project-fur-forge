import { describe, expect, it } from 'vitest'
import {
  hasUnsafePlainText,
  normalizeNullableText,
  SITE_CONTENT_LIMITS,
  SITE_STATUS_KIND_LABELS,
  SITE_STATUS_TONE_LABELS,
  SITE_STATUS_TONE_VALUES,
  siteContentFieldIssues,
  siteStatusFieldIssues,
  splitPlainTextParagraphs,
} from '../../app/utils/site-content'
import {
  siteBusinessStatusKindSchema,
  siteBusinessStatusToneSchema,
} from '../../shared/schemas/site-content'

function cleanForm() {
  return {
    intro: '',
    estimateNote: '',
    emailAction: '',
    studioFacts: '',
    makingScope: '',
    basicTerms: '',
    privacyPolicy: '',
    antiScam: '',
  }
}

describe('site status labels', () => {
  it('covers every contract enum value', () => {
    for (const kind of siteBusinessStatusKindSchema.options) {
      expect(SITE_STATUS_KIND_LABELS[kind]).toBeTruthy()
    }
    for (const tone of siteBusinessStatusToneSchema.options) {
      expect(SITE_STATUS_TONE_LABELS[tone]).toBeTruthy()
    }
    expect(SITE_STATUS_TONE_VALUES).toEqual([...siteBusinessStatusToneSchema.options])
  })
})

describe('normalizeNullableText', () => {
  it('trims and converts empty input to null', () => {
    expect(normalizeNullableText('  你好  ')).toBe('你好')
    expect(normalizeNullableText('   ')).toBeNull()
    expect(normalizeNullableText('')).toBeNull()
  })
})

describe('hasUnsafePlainText', () => {
  it('matches the server-side unsafe plain text boundaries', () => {
    expect(hasUnsafePlainText('包含<script>的文本')).toBe(true)
    expect(hasUnsafePlainText('javascript:alert(1)')).toBe(true)
    expect(hasUnsafePlainText('data:text/html;base64,x')).toBe(true)
    expect(hasUnsafePlainText('普通中文说明，不含标记。')).toBe(false)
  })
})

describe('splitPlainTextParagraphs', () => {
  it('splits on blank lines and drops empty segments', () => {
    expect(splitPlainTextParagraphs('第一段\n\n第二段\n   \n第三段')).toEqual([
      '第一段',
      '第二段',
      '第三段',
    ])
    expect(splitPlainTextParagraphs('单段')).toEqual(['单段'])
  })
})

describe('siteContentFieldIssues', () => {
  it('accepts an empty form (all blocks hidden publicly)', () => {
    expect(siteContentFieldIssues(cleanForm())).toEqual({})
  })

  it('flags over-limit and unsafe text per field', () => {
    const form = cleanForm()
    form.intro = 'x'.repeat(SITE_CONTENT_LIMITS.intro + 1)
    form.basicTerms = '含有 <b> 标记'
    form.privacyPolicy = 'javascript:alert(1)'
    const issues = siteContentFieldIssues(form)
    expect(issues.intro).toBeTruthy()
    expect(issues.basicTerms).toBeTruthy()
    expect(issues.privacyPolicy).toBeTruthy()
    expect(issues.estimateNote).toBeUndefined()
  })

})

describe('siteStatusFieldIssues', () => {
  it('requires label and detail within limits', () => {
    expect(siteStatusFieldIssues({ label: '', detail: '' })).toEqual({
      label: '请填写公开标签',
      detail: '请填写短说明',
    })
    expect(siteStatusFieldIssues({
      label: 'x'.repeat(SITE_CONTENT_LIMITS.statusLabel + 1),
      detail: 'x'.repeat(SITE_CONTENT_LIMITS.statusDetail + 1),
    })).toEqual({
      label: `最多 ${SITE_CONTENT_LIMITS.statusLabel} 字`,
      detail: `最多 ${SITE_CONTENT_LIMITS.statusDetail} 字`,
    })
    expect(siteStatusFieldIssues({ label: '接受委托中', detail: '当前可邮件咨询。' })).toEqual({})
  })
})
