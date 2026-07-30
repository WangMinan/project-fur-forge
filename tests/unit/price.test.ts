import { describe, expect, it } from 'vitest'

import { parseCnyYuanInput } from '../../app/utils/price'

/**
 * 管理端人民币输入必须与服务端契约 adminWorkDtoSchema.priceCnyMinor
 * （可选；正整数最小货币单位）保持同一接受集合，不得再用宽松
 * parseFloat + Math.round 造成两端接受集合不同。
 */
describe('parseCnyYuanInput', () => {
  it('空值表示不公开价格', () => {
    for (const raw of ['', '   ', '\t\n']) {
      const result = parseCnyYuanInput(raw)
      expect(result.minorUnits).toBeUndefined()
      expect(result.error).toBeNull()
    }
  })

  it('完整十进制换算为最小货币单位', () => {
    expect(parseCnyYuanInput('15600').minorUnits).toBe(1_560_000)
    expect(parseCnyYuanInput('1').minorUnits).toBe(100)
    expect(parseCnyYuanInput('0.01').minorUnits).toBe(1)
    expect(parseCnyYuanInput('8800.5').minorUnits).toBe(880_050)
    expect(parseCnyYuanInput('8800.50').minorUnits).toBe(880_050)
    expect(parseCnyYuanInput('8800.55').minorUnits).toBe(880_055)
    expect(parseCnyYuanInput(' 15600 ').minorUnits).toBe(1_560_000)
  })

  it('零与负值被拒绝：金额必须大于 0', () => {
    for (const raw of ['0', '0.0', '0.00', '00']) {
      const result = parseCnyYuanInput(raw)
      expect(result.minorUnits).toBeUndefined()
      expect(result.error).toContain('大于 0')
    }
    const negative = parseCnyYuanInput('-1')
    expect(negative.minorUnits).toBeUndefined()
    expect(negative.error).not.toBeNull()
  })

  it('指数形式被拒绝', () => {
    for (const raw of ['1e4', '1E4', '1.5e3', '2e-2', '156e2']) {
      const result = parseCnyYuanInput(raw)
      expect(result.minorUnits).toBeUndefined()
      expect(result.error).not.toBeNull()
    }
  })

  it('尾随字符与非数字内容被拒绝', () => {
    for (const raw of ['12abc', '15600元', '¥100', '1,000', '12 3', 'abc', 'NaN', 'Infinity', '1.2.3', '--1', '+1']) {
      const result = parseCnyYuanInput(raw)
      expect(result.minorUnits).toBeUndefined()
      expect(result.error).not.toBeNull()
    }
  })

  it('两位以上小数被拒绝，不做静默四舍五入', () => {
    for (const raw of ['1.234', '0.001', '8800.505', '3.14159']) {
      const result = parseCnyYuanInput(raw)
      expect(result.minorUnits).toBeUndefined()
      expect(result.error).not.toBeNull()
    }
  })

  it('不完整小数点被拒绝', () => {
    for (const raw of ['.', '1.', '.5', '.01']) {
      const result = parseCnyYuanInput(raw)
      expect(result.minorUnits).toBeUndefined()
      expect(result.error).not.toBeNull()
    }
  })

  it('超出安全整数的金额被拒绝', () => {
    const result = parseCnyYuanInput('99999999999999999')
    expect(result.minorUnits).toBeUndefined()
    expect(result.error).toContain('安全')

    // Number.MAX_SAFE_INTEGER / 100 以内的最大合法元值仍可接受。
    const maxYuan = Math.floor(Number.MAX_SAFE_INTEGER / 100)
    expect(parseCnyYuanInput(String(maxYuan)).minorUnits).toBe(maxYuan * 100)
  })

  it('合法值换算结果始终为整数最小货币单位', () => {
    for (const raw of ['0.01', '0.1', '9.99', '123456.78']) {
      const { minorUnits } = parseCnyYuanInput(raw)
      expect(Number.isSafeInteger(minorUnits)).toBe(true)
      expect(minorUnits).toBeGreaterThan(0)
    }
  })
})
