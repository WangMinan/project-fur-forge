import { describe, expect, it } from 'vitest'
import type { ManagedWorkDto } from '../../shared/types/contracts'
import { managedWorkDtoSchema } from '../../shared/schemas/work'
import { parseCnyYuanInput, toCnyYuanInput } from '../../app/utils/price'
import {
  businessTypeOf,
  emptyWorkForm,
  hasLegacyEventSaleStatus,
  hasWorkFormError,
  parseSortOrderInput,
  purposeOfBusinessType,
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
        ...overrides,
      }
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

    form.eventName = '幻夏祭 2026'
    form.eventTime = '8 月 15 日'

    for (const businessType of ['commission', 'showcase'] as const) {
      const payload = toWorkFieldsPayload({ ...form, businessType })
      expect(payload.purpose).toBe(businessType)
      expect(payload).not.toHaveProperty('adoptionMethod')
      expect(payload).not.toHaveProperty('businessStatus')
      expect(payload).not.toHaveProperty('priceCnyMinor')
      // 展会字段同样不会随非领养类型提交。
      expect(payload).not.toHaveProperty('eventName')
      expect(payload).not.toHaveProperty('eventTime')
    }
  })

  it('submits the regular adoption matrix with minor units', () => {
    const payload = toWorkFieldsPayload({
      ...emptyWorkForm(),
      characterName: '小鲤',
      businessType: 'regular_adoption',
      priceYuan: '8800.50',
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
      businessType: 'regular_adoption',
      characterName: '小鲤',
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
      expect(validateWorkForm({ ...base, businessType: 'regular_adoption', priceYuan }).price)
        .toBeTruthy()
      expect(validateWorkForm({ ...base, businessType: 'commission', priceYuan }).price)
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
      eventName: null,
      eventTime: null,
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
      eventName: null,
      eventTime: null,
      priceCnyMinor: null,
    }))

    expect(workFormSnapshot({ ...form, priceYuan: 'abc' }))
      .not.toBe(workFormSnapshot(form))
  })
})

describe('T37 business type mapping', () => {
  it('maps the four admin options to purpose and adoption method', () => {
    expect(businessTypeOf('commission', null)).toBe('commission')
    expect(businessTypeOf('showcase', null)).toBe('showcase')
    expect(businessTypeOf('adoption', 'regular')).toBe('regular_adoption')
    expect(businessTypeOf('adoption', 'event_drop')).toBe('event_drop')
    expect(businessTypeOf('adoption', null)).toBe('regular_adoption')

    expect(purposeOfBusinessType('commission')).toBe('commission')
    expect(purposeOfBusinessType('showcase')).toBe('showcase')
    expect(purposeOfBusinessType('regular_adoption')).toBe('adoption')
    expect(purposeOfBusinessType('event_drop')).toBe('adoption')
  })

  it('submits event fields only for event drops', () => {
    const base = {
      ...emptyWorkForm(),
      characterName: '掉落角色',
      eventName: ' 幻夏祭 2026 ',
      eventTime: ' 8 月 15 日 至 16 日 ',
      ownerDisplay: '不公开',
      slug: 'drop-role',
      species: '犬科',
    }

    expect(toWorkFieldsPayload({ ...base, businessType: 'event_drop' }))
      .toMatchObject({
        purpose: 'adoption',
        adoptionMethod: 'event_drop',
        eventName: '幻夏祭 2026',
        eventTime: '8 月 15 日 至 16 日',
      })

    // 切换到常规领养：展会字段提交 null，不留僵尸值。
    expect(toWorkFieldsPayload({ ...base, businessType: 'regular_adoption' }))
      .toMatchObject({
        purpose: 'adoption',
        adoptionMethod: 'regular',
        eventName: null,
        eventTime: null,
      })

    // 委托/纯展示完全不携带领养与展会字段。
    expect(toWorkFieldsPayload({ ...base, businessType: 'commission' }))
      .not.toHaveProperty('eventName')
    expect(toWorkFieldsPayload({ ...base, businessType: 'showcase' }))
      .not.toHaveProperty('adoptionMethod')
  })

  it('reads event drop fields back into the form', () => {
    const form = workFormFromDto(managedWork({
      purpose: 'adoption',
      adoptionMethod: 'event_drop',
      businessStatus: 'available',
      eventName: 'CFF 2025',
      eventTime: '2025 年 8 月 1 日',
      priceCnyMinor: null,
    }))
    expect(form.businessType).toBe('event_drop')
    expect(form.eventName).toBe('CFF 2025')
    expect(form.eventTime).toBe('2025 年 8 月 1 日')
  })

  it('flags only the legacy event_sale status', () => {
    expect(hasLegacyEventSaleStatus(managedWork({
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      eventName: null,
      eventTime: null,
      priceCnyMinor: null,
    }))).toBe(false)
    expect(hasLegacyEventSaleStatus(managedWork({
      purpose: 'adoption',
      adoptionMethod: 'event_drop',
      businessStatus: 'event_sale',
      eventName: 'CFF 2025',
      eventTime: '2025 年 8 月 1 日',
      priceCnyMinor: null,
    }))).toBe(true)
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
