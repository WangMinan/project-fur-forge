import { describe, expect, it } from 'vitest'
import { formatCnyMinorUnits } from '../../app/utils/format'
import {
  EMPTY_WORK_FILTER,
  isWorkFilterEmpty,
} from '../../app/utils/work-filters'
import {
  ADOPTION_METHOD_LABELS,
  BUSINESS_STATUS_LABELS,
  PUBLICATION_STATUS_LABELS,
  SUIT_TYPE_LABELS,
  WORK_PURPOSE_FILTER_LABELS,
  WORK_PURPOSE_LABELS,
} from '../../app/utils/work-labels'
import {
  ADOPTION_METHOD_VALUES,
  BUSINESS_STATUS_VALUES,
  PUBLICATION_STATUS_VALUES,
  SUIT_TYPE_VALUES,
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

describe('isWorkFilterEmpty', () => {
  it('detects empty and active server-echoed filters', () => {
    expect(isWorkFilterEmpty(EMPTY_WORK_FILTER)).toBe(true)
    expect(isWorkFilterEmpty({ purpose: 'adoption', suitType: null })).toBe(false)
    expect(isWorkFilterEmpty({ purpose: null, suitType: 'full' })).toBe(false)
  })
})

describe('work labels', () => {
  it('covers every enum value', () => {
    for (const value of WORK_PURPOSE_VALUES) {
      expect(WORK_PURPOSE_LABELS[value]).toBeTruthy()
      expect(WORK_PURPOSE_FILTER_LABELS[value]).toBeTruthy()
    }
    for (const value of SUIT_TYPE_VALUES) {
      expect(SUIT_TYPE_LABELS[value]).toBeTruthy()
    }
    for (const value of ADOPTION_METHOD_VALUES) {
      expect(ADOPTION_METHOD_LABELS[value]).toBeTruthy()
    }
    for (const value of BUSINESS_STATUS_VALUES) {
      expect(BUSINESS_STATUS_LABELS[value]).toBeTruthy()
    }
    for (const value of PUBLICATION_STATUS_VALUES) {
      expect(PUBLICATION_STATUS_LABELS[value]).toBeTruthy()
    }
  })
})
