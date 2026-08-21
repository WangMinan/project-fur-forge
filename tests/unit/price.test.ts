import { describe, expect, it } from 'vitest'

import { parseCnyYuanInput } from '../../app/utils/price'

/**
 * 管理端人民币输入必须与服务端契约 adminWorkDtoSchema.priceCnyMinor
 * （可选；正整数最小货币单位）保持同一接受集合，不得再用宽松
 * parseFloat + Math.round 造成两端接受集合不同。
 */
describe('parseCnyYuanInput', () => {
  it('treats blank as absent and converts supported decimal input exactly', () => {
    expect(parseCnyYuanInput('   ')).toEqual({
      minorUnits: undefined,
      error: null,
    })
    for (const [raw, expected] of [
      ['15600', 1_560_000],
      ['0.01', 1],
      ['8800.5', 880_050],
      [' 8800.55 ', 880_055],
    ] as const) {
      expect(parseCnyYuanInput(raw)).toEqual({
        minorUnits: expected,
        error: null,
      })
    }
  })

  it('rejects zero, signed, exponent, decorated and over-precise input', () => {
    for (const raw of [
      '0', '-1', '+1', '1e4', '15600元', '1,000', '1.234', '1.', '.5',
    ]) {
      const result = parseCnyYuanInput(raw)
      expect(result.minorUnits).toBeUndefined()
      expect(result.error).not.toBeNull()
    }
  })

  it('accepts the largest safe whole-yuan value and rejects overflow', () => {
    const maxYuan = Math.floor(Number.MAX_SAFE_INTEGER / 100)
    expect(parseCnyYuanInput(String(maxYuan)).minorUnits).toBe(maxYuan * 100)
    expect(parseCnyYuanInput('99999999999999999').minorUnits).toBeUndefined()
  })
})
