/**
 * 把 CNY 最小单位（分）格式化为公开价格文本，例如 1_560_000 → "¥15,600"。
 * 只在领养/掉落作品有已录入金额时调用；无值时整个价格区域不渲染。
 */
export function formatCnyMinorUnits(minorUnits: number): string {
  const yuan = minorUnits / 100
  const fractionDigits = Number.isInteger(yuan) ? 0 : 2

  return `¥${new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(yuan)}`
}
