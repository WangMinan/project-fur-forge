import { describe, expect, it } from 'vitest'
import { formatCnyMinorUnits } from '../../app/utils/format'
import {
  filterWorks,
  isWorkFilterEmpty,
  parseWorkFilter,
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
import { workCatalog } from '../../shared/fixtures/visual-works'

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

describe('parseWorkFilter', () => {
  it('parses valid purpose and suit values', () => {
    expect(parseWorkFilter({ purpose: 'adoption', suit: 'full' })).toEqual({
      purpose: 'adoption',
      suitType: 'full',
    })
  })

  it('treats missing, unknown and array values as unset', () => {
    expect(parseWorkFilter({})).toEqual({ purpose: null, suitType: null })
    expect(parseWorkFilter({ purpose: 'unknown', suit: 'cape' })).toEqual({
      purpose: null,
      suitType: null,
    })
    expect(parseWorkFilter({ purpose: ['adoption', 'commission'] })).toEqual({
      purpose: 'adoption',
      suitType: null,
    })
    expect(isWorkFilterEmpty(parseWorkFilter({}))).toBe(true)
  })
})

describe('filterWorks', () => {
  it('returns the full manual order when no filter is set', () => {
    const result = filterWorks(workCatalog, { purpose: null, suitType: null })
    expect(result.map(work => work.dto.slug)).toEqual(
      workCatalog.map(work => work.dto.slug),
    )
  })

  it('applies purpose and suit type as an intersection', () => {
    const adoptionFull = filterWorks(workCatalog, {
      purpose: 'adoption',
      suitType: 'full',
    })
    expect(adoptionFull.map(work => work.dto.slug)).toEqual(['blueberry'])

    const showcasePartial = filterWorks(workCatalog, {
      purpose: 'showcase',
      suitType: 'partial',
    })
    expect(showcasePartial.map(work => work.dto.slug)).toEqual(['lizi'])
  })

  it('has a real empty combination for the empty state', () => {
    const result = filterWorks(workCatalog, {
      purpose: 'adoption',
      suitType: 'partial',
    })
    expect(result).toEqual([])
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
