import type {
  SiteBusinessStatusKind,
  SiteBusinessStatusTone,
} from '../../shared/types/contracts'

/** T26–T27 站点内容与营业状态的纯展示映射/长度上限；与服务端 Schema 保持一致，不改变契约值。 */

export const SITE_STATUS_KIND_LABELS: Record<SiteBusinessStatusKind, string> = {
  commission: '委托营业状态',
  adoption: '领养营业状态',
}

export const SITE_STATUS_TONE_LABELS: Record<SiteBusinessStatusTone, string> = {
  open: '开放',
  limited: '限量开放',
  closed: '暂停',
}

export const SITE_STATUS_TONE_VALUES: SiteBusinessStatusTone[] = [
  'open',
  'limited',
  'closed',
]

export const SITE_CONTENT_LIMITS = {
  intro: 240,
  estimateNote: 600,
  emailAction: 240,
  studioFacts: 1_200,
  makingScope: 1_200,
  basicTerms: 8_000,
  privacyPolicy: 8_000,
  antiScam: 600,
  statusLabel: 40,
  statusDetail: 240,
  emailMax: 254,
  qqMax: 12,
} as const

const unsafePlainTextPattern = /[<>]|\b(?:javascript|vbscript)\s*:|data\s*:\s*text\/html/iu

/** 与服务端 plainTextSchema 相同的不安全字符判断，用于保存前的字段级提示。 */
export function hasUnsafePlainText(value: string): boolean {
  return unsafePlainTextPattern.test(value)
}

/** 可空纯文本统一归一化：去首尾空白，空串视为未填写（null）。 */
export function normalizeNullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** 与 shared contactEmailSchema 同边界的保存前提示。 */
export function isValidContactEmail(value: string): boolean {
  return value.length > 0
    && value.length <= SITE_CONTENT_LIMITS.emailMax
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
}

/** 与 shared contactQqSchema 同边界的保存前提示。 */
export function isValidContactQq(value: string): boolean {
  return /^[1-9]\d{4,11}$/u.test(value)
}

/** 服务条款等长纯文本按空行拆段渲染；输入已保证无 HTML，逐段 trim 后丢弃空段。 */
export function splitPlainTextParagraphs(value: string): string[] {
  return value
    .split(/\r?\n(?:\s*\r?\n)+/u)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
}

export interface SiteContentFormFields {
  intro: string
  estimateNote: string
  emailAction: string
  studioFacts: string
  makingScope: string
  basicTerms: string
  privacyPolicy: string
  antiScam: string
}

export interface SiteStatusFormFields {
  label: string
  detail: string
}

/** 管理端保存前的字段级校验，与服务端 Schema 同边界；返回字段键 → 中文提示。 */
export function siteContentFieldIssues(form: SiteContentFormFields): Record<string, string> {
  const issues: Record<string, string> = {}
  const nullableTextFields = [
    ['intro', form.intro, SITE_CONTENT_LIMITS.intro],
    ['estimateNote', form.estimateNote, SITE_CONTENT_LIMITS.estimateNote],
    ['emailAction', form.emailAction, SITE_CONTENT_LIMITS.emailAction],
    ['studioFacts', form.studioFacts, SITE_CONTENT_LIMITS.studioFacts],
    ['makingScope', form.makingScope, SITE_CONTENT_LIMITS.makingScope],
    ['basicTerms', form.basicTerms, SITE_CONTENT_LIMITS.basicTerms],
    ['privacyPolicy', form.privacyPolicy, SITE_CONTENT_LIMITS.privacyPolicy],
    ['antiScam', form.antiScam, SITE_CONTENT_LIMITS.antiScam],
  ] as const
  for (const [field, raw, max] of nullableTextFields) {
    const value = raw.trim()
    if (value.length > max) {
      issues[field] = `最多 ${max} 字`
    }
    else if (hasUnsafePlainText(value)) {
      issues[field] = '只允许安全纯文本，不能包含 HTML 或脚本'
    }
  }
  return issues
}

export function siteStatusFieldIssues(form: SiteStatusFormFields): Record<string, string> {
  const issues: Record<string, string> = {}
  const label = form.label.trim()
  const detail = form.detail.trim()
  if (!label) {
    issues.label = '请填写公开标签'
  }
  else if (label.length > SITE_CONTENT_LIMITS.statusLabel) {
    issues.label = `最多 ${SITE_CONTENT_LIMITS.statusLabel} 字`
  }
  else if (hasUnsafePlainText(label)) {
    issues.label = '只允许安全纯文本'
  }
  if (!detail) {
    issues.detail = '请填写短说明'
  }
  else if (detail.length > SITE_CONTENT_LIMITS.statusDetail) {
    issues.detail = `最多 ${SITE_CONTENT_LIMITS.statusDetail} 字`
  }
  else if (hasUnsafePlainText(detail)) {
    issues.detail = '只允许安全纯文本'
  }
  return issues
}
