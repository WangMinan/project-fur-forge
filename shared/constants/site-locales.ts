export const SITE_LOCALES = [
  { code: 'zh-CN', language: 'zh-CN', name: '中文', commissionMode: 'application' },
  { code: 'en', language: 'en', name: 'English', commissionMode: 'contact' },
] as const
export const SITE_LOCALE_CODES = SITE_LOCALES.map(locale => locale.code)
export const DEFAULT_SITE_LOCALE = 'zh-CN'
