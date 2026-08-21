import { describe, expect, it } from 'vitest'
import type { ManagedWorkDto } from '../../shared/types/contracts'
import { managedWorkDtoSchema } from '../../shared/schemas/work'
import { parseCnyYuanInput, toCnyYuanInput } from '../../app/utils/price'
import {
  emptyWorkForm,
  hasWorkFormError,
  toWorkFieldsPayload,
  validateWorkForm,
  workFormFromDto,
  workFormSnapshot,
} from '../../app/utils/work-form'

function managedWork(overrides: Record<string, unknown> = {}): ManagedWorkDto {
  const purposeFields = overrides.purpose === 'adoption'
    ? {
        adoptionCover: null,
        adoptionStatus: null,
        designSheet: null,
        priceCnyMinor: null,
      }
    : {}
  return managedWorkDtoSchema.parse({
    id: '11111111-1111-4111-8111-111111111111',
    version: 3,
    slug: 'kori',
    characterName: '小鲤',
    species: '犬',
    purpose: 'commission',
    sortOrder: 2,
    featured: true,
    publicationStatus: 'draft',
    studioPhotos: [],
    ...purposeFields,
    ...overrides,
  })
}

describe('toWorkFieldsPayload', () => {
  it('omits adoption-only fields for commission and showcase', () => {
    const form = {
      ...emptyWorkForm(),
      adoptionStatus: 'available' as const,
      characterName: '小鲤',
      priceYuan: '15600',
      slug: 'kori',
      species: '犬',
    }

    for (const purpose of ['commission', 'showcase'] as const) {
      const payload = toWorkFieldsPayload({ ...form, purpose })
      expect(payload.purpose).toBe(purpose)
      expect(payload).not.toHaveProperty('adoptionStatus')
      expect(payload).not.toHaveProperty('priceCnyMinor')
    }
  })

  it('submits an explicitly confirmed adoption status and CNY minor units', () => {
    const payload = toWorkFieldsPayload({
      ...emptyWorkForm(),
      adoptionStatus: 'available',
      characterName: '小鲤',
      priceYuan: '8800.50',
      purpose: 'adoption',
      slug: 'kori',
      sortOrder: '4',
      species: '犬',
    })

    expect(payload).toEqual({
      adoptionStatus: 'available',
      characterName: '小鲤',
      featured: false,
      priceCnyMinor: 880_050,
      purpose: 'adoption',
      slug: 'kori',
      sortOrder: 4,
      species: '犬',
    })
  })

  it('treats an empty adoption price as no public price', () => {
    const payload = toWorkFieldsPayload({
      ...emptyWorkForm(),
      adoptionStatus: 'adopted',
      characterName: '小鲤',
      purpose: 'adoption',
      slug: 'kori',
      species: '犬',
    })

    expect(payload).toMatchObject({ adoptionStatus: 'adopted', priceCnyMinor: null })
  })

  it('trims target text fields', () => {
    const payload = toWorkFieldsPayload({
      ...emptyWorkForm(),
      characterName: '  小鲤  ',
      slug: ' kori ',
      species: ' 犬 ',
    })

    expect(payload).toMatchObject({
      characterName: '小鲤',
      slug: 'kori',
      species: '犬',
    })
  })

  it('refuses to infer a missing real adoption status', () => {
    expect(() => toWorkFieldsPayload({
      ...emptyWorkForm(),
      characterName: '待人工判断',
      purpose: 'adoption',
      slug: 'manual-review',
      species: '犬',
    })).toThrow('Adoption status must be confirmed')
  })
})

describe('validateWorkForm', () => {
  it('accepts a complete commission form', () => {
    const errors = validateWorkForm({
      ...emptyWorkForm(),
      characterName: '小鲤',
      slug: 'kori',
      species: '犬',
    })

    expect(hasWorkFormError(errors)).toBe(false)
  })

  it('reports required fields, slug shape and sort order', () => {
    const errors = validateWorkForm({
      ...emptyWorkForm(),
      slug: 'Not A Slug',
      sortOrder: '-1',
    })

    expect(errors.characterName).toBeTruthy()
    expect(errors.species).toBeTruthy()
    expect(errors.slug).toBeTruthy()
    expect(errors.sortOrder).toBeTruthy()
  })

  it('requires a human-confirmed adoption status', () => {
    const errors = validateWorkForm({
      ...emptyWorkForm(),
      characterName: '待人工判断',
      purpose: 'adoption',
      slug: 'manual-review',
      species: '犬',
    })

    expect(errors.adoptionStatus).toContain('负责人确认')
  })

  it('rejects invalid prices only for adoption', () => {
    const base = {
      ...emptyWorkForm(),
      adoptionStatus: 'available' as const,
      characterName: '小鲤',
      slug: 'kori',
      species: '犬',
    }

    for (const priceYuan of ['0', '-1', '12.345', '1e3']) {
      expect(validateWorkForm({ ...base, purpose: 'adoption', priceYuan }).price)
        .toBeTruthy()
      expect(validateWorkForm({ ...base, purpose: 'commission', priceYuan }).price)
        .toBeUndefined()
    }
  })
})

describe('workFormFromDto and workFormSnapshot', () => {
  it('round-trips a saved adoption without a false dirty state', () => {
    const dto = managedWork({
      purpose: 'adoption',
      adoptionStatus: 'available',
      priceCnyMinor: 880_050,
    })
    const form = workFormFromDto(dto)

    expect(form.adoptionStatus).toBe('available')
    expect(form.priceYuan).toBe('8800.50')
    expect(parseCnyYuanInput(form.priceYuan).minorUnits).toBe(880_050)
    expect(workFormSnapshot({ ...form, priceYuan: '8800.5' }))
      .toBe(workFormSnapshot(form))
  })

  it('excludes hidden adoption fields for non-adoption work', () => {
    const form = workFormFromDto(managedWork())

    expect(workFormSnapshot({ ...form, adoptionStatus: 'available', priceYuan: '999' }))
      .toBe(workFormSnapshot(form))
    expect(workFormSnapshot({ ...form, featured: false }))
      .not.toBe(workFormSnapshot(form))
  })

  it('keeps invalid adoption values visible as changes', () => {
    const form = workFormFromDto(managedWork({
      purpose: 'adoption',
      adoptionStatus: 'available',
    }))

    expect(workFormSnapshot({ ...form, adoptionStatus: 'adopted' }))
      .not.toBe(workFormSnapshot(form))
    expect(workFormSnapshot({ ...form, priceYuan: 'abc' }))
      .not.toBe(workFormSnapshot(form))
  })
})

describe('price input round trip', () => {
  it('renders minor units back into a re-submittable yuan input', () => {
    expect(toCnyYuanInput(1_560_000)).toBe('15600')
    expect(toCnyYuanInput(12_345)).toBe('123.45')
    expect(parseCnyYuanInput(toCnyYuanInput(12_345)).minorUnits).toBe(12_345)
  })
})
