/**
 * 把 CNY 最小单位（分）格式化为公开价格文本，例如 1_560_000 → "¥15,600"。
 * 用于管理端与领养作品详情；无值时公开价格整行不渲染。
 */
export function formatCnyMinorUnits(minorUnits: number, locale: 'zh-CN' | 'en' = 'zh-CN'): string {
  const yuan = minorUnits / 100
  const fractionDigits = Number.isInteger(yuan) ? 0 : 2

  return `${locale === 'en' ? 'CNY ' : '¥'}${new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(yuan)}`
}
