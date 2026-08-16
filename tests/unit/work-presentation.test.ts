import { describe, expect, it } from 'vitest'
import { formatCnyMinorUnits } from '../../app/utils/format'
import {
  ADOPTION_STATUS_LABELS,
  PUBLICATION_STATUS_LABELS,
  WORK_PURPOSE_FILTER_LABELS,
  WORK_PURPOSE_LABELS,
} from '../../app/utils/work-labels'
import {
  adoptionStatusSchema,
  PUBLICATION_STATUS_VALUES,
  WORK_PURPOSE_VALUES,
} from '../../shared/schemas/work'

describe('formatCnyMinorUnits', () => {
  it('formats whole yuan with grouping and no decimals', () => {
    expect(formatCnyMinorUnits(1_560_000)).toBe('¥15,600')
    expect(formatCnyMinorUnits(100)).toBe('¥1')
    expect(formatCnyMinorUnits(123_456_700)).toBe('¥1,234,567')
  })

  it('keeps two decimals when fen are present', () => {
    expect(formatCnyMinorUnits(12_345)).toBe('¥123.45')
  })
})

describe('work labels', () => {
  it('covers every target enum value', () => {
    for (const value of WORK_PURPOSE_VALUES) {
      expect(WORK_PURPOSE_LABELS[value]).toBeTruthy()
      expect(WORK_PURPOSE_FILTER_LABELS[value]).toBeTruthy()
    }
    for (const value of adoptionStatusSchema.options) {
      expect(ADOPTION_STATUS_LABELS[value]).toBeTruthy()
    }
    for (const value of PUBLICATION_STATUS_VALUES) {
      expect(PUBLICATION_STATUS_LABELS[value]).toBeTruthy()
    }
  })
})
