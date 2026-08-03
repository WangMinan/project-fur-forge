import type {
  ManagedWorkDto,
  RegularAdoptionBusinessStatus,
  SuitType,
  WorkFields,
  WorkPurpose,
} from '../../shared/types/contracts'
import { REGULAR_ADOPTION_BUSINESS_STATUS_VALUES } from '../../shared/schemas/work'
import { parseCnyYuanInput, toCnyYuanInput } from './price'

/**
 * 管理端作品表单的单一形状。价格与排序保留为输入文本，
 * 由 `validateWorkForm` 判定合法性、由 `toWorkFieldsPayload` 转换为契约值；
 * 表单不持有服务端未开放的展会字段。
 */
export interface WorkBasicsForm {
  characterName: string
  featureTags: string[]
  featured: boolean
  ownerContact: string
  ownerDisplay: string
  priceYuan: string
  purpose: WorkPurpose
  regularBusinessStatus: RegularAdoptionBusinessStatus
  slug: string
  sortOrder: string | number
  species: string
  suitType: SuitType
}

export interface WorkFormErrors {
  characterName?: string
  featureTags: Record<number, string>
  ownerDisplay?: string
  price?: string
  slug?: string
  sortOrder?: string
  species?: string
}

/** 历史展会领养事实：只读展示，T22 不提供展会编辑器。 */
export interface HistoricalEventAdoption {
  adoptionMethod: 'event_drop' | 'regular' | null
  businessStatus: string | null
  currentEventName: string | null
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const MAX_FEATURE_TAGS = 8
export const MAX_FEATURE_TAG_LENGTH = 24
/** 公开首页精选轨道的服务端上限；超出后管理端提示，但不阻止保存。 */
export const PUBLIC_FEATURED_LIMIT = 6

export const OWNER_DISPLAY_PRESETS = ['有点小狗工作室', '不公开'] as const

function isRegularBusinessStatus(
  value: string | null | undefined,
): value is RegularAdoptionBusinessStatus {
  return REGULAR_ADOPTION_BUSINESS_STATUS_VALUES.includes(
    value as RegularAdoptionBusinessStatus,
  )
}

export function emptyWorkForm(): WorkBasicsForm {
  return {
    characterName: '',
    featureTags: [],
    featured: false,
    ownerContact: '',
    ownerDisplay: OWNER_DISPLAY_PRESETS[0],
    priceYuan: '',
    purpose: 'commission',
    regularBusinessStatus: 'preparing',
    slug: '',
    sortOrder: '0',
    species: '',
    suitType: 'full',
  }
}

export function workFormFromDto(dto: ManagedWorkDto): WorkBasicsForm {
  const adoption = dto.purpose === 'adoption' ? dto : null
  return {
    characterName: dto.characterName,
    featureTags: [...dto.featureTags],
    featured: dto.featured,
    ownerContact: dto.private.ownerContact ?? '',
    ownerDisplay: dto.ownerDisplay,
    priceYuan: adoption?.priceCnyMinor != null
      ? toCnyYuanInput(adoption.priceCnyMinor)
      : '',
    purpose: dto.purpose,
    regularBusinessStatus: isRegularBusinessStatus(adoption?.businessStatus)
      ? adoption.businessStatus
      : 'preparing',
    slug: dto.slug,
    sortOrder: String(dto.sortOrder),
    species: dto.species,
    suitType: dto.suitType,
  }
}

/**
 * 只有服务端已经写入的展会事实才算历史记录：
 * 方式或状态为空的旧领养作品可以直接按常规领养补齐，不需要转换确认。
 */
export function historicalEventAdoption(
  dto: ManagedWorkDto,
): HistoricalEventAdoption | null {
  if (dto.purpose !== 'adoption') {
    return null
  }
  const hasEventFact = dto.adoptionMethod === 'event_drop'
    || dto.businessStatus === 'event_sale'
    || (dto.currentEventName ?? '').trim() !== ''
  return hasEventFact
    ? {
        adoptionMethod: dto.adoptionMethod,
        businessStatus: dto.businessStatus,
        currentEventName: dto.currentEventName,
      }
    : null
}

export function parseSortOrderInput(raw: string | number) {
  const input = String(raw).trim()
  if (input === '') {
    return { error: '排序值不能为空，最小为 0', value: undefined }
  }
  if (!/^\d+$/.test(input)) {
    return { error: '排序值必须是 0 或正整数', value: undefined }
  }
  const value = Number(input)
  if (!Number.isSafeInteger(value)) {
    return { error: '排序值超出可安全表示的范围', value: undefined }
  }
  return { error: null, value }
}

export function validateWorkForm(form: WorkBasicsForm): WorkFormErrors {
  const errors: WorkFormErrors = { featureTags: {} }

  if (form.characterName.trim() === '') {
    errors.characterName = '角色名为必填项'
  }
  if (form.species.trim() === '') {
    errors.species = '物种为必填项'
  }
  if (form.ownerDisplay.trim() === '') {
    errors.ownerDisplay = '角色主人公开值为必填项，可选择预设或自行填写'
  }
  if (!SLUG_PATTERN.test(form.slug.trim())) {
    errors.slug = '只能使用小写字母、数字与连字符，且不能以连字符开头或结尾'
  }

  const sortOrder = parseSortOrderInput(form.sortOrder)
  if (sortOrder.error) {
    errors.sortOrder = sortOrder.error
  }

  if (form.purpose === 'adoption') {
    const price = parseCnyYuanInput(form.priceYuan)
    if (price.error) {
      errors.price = price.error
    }
  }

  const firstIndexOf = new Map<string, number>()
  form.featureTags.forEach((tag, index) => {
    const value = tag.trim()
    if (value === '') {
      errors.featureTags[index] = '属性不能为空，请填写内容或删除该条'
      return
    }
    if (Array.from(value).length > MAX_FEATURE_TAG_LENGTH) {
      errors.featureTags[index] = `属性最多 ${MAX_FEATURE_TAG_LENGTH} 个字符`
      return
    }
    const first = firstIndexOf.get(value)
    if (first !== undefined) {
      errors.featureTags[index] = `与第 ${first + 1} 条重复，请合并或删除`
      return
    }
    firstIndexOf.set(value, index)
  })

  return errors
}

export function hasWorkFormError(errors: WorkFormErrors) {
  return Object.keys(errors.featureTags).length > 0
    || Boolean(
      errors.characterName
      || errors.ownerDisplay
      || errors.price
      || errors.slug
      || errors.sortOrder
      || errors.species,
    )
}

/**
 * 按当前用途构造请求体：非领养作品完全不携带领养方式、业务状态与价格，
 * 不依赖服务端丢弃隐藏字段。调用前必须先通过 `validateWorkForm`。
 */
export function toWorkFieldsPayload(form: WorkBasicsForm): WorkFields {
  const ownerContact = form.ownerContact.trim()
  const base = {
    slug: form.slug.trim(),
    characterName: form.characterName.trim(),
    species: form.species.trim(),
    suitType: form.suitType,
    ownerDisplay: form.ownerDisplay.trim(),
    ownerContact: ownerContact === '' ? null : ownerContact,
    featureTags: form.featureTags.map(tag => tag.trim()),
    sortOrder: parseSortOrderInput(form.sortOrder).value ?? 0,
    featured: form.featured,
  }

  if (form.purpose === 'adoption') {
    return {
      ...base,
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: form.regularBusinessStatus,
      priceCnyMinor: parseCnyYuanInput(form.priceYuan).minorUnits ?? null,
    }
  }

  return { ...base, purpose: form.purpose }
}

/**
 * dirty 基线：只比较当前用途会提交的值。合法的价格与排序按契约值归一化，
 * 保证保存后用服务端返回重建基线不会立刻回到「有未保存更改」；
 * 非法输入保留原文，使错误输入仍可触发保存并看到校验结果。
 */
export function workFormSnapshot(form: WorkBasicsForm) {
  const sortOrder = parseSortOrderInput(form.sortOrder)
  const base = {
    characterName: form.characterName.trim(),
    featureTags: form.featureTags.map(tag => tag.trim()),
    featured: form.featured,
    ownerContact: form.ownerContact.trim(),
    ownerDisplay: form.ownerDisplay.trim(),
    purpose: form.purpose,
    slug: form.slug.trim(),
    sortOrder: sortOrder.value ?? String(form.sortOrder).trim(),
    species: form.species.trim(),
    suitType: form.suitType,
  }

  if (form.purpose !== 'adoption') {
    return JSON.stringify(base)
  }

  const price = parseCnyYuanInput(form.priceYuan)
  return JSON.stringify({
    ...base,
    businessStatus: form.regularBusinessStatus,
    priceCnyMinor: price.minorUnits ?? form.priceYuan.trim(),
  })
}
