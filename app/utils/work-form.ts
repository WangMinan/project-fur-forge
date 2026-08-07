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
  /** T37：管理端四选项业务类型，只做映射，不新增底层 purpose。 */
  businessType: WorkBusinessType
  eventName: string
  eventTime: string
  ownerContact: string
  ownerDisplay: string
  priceYuan: string
  regularBusinessStatus: RegularAdoptionBusinessStatus
  slug: string
  sortOrder: string | number
  species: string
  suitType: SuitType
}

/**
 * 管理端业务类型：给景宸看的四个易懂选项。
 *
 * ```text
 * commission      -> purpose=commission
 * regular_adoption-> purpose=adoption, adoption_method=regular
 * event_drop      -> purpose=adoption, adoption_method=event_drop
 * showcase        -> purpose=showcase
 * ```
 */
export const WORK_BUSINESS_TYPE_VALUES = [
  'commission',
  'regular_adoption',
  'event_drop',
  'showcase',
] as const

export type WorkBusinessType = typeof WORK_BUSINESS_TYPE_VALUES[number]

export const WORK_BUSINESS_TYPE_LABELS: Record<WorkBusinessType, string> = {
  commission: '委托作品',
  regular_adoption: '常规领养',
  event_drop: '展会掉落',
  showcase: '纯展示',
}

/** 四选项 → 底层 purpose。 */
export function purposeOfBusinessType(value: WorkBusinessType): WorkPurpose {
  if (value === 'commission') {
    return 'commission'
  }
  return value === 'showcase' ? 'showcase' : 'adoption'
}

/** 底层字段 → 四选项。 */
export function businessTypeOf(
  purpose: WorkPurpose,
  adoptionMethod: 'event_drop' | 'regular' | null | undefined,
): WorkBusinessType {
  if (purpose === 'commission') {
    return 'commission'
  }
  if (purpose === 'showcase') {
    return 'showcase'
  }
  return adoptionMethod === 'event_drop' ? 'event_drop' : 'regular_adoption'
}

export interface WorkFormErrors {
  characterName?: string
  eventName?: string
  eventTime?: string
  featureTags: Record<number, string>
  ownerDisplay?: string
  price?: string
  slug?: string
  sortOrder?: string
  species?: string
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
    businessType: 'commission',
    characterName: '',
    eventName: '',
    eventTime: '',
    featureTags: [],
    featured: false,
    ownerContact: '',
    ownerDisplay: OWNER_DISPLAY_PRESETS[0],
    priceYuan: '',
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
    businessType: businessTypeOf(dto.purpose, adoption?.adoptionMethod),
    characterName: dto.characterName,
    eventName: adoption?.eventName ?? '',
    eventTime: adoption?.eventTime ?? '',
    featureTags: [...dto.featureTags],
    featured: dto.featured,
    ownerContact: dto.private.ownerContact ?? '',
    ownerDisplay: dto.ownerDisplay,
    priceYuan: adoption?.priceCnyMinor != null
      ? toCnyYuanInput(adoption.priceCnyMinor)
      : '',
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
 * 历史 `event_sale` 业务状态。
 *
 * T37 起展会掉落已经是可编辑、可发布的正式业务类型，因此不再需要
 * “历史展会事实只读展示”。只有旧的 `event_sale` 状态仍不可写，
 * 需要在编辑时提示改成正式的领养状态。
 */
export function hasLegacyEventSaleStatus(dto: ManagedWorkDto) {
  return dto.purpose === 'adoption' && dto.businessStatus === 'event_sale'
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

  if (purposeOfBusinessType(form.businessType) === 'adoption') {
    const price = parseCnyYuanInput(form.priceYuan)
    if (price.error) {
      errors.price = price.error
    }
  }

  // 展会字段允许在草稿阶段留空（发布检查会拦），但填了就必须合法。
  if (form.businessType === 'event_drop') {
    if (Array.from(form.eventName.trim()).length > 80) {
      errors.eventName = '展会名称最多 80 个字符'
    }
    if (Array.from(form.eventTime.trim()).length > 80) {
      errors.eventTime = '展会时间最多 80 个字符'
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
      || errors.eventName
      || errors.eventTime
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

  const purpose = purposeOfBusinessType(form.businessType)
  if (purpose === 'adoption') {
    const isEventDrop = form.businessType === 'event_drop'
    const eventName = form.eventName.trim()
    const eventTime = form.eventTime.trim()
    return {
      ...base,
      purpose: 'adoption',
      adoptionMethod: isEventDrop ? 'event_drop' : 'regular',
      businessStatus: form.regularBusinessStatus,
      priceCnyMinor: parseCnyYuanInput(form.priceYuan).minorUnits ?? null,
      // 只有展会掉落才提交展会字段：切换到常规领养时提交 null，
      // 因此服务端和数据库都不会留下僵尸值。
      eventName: isEventDrop && eventName !== '' ? eventName : null,
      eventTime: isEventDrop && eventTime !== '' ? eventTime : null,
    }
  }

  return { ...base, purpose }
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
    businessType: form.businessType,
    slug: form.slug.trim(),
    sortOrder: sortOrder.value ?? String(form.sortOrder).trim(),
    species: form.species.trim(),
    suitType: form.suitType,
  }

  if (purposeOfBusinessType(form.businessType) !== 'adoption') {
    return JSON.stringify(base)
  }

  const price = parseCnyYuanInput(form.priceYuan)
  return JSON.stringify({
    ...base,
    businessStatus: form.regularBusinessStatus,
    priceCnyMinor: price.minorUnits ?? form.priceYuan.trim(),
    // 只有展会掉落才把展会字段计入基线，避免切换类型后误判未保存更改。
    ...(form.businessType === 'event_drop'
      ? {
          eventName: form.eventName.trim(),
          eventTime: form.eventTime.trim(),
        }
      : {}),
  })
}
