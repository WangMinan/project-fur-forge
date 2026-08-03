import { describe, expect, it } from 'vitest'
import type { ManagedWorkDto } from '../../shared/types/contracts'
import { managedWorkDtoSchema } from '../../shared/schemas/work'
import { parseCnyYuanInput, toCnyYuanInput } from '../../app/utils/price'
import {
  emptyWorkForm,
  hasWorkFormError,
  historicalEventAdoption,
  parseSortOrderInput,
  toWorkFieldsPayload,
  validateWorkForm,
  workFormFromDto,
  workFormSnapshot,
} from '../../app/utils/work-form'

function managedWork(overrides: Record<string, unknown> = {}): ManagedWorkDto {
  const purposeFields = overrides.purpose === 'adoption'
    ? { designSheet: null, ...overrides }
    : overrides
  return managedWorkDtoSchema.parse({
    id: '11111111-1111-4111-8111-111111111111',
    version: 3,
    slug: 'kori',
    characterName: '小鲤',
    species: '犬',
    suitType: 'full',
    purpose: 'commission',
    ownerDisplay: '有点小狗工作室',
    featureTags: ['蓝白', '长毛'],
    sortOrder: 2,
    featured: true,
    publicationStatus: 'draft',
    studioPhotos: [],
    private: { ownerContact: 'QQ 123456' },
    ...purposeFields,
  })
}

describe('toWorkFieldsPayload', () => {
  it('omits adoption fields entirely for commission and showcase', () => {
    const form = { ...emptyWorkForm(), characterName: '小鲤', slug: 'kori', species: '犬' }
    form.priceYuan = '15600'
    form.regularBusinessStatus = 'available'

    for (const purpose of ['commission', 'showcase'] as const) {
      const payload = toWorkFieldsPayload({ ...form, purpose })
      expect(payload.purpose).toBe(purpose)
      expect(payload).not.toHaveProperty('adoptionMethod')
      expect(payload).not.toHaveProperty('businessStatus')
      expect(payload).not.toHaveProperty('priceCnyMinor')
    }
  })

  it('submits the regular adoption matrix with minor units', () => {
    const payload = toWorkFieldsPayload({
      ...emptyWorkForm(),
      characterName: '小鲤',
      priceYuan: '8800.50',
      purpose: 'adoption',
      regularBusinessStatus: 'available',
      slug: 'kori',
      sortOrder: '4',
      species: '犬',
    })

    expect(payload).toMatchObject({
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      priceCnyMinor: 880_050,
      sortOrder: 4,
    })
  })

  it('treats an empty price as no public price', () => {
    const payload = toWorkFieldsPayload({
      ...emptyWorkForm(),
      characterName: '小鲤',
      purpose: 'adoption',
      slug: 'kori',
      species: '犬',
    })

    expect(payload).toMatchObject({ priceCnyMinor: null })
  })

  it('trims text and turns a blank private contact into null', () => {
    const payload = toWorkFieldsPayload({
      ...emptyWorkForm(),
      characterName: '  小鲤  ',
      featureTags: [' 蓝白 '],
      ownerContact: '   ',
      slug: ' kori ',
      species: ' 犬 ',
    })

    expect(payload).toMatchObject({
      characterName: '小鲤',
      featureTags: ['蓝白'],
      ownerContact: null,
      slug: 'kori',
      species: '犬',
    })
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
      ownerDisplay: '  ',
      slug: 'Not A Slug',
      sortOrder: '-1',
    })

    expect(errors.characterName).toBeTruthy()
    expect(errors.species).toBeTruthy()
    expect(errors.ownerDisplay).toBeTruthy()
    expect(errors.slug).toBeTruthy()
    expect(errors.sortOrder).toBeTruthy()
  })

  it('reports empty, over-long and duplicate tags by index', () => {
    const errors = validateWorkForm({
      ...emptyWorkForm(),
      characterName: '小鲤',
      featureTags: ['蓝白', '  ', '超'.repeat(25), '蓝白'],
      slug: 'kori',
      species: '犬',
    })

    expect(errors.featureTags[0]).toBeUndefined()
    expect(errors.featureTags[1]).toContain('不能为空')
    expect(errors.featureTags[2]).toContain('24')
    expect(errors.featureTags[3]).toContain('第 1 条')
  })

  it('rejects zero, negative and over-precise prices only for adoption', () => {
    const base = {
      ...emptyWorkForm(),
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
  it('round-trips a saved adoption price without a false dirty state', () => {
    const dto = managedWork({
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      currentEventName: null,
      priceCnyMinor: 880_050,
    })
    const form = workFormFromDto(dto)

    expect(form.priceYuan).toBe('8800.50')
    expect(parseCnyYuanInput(form.priceYuan).minorUnits).toBe(880_050)
    expect(workFormSnapshot(form)).toBe(workFormSnapshot(workFormFromDto(dto)))
    expect(workFormSnapshot({ ...form, priceYuan: '8800.5' }))
      .toBe(workFormSnapshot(form))
  })

  it('excludes hidden adoption fields from the dirty baseline', () => {
    const form = workFormFromDto(managedWork())

    expect(workFormSnapshot({ ...form, priceYuan: '999' }))
      .toBe(workFormSnapshot(form))
    expect(workFormSnapshot({ ...form, featured: false }))
      .not.toBe(workFormSnapshot(form))
  })

  it('keeps an illegal price visible as a change so it can be reported', () => {
    const form = workFormFromDto(managedWork({
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      currentEventName: null,
      priceCnyMinor: null,
    }))

    expect(workFormSnapshot({ ...form, priceYuan: 'abc' }))
      .not.toBe(workFormSnapshot(form))
  })
})

describe('historicalEventAdoption', () => {
  it('flags saved event facts and ignores plain adoption records', () => {
    expect(historicalEventAdoption(managedWork())).toBeNull()
    expect(historicalEventAdoption(managedWork({
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'preparing',
      currentEventName: null,
      priceCnyMinor: null,
    }))).toBeNull()
    expect(historicalEventAdoption(managedWork({
      purpose: 'adoption',
      adoptionMethod: 'event_drop',
      businessStatus: 'event_sale',
      currentEventName: 'CFF 2025',
      priceCnyMinor: null,
    }))).toMatchObject({ currentEventName: 'CFF 2025' })
  })
})

describe('sort order and price input helpers', () => {
  it('accepts only non-negative integers for sort order', () => {
    expect(parseSortOrderInput('0').value).toBe(0)
    expect(parseSortOrderInput('12').value).toBe(12)
    expect(parseSortOrderInput(4).value).toBe(4)
    expect(parseSortOrderInput('').error).toBeTruthy()
    expect(parseSortOrderInput('1.5').error).toBeTruthy()
    expect(parseSortOrderInput('-2').error).toBeTruthy()
  })

  it('renders minor units back into a re-submittable yuan input', () => {
    expect(toCnyYuanInput(1_560_000)).toBe('15600')
    expect(toCnyYuanInput(12_345)).toBe('123.45')
    expect(parseCnyYuanInput(toCnyYuanInput(12_345)).minorUnits).toBe(12_345)
  })
})
