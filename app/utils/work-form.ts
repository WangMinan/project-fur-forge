import type {
  AdoptionStatus,
  ManagedWorkDto,
  WorkFields,
  WorkPurpose,
} from '../../shared/types/contracts'
import { PUBLIC_FEATURED_LIMIT } from '~~/shared/constants/featured'
import { parseCnyYuanInput, toCnyYuanInput } from './price'

export { PUBLIC_FEATURED_LIMIT }

export interface WorkBasicsForm {
  adoptionStatus: AdoptionStatus | ''
  characterName: string
  featured: boolean
  priceYuan: string
  purpose: WorkPurpose
  slug: string
  species: string
}

export interface WorkFormErrors {
  adoptionStatus?: string
  characterName?: string
  price?: string
  slug?: string
  species?: string
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function emptyWorkForm(): WorkBasicsForm {
  return {
    adoptionStatus: '',
    characterName: '',
    featured: false,
    priceYuan: '',
    purpose: 'commission',
    slug: '',
    species: '',
  }
}

export function workFormFromDto(dto: ManagedWorkDto): WorkBasicsForm {
  const adoption = dto.purpose === 'adoption' ? dto : null
  return {
    adoptionStatus: adoption?.adoptionStatus ?? '',
    characterName: dto.characterName,
    featured: dto.featured,
    priceYuan: adoption?.priceCnyMinor != null
      ? toCnyYuanInput(adoption.priceCnyMinor)
      : '',
    purpose: dto.purpose,
    slug: dto.slug,
    species: dto.species,
  }
}

export function validateWorkForm(form: WorkBasicsForm): WorkFormErrors {
  const errors: WorkFormErrors = {}
  if (form.characterName.trim() === '') {
    errors.characterName = '角色名为必填项'
  }
  if (form.species.trim() === '') {
    errors.species = '物种为必填项'
  }
  if (!SLUG_PATTERN.test(form.slug.trim())) {
    errors.slug = '只能使用小写字母、数字与连字符，且不能以连字符开头或结尾'
  }
  if (form.purpose === 'adoption') {
    if (form.adoptionStatus === '') {
      errors.adoptionStatus = '请由负责人确认真实领养状态'
    }
    const price = parseCnyYuanInput(form.priceYuan)
    if (price.error) {
      errors.price = price.error
    }
  }
  return errors
}

export function hasWorkFormError(errors: WorkFormErrors) {
  return Object.values(errors).some(Boolean)
}

export function toWorkFieldsPayload(form: WorkBasicsForm): WorkFields {
  const base = {
    slug: form.slug.trim(),
    characterName: form.characterName.trim(),
    species: form.species.trim(),
    featured: form.featured,
  }
  if (form.purpose === 'adoption') {
    if (form.adoptionStatus === '') {
      throw new Error('Adoption status must be confirmed before saving.')
    }
    return {
      ...base,
      purpose: 'adoption',
      adoptionStatus: form.adoptionStatus,
      priceCnyMinor: parseCnyYuanInput(form.priceYuan).minorUnits ?? null,
    }
  }
  return { ...base, purpose: form.purpose }
}

export function workFormSnapshot(form: WorkBasicsForm) {
  const base = {
    characterName: form.characterName.trim(),
    featured: form.featured,
    purpose: form.purpose,
    slug: form.slug.trim(),
    species: form.species.trim(),
  }
  if (form.purpose !== 'adoption') {
    return JSON.stringify(base)
  }
  const price = parseCnyYuanInput(form.priceYuan)
  return JSON.stringify({
    ...base,
    adoptionStatus: form.adoptionStatus,
    priceCnyMinor: price.error ? form.priceYuan.trim() : price.minorUnits ?? null,
  })
}
