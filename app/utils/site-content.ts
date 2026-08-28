import type {
  SiteBusinessStatusKind,
  SiteBusinessStatusTone,
} from '../../shared/types/contracts'

/** T26–T27 站点内容与营业状态的纯展示映射/长度上限；与服务端 Schema 保持一致，不改变契约值。 */

export const SITE_STATUS_KIND_LABELS: Record<SiteBusinessStatusKind, string> = {
  commission: '委托营业状态',
}

export const SITE_STATUS_TONE_LABELS: Record<SiteBusinessStatusTone, string> = {
  open: '开放',
  closed: '暂停',
}

export const SITE_STATUS_TONE_VALUES: SiteBusinessStatusTone[] = [
  'open',
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
  statusLabel: 40,
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

export interface PlainTextSection {
  id: string
  number: string
  paragraphs: string[]
  title: string
}

export interface StructuredPlainText {
  preface: string[]
  sections: PlainTextSection[]
}

/** 将管理员纯文本中的“数字. 标题”提升为可导航章节，其余文字保持原样。 */
export function structureNumberedPlainText(value: string): StructuredPlainText {
  const result: StructuredPlainText = { preface: [], sections: [] }
  for (const paragraph of splitPlainTextParagraphs(value)) {
    const [firstLine = '', ...remainingLines] = paragraph.split(/\r?\n/u)
    const heading = /^(\d{1,3})[.．、]\s*(.+)$/u.exec(firstLine.trim())
    if (heading) {
      const section: PlainTextSection = {
        id: `section-${result.sections.length + 1}`,
        number: heading[1]!,
        paragraphs: [],
        title: heading[2]!,
      }
      const openingParagraph = remainingLines.join('\n').trim()
      if (openingParagraph) section.paragraphs.push(openingParagraph)
      result.sections.push(section)
      continue
    }

    const currentSection = result.sections.at(-1)
    if (currentSection) currentSection.paragraphs.push(paragraph)
    else result.preface.push(paragraph)
  }
  return result
}

interface SiteStatusFormFields {
  label: string
}

export function siteStatusFieldIssues(form: SiteStatusFormFields): Record<string, string> {
  const issues: Record<string, string> = {}
  const label = form.label.trim()
  if (!label) {
    issues.label = '请填写公开标签'
  }
  else if (label.length > SITE_CONTENT_LIMITS.statusLabel) {
    issues.label = `最多 ${SITE_CONTENT_LIMITS.statusLabel} 字`
  }
  else if (hasUnsafePlainText(label)) {
    issues.label = '只允许安全纯文本'
  }
  return issues
}
