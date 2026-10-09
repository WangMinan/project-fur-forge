import { describe, expect, it } from 'vitest'
import { formatCnyMinorUnits } from '../../app/utils/format'

describe('CNY display', () => {
  it('keeps the same amount and currency across languages, including cents', () => {
    expect(formatCnyMinorUnits(880000)).toBe('¥8,800')
    expect(formatCnyMinorUnits(880000, 'en')).toBe('CNY 8,800')
    expect(formatCnyMinorUnits(880050, 'en')).toBe('CNY 8,800.50')
    expect(formatCnyMinorUnits(1)).toBe('¥0.01')
  })
})
