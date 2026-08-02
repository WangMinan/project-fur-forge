/**
 * 管理端人民币价格输入的严格解析，与服务端契约 `adminWorkDtoSchema.priceCnyMinor`
 * （可选；存在时为正整数最小货币单位）保持同一接受集合：
 * - 空值 = 不公开价格（`undefined`）；
 * - 非空必须是完整十进制、最多两位小数、换算后大于 0 且为安全整数；
 * - 拒绝负数、零、指数形式、尾随字符、三位及以上小数与静默四舍五入。
 */

export interface CnyInputParse {
  /** 合法非空输入换算后的最小货币单位（分）；空值或非法时为 undefined。 */
  minorUnits: number | undefined
  /** 非法非空输入的错误文案；空值或合法时为 null。 */
  error: string | null
}

const CNY_INPUT_PATTERN = /^\d+(?:\.\d{1,2})?$/
const MAX_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER)

export function parseCnyYuanInput(raw: string): CnyInputParse {
  const input = raw.trim()
  if (input === '') {
    return { minorUnits: undefined, error: null }
  }
  if (!CNY_INPUT_PATTERN.test(input)) {
    return {
      minorUnits: undefined,
      error: '请输入最多两位小数的金额，例如 15600 或 8800.50；不接受负数、指数形式或其他字符',
    }
  }
  const [yuanPart, fractionPart = ''] = input.split('.')
  const minorUnits = BigInt(yuanPart!) * 100n + BigInt(`${fractionPart}00`.slice(0, 2))
  if (minorUnits === 0n) {
    return { minorUnits: undefined, error: '金额必须大于 0；留空表示不公开价格' }
  }
  if (minorUnits > MAX_MINOR_UNITS) {
    return { minorUnits: undefined, error: '金额超出可安全表示的范围' }
  }
  return { minorUnits: Number(minorUnits), error: null }
}

/**
 * 已保存的最小货币单位回填为输入框可再次提交的元文本，
 * 保证「读取 → 编辑 → 提交」在同一接受集合内往返不失真。
 */
export function toCnyYuanInput(minorUnits: number): string {
  return minorUnits % 100 === 0
    ? String(minorUnits / 100)
    : (minorUnits / 100).toFixed(2)
}
