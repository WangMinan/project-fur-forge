<script setup lang="ts">
import {
  REGULAR_ADOPTION_BUSINESS_STATUS_VALUES,
  SUIT_TYPE_VALUES,
} from '~~/shared/schemas/work'
import {
  BUSINESS_STATUS_LABELS,
  SUIT_TYPE_LABELS,
} from '~/utils/work-labels'
import type {
  WorkBasicsForm,
  WorkBusinessType,
  WorkFormErrors,
} from '~/utils/work-form'
import {
  MAX_FEATURE_TAG_LENGTH,
  MAX_FEATURE_TAGS,
  OWNER_DISPLAY_PRESETS,
  PUBLIC_FEATURED_LIMIT,
  purposeOfBusinessType,
  WORK_BUSINESS_TYPE_LABELS,
  WORK_BUSINESS_TYPE_VALUES,
} from '~/utils/work-form'

const props = withDefaults(defineProps<{
  disabled?: boolean
  errors: WorkFormErrors
  orderingDisabled?: boolean
  /** 旧 `event_sale` 业务状态：只提示改成正式领养状态，不再锁死字段。 */
  legacyEventSale?: boolean
  /** 已保存的业务类型，用于说明切换类型会清空哪些字段。 */
  savedBusinessType?: WorkBusinessType | null
  showErrors?: boolean
}>(), {
  disabled: false,
  legacyEventSale: false,
  orderingDisabled: false,
  savedBusinessType: null,
  showErrors: false,
})

// 与父页共享 reactive 表单对象：双向绑定直接落在父级状态上，
// dirty 基线比较在父级完成。
const form = defineModel<WorkBasicsForm>({ required: true })

/**
 * T37：四个易懂业务选项，只做映射，不新增底层 purpose。
 * 说明文字直接告诉景宸「会显示什么、会提交什么」。
 */
const BUSINESS_TYPE_NOTES: Record<WorkBusinessType, string> = {
  commission: '委托作品：不使用领养方式、状态、价格与展会字段，这些字段不会出现，也不会提交。',
  regular_adoption: '常规领养：显示领养状态、人民币价格与设定图；不使用展会字段。',
  event_drop: '展会掉落：在常规领养的基础上，额外填写展会名称与展会时间；发布前两项必填。',
  showcase: '纯展示：不使用领养方式、状态、价格与展会字段，这些字段不会出现，也不会提交。',
}

const isAdoption = computed(
  () => purposeOfBusinessType(form.value.businessType) === 'adoption',
)
const isEventDrop = computed(() => form.value.businessType === 'event_drop')

const leavingAdoption = computed(() => (
  props.savedBusinessType !== null
  && purposeOfBusinessType(props.savedBusinessType) === 'adoption'
  && !isAdoption.value
))

/** 从展会掉落切换到其他类型时，明确提示展会字段会被清理。 */
const leavingEventDrop = computed(
  () => props.savedBusinessType === 'event_drop' && !isEventDrop.value,
)

const tagCount = computed(() => form.value.featureTags.length)

function errorFor(key: keyof Omit<WorkFormErrors, 'featureTags'>) {
  return props.showErrors ? props.errors[key] : undefined
}

function tagErrorFor(index: number) {
  return props.showErrors ? props.errors.featureTags[index] : undefined
}

function describedBy(hintId: string, errorId: string, hasError: boolean) {
  return hasError ? `${hintId} ${errorId}` : hintId
}

function applyOwnerPreset(value: string) {
  form.value.ownerDisplay = value
}

function addTag() {
  if (form.value.featureTags.length < MAX_FEATURE_TAGS) {
    form.value.featureTags.push('')
  }
}

function removeTag(index: number) {
  form.value.featureTags.splice(index, 1)
}

function moveTag(index: number, offset: number) {
  const target = index + offset
  const tags = form.value.featureTags
  if (target < 0 || target >= tags.length) {
    return
  }
  const [moved] = tags.splice(index, 1)
  tags.splice(target, 0, moved as string)
}
</script>

<template>
  <section class="editor-card" aria-labelledby="basics-title">
    <h2 id="basics-title" class="editor-card__title">基础信息</h2>
    <div class="editor-card__grid">
      <div class="field">
        <label class="field__label" for="f-name">角色名 <span aria-hidden="true">*</span></label>
        <input
          id="f-name"
          v-model="form.characterName"
          class="field__input"
          type="text"
          maxlength="100"
          required
          :disabled="disabled"
          :aria-invalid="errorFor('characterName') ? 'true' : undefined"
          :aria-describedby="describedBy('f-name-hint', 'f-name-error', Boolean(errorFor('characterName')))"
        >
        <p id="f-name-hint" class="field__hint">公开端展示 · 最多 100 字</p>
        <p v-if="errorFor('characterName')" id="f-name-error" class="field__error">
          {{ errorFor('characterName') }}
        </p>
      </div>
      <div class="field">
        <label class="field__label" for="f-slug">链接别名 <span aria-hidden="true">*</span></label>
        <div class="field__affix">
          <span class="field__prefix" aria-hidden="true">/works/</span>
          <input
            id="f-slug"
            v-model="form.slug"
            class="field__input field__input--affixed"
            type="text"
            maxlength="120"
            required
            :disabled="disabled"
            :aria-invalid="errorFor('slug') ? 'true' : undefined"
            :aria-describedby="describedBy('f-slug-hint', 'f-slug-error', Boolean(errorFor('slug')))"
          >
        </div>
        <p id="f-slug-hint" class="field__hint">小写字母、数字与连字符 · 公开详情页地址</p>
        <p v-if="errorFor('slug')" id="f-slug-error" class="field__error">
          {{ errorFor('slug') }}
        </p>
      </div>
      <div class="field">
        <label class="field__label" for="f-species">物种 <span aria-hidden="true">*</span></label>
        <input
          id="f-species"
          v-model="form.species"
          class="field__input"
          type="text"
          maxlength="100"
          required
          :disabled="disabled"
          :aria-invalid="errorFor('species') ? 'true' : undefined"
          :aria-describedby="errorFor('species') ? 'f-species-error' : undefined"
        >
        <p v-if="errorFor('species')" id="f-species-error" class="field__error">
          {{ errorFor('species') }}
        </p>
      </div>
      <div class="field">
        <label class="field__label" for="f-suit">装型</label>
        <select id="f-suit" v-model="form.suitType" class="field__input" :disabled="disabled">
          <option v-for="value in SUIT_TYPE_VALUES" :key="value" :value="value">
            {{ SUIT_TYPE_LABELS[value] }}
          </option>
        </select>
      </div>
      <div class="field field--wide">
        <label class="field__label" for="f-business-type">业务类型</label>
        <select
          id="f-business-type"
          v-model="form.businessType"
          class="field__input field__input--compact"
          :disabled="disabled"
          aria-describedby="f-business-type-note"
        >
          <option
            v-for="value in WORK_BUSINESS_TYPE_VALUES"
            :key="value"
            :value="value"
          >{{ WORK_BUSINESS_TYPE_LABELS[value] }}</option>
        </select>
        <p
          id="f-business-type-note"
          class="field__hint"
          role="status"
          data-testid="purpose-note"
        >
          {{ BUSINESS_TYPE_NOTES[form.businessType] }}
        </p>
        <p v-if="leavingAdoption" class="field__warning" role="status">
          切换离开领养后，领养状态、价格与展会字段会在保存时被清空；若该作品已有领养设定图，服务端会拒绝本次切换。
        </p>
        <p v-else-if="leavingEventDrop" class="field__warning" role="status">
          切换离开展会掉落后，展会名称与展会时间会在保存时被清空。
        </p>
        <p v-if="legacyEventSale" class="field__warning" role="status">
          该作品仍是旧的“展会出售中”状态，保存前请在下方选择一个正式的领养状态。
        </p>
      </div>

      <!-- T37 展会掉落：只有展会名称与展会时间两项，不建设展会选择器。 -->
      <template v-if="isEventDrop">
        <div class="field field--wide">
          <label class="field__label" for="f-event-name">展会名称</label>
          <input
            id="f-event-name"
            v-model="form.eventName"
            class="field__input field__input--compact"
            type="text"
            maxlength="80"
            :disabled="disabled"
            :aria-invalid="errorFor('eventName') ? 'true' : undefined"
            :aria-describedby="describedBy('f-event-name-hint', 'f-event-name-error', Boolean(errorFor('eventName')))"
          >
          <p id="f-event-name-hint" class="field__hint">
            公开端展示 · 例如“幻夏祭 2026”。发布前必填。
          </p>
          <p v-if="errorFor('eventName')" id="f-event-name-error" class="field__error">
            {{ errorFor('eventName') }}
          </p>
        </div>
        <div class="field field--wide">
          <label class="field__label" for="f-event-time">展会时间</label>
          <input
            id="f-event-time"
            v-model="form.eventTime"
            class="field__input field__input--compact"
            type="text"
            maxlength="80"
            :disabled="disabled"
            :aria-invalid="errorFor('eventTime') ? 'true' : undefined"
            :aria-describedby="describedBy('f-event-time-hint', 'f-event-time-error', Boolean(errorFor('eventTime')))"
          >
          <p id="f-event-time-hint" class="field__hint">
            公开端展示 · 可写单日、日期范围或已确认时段，例如“8 月 15 日 至 16 日”。
            这是给访客看的文字，<strong>不会自动改变领养状态</strong>，也不会触发定时上架。发布前必填。
          </p>
          <p v-if="errorFor('eventTime')" id="f-event-time-error" class="field__error">
            {{ errorFor('eventTime') }}
          </p>
        </div>
      </template>
      <div class="field field--wide">
        <label class="field__label" for="f-owner">角色主人公开值 <span aria-hidden="true">*</span></label>
        <input
          id="f-owner"
          v-model="form.ownerDisplay"
          class="field__input"
          type="text"
          maxlength="100"
          required
          :disabled="disabled"
          :aria-invalid="errorFor('ownerDisplay') ? 'true' : undefined"
          :aria-describedby="describedBy('f-owner-hint', 'f-owner-error', Boolean(errorFor('ownerDisplay')))"
        >
        <div class="presets">
          <button
            v-for="preset in OWNER_DISPLAY_PRESETS"
            :key="preset"
            type="button"
            class="presets__button"
            :disabled="disabled"
            :aria-pressed="form.ownerDisplay === preset"
            @click="applyOwnerPreset(preset)"
          >{{ preset }}</button>
        </div>
        <p id="f-owner-hint" class="field__hint">公开端展示 · 可直接填写角色主人昵称，或使用上方快捷值</p>
        <p v-if="errorFor('ownerDisplay')" id="f-owner-error" class="field__error">
          {{ errorFor('ownerDisplay') }}
        </p>
      </div>
      <div class="field field--wide">
        <label class="field__label" for="f-contact">
          联系人 <span class="field__private">仅后台可见</span>
        </label>
        <textarea
          id="f-contact"
          v-model="form.ownerContact"
          class="field__input field__textarea"
          rows="2"
          maxlength="500"
          :disabled="disabled"
          aria-describedby="f-contact-hint"
        />
        <p id="f-contact-hint" class="field__hint">私有字段，任何公开接口与页面都不会输出 · 最多 500 字</p>
      </div>
    </div>
  </section>

  <!--
    T37：展会掉落已经是可编辑、可发布的正式业务类型，
    因此不再需要“历史展会记录（只读）”与“转为常规领养”的转换入口。
    展会名称/时间直接在上方业务类型区编辑。
  -->
  <section
    v-if="isAdoption"
    class="editor-card"
    aria-labelledby="adoption-title"
    data-testid="adoption-fields"
  >
    <h2 id="adoption-title" class="editor-card__title">领养信息</h2>
    <div class="editor-card__grid">
      <div class="field">
        <label class="field__label" for="f-adoption-method">领养方式</label>
        <input
          id="f-adoption-method"
          class="field__input"
          type="text"
          :value="isEventDrop ? '展会掉落' : '常规领养'"
          readonly
          aria-describedby="f-adoption-method-hint"
        >
        <p id="f-adoption-method-hint" class="field__hint">
          由上方“业务类型”决定；两种领养方式共用状态、价格、设定图与作品水印。
        </p>
      </div>
      <div class="field">
        <label class="field__label" for="f-business-status">业务状态</label>
        <select
          id="f-business-status"
          v-model="form.regularBusinessStatus"
          class="field__input"
          :disabled="disabled"
        >
          <option
            v-for="value in REGULAR_ADOPTION_BUSINESS_STATUS_VALUES"
            :key="value"
            :value="value"
          >{{ BUSINESS_STATUS_LABELS[value] }}</option>
        </select>
      </div>
      <div class="field field--wide">
        <label class="field__label" for="f-price">领养价格（人民币元）</label>
        <div class="field__affix">
          <span class="field__prefix" aria-hidden="true">¥</span>
          <input
            id="f-price"
            v-model="form.priceYuan"
            class="field__input field__input--affixed field__input--compact"
            type="text"
            inputmode="decimal"
            :disabled="disabled"
            :aria-invalid="errorFor('price') ? 'true' : undefined"
            :aria-describedby="describedBy('f-price-hint', 'f-price-error', Boolean(errorFor('price')))"
          >
        </div>
        <p id="f-price-hint" class="field__hint">
          留空表示不公开价格（公开端不显示价格区域，也不显示「请咨询」）· 最多两位小数 · 提交时换算为分
        </p>
        <p v-if="errorFor('price')" id="f-price-error" class="field__error">
          {{ errorFor('price') }}
        </p>
      </div>
    </div>
  </section>

  <section class="editor-card" aria-labelledby="ordering-title">
    <h2 id="ordering-title" class="editor-card__title">排序与精选</h2>
    <div class="editor-card__grid">
      <div class="field">
        <label class="field__label" for="f-sort-order">人工排序</label>
        <input
          id="f-sort-order"
          v-model="form.sortOrder"
          class="field__input field__input--compact"
          type="number"
          min="0"
          step="1"
          :disabled="orderingDisabled"
          :aria-invalid="errorFor('sortOrder') ? 'true' : undefined"
          :aria-describedby="describedBy('f-sort-order-hint', 'f-sort-order-error', Boolean(errorFor('sortOrder')))"
        >
        <p id="f-sort-order-hint" class="field__hint">
          数值越小越靠前；精选顺位重复时，保存后自动使用下一个空闲顺位
        </p>
        <p v-if="errorFor('sortOrder')" id="f-sort-order-error" class="field__error">
          {{ errorFor('sortOrder') }}
        </p>
      </div>
      <div class="field">
        <span class="field__label">首页精选</span>
        <label class="checkbox">
          <input
            v-model="form.featured"
            type="checkbox"
            class="checkbox__input"
            :disabled="orderingDisabled"
            aria-describedby="f-featured-hint"
          >
          <span>加入首页精选作品</span>
        </label>
        <p id="f-featured-hint" class="field__hint">
          首页精选最多展示前 {{ PUBLIC_FEATURED_LIMIT }} 件已发布作品；与首页轮播是两套内容
        </p>
      </div>
    </div>
  </section>

  <section class="editor-card" aria-labelledby="tags-title">
    <div class="editor-card__head">
      <h2 id="tags-title" class="editor-card__title">作品属性</h2>
      <p class="editor-card__hint">
        短标签 {{ tagCount }}/{{ MAX_FEATURE_TAGS }} · 每条最多 {{ MAX_FEATURE_TAG_LENGTH }} 字 · 顺序即公开顺序
      </p>
    </div>
    <ul class="tags" role="list">
      <li v-for="(tag, index) in form.featureTags" :key="index" class="tags__item">
        <div class="tags__control">
          <input
            v-model="form.featureTags[index]"
            class="field__input tags__input"
            type="text"
            :disabled="disabled"
            :aria-label="`作品属性第 ${index + 1} 条`"
            :aria-invalid="tagErrorFor(index) ? 'true' : undefined"
            :aria-describedby="tagErrorFor(index) ? `f-tag-error-${index}` : undefined"
          >
          <div class="tags__buttons">
            <button
              type="button"
              class="tags__button"
              :disabled="disabled || index === 0"
              :aria-label="`第 ${index + 1} 条属性上移`"
              @click="moveTag(index, -1)"
            >上移</button>
            <button
              type="button"
              class="tags__button"
              :disabled="disabled || index === form.featureTags.length - 1"
              :aria-label="`第 ${index + 1} 条属性下移`"
              @click="moveTag(index, 1)"
            >下移</button>
            <button
              type="button"
              class="tags__button tags__button--danger"
              :disabled="disabled"
              :aria-label="`删除第 ${index + 1} 条属性`"
              @click="removeTag(index)"
            >删除</button>
          </div>
        </div>
        <p v-if="tagErrorFor(index)" :id="`f-tag-error-${index}`" class="field__error">
          {{ tagErrorFor(index) }}
        </p>
      </li>
    </ul>
    <p v-if="tagCount === 0" class="tags__empty">尚未填写属性；作品属性可以为 0 条。</p>
    <button
      type="button"
      class="tags__add"
      :disabled="disabled || tagCount >= MAX_FEATURE_TAGS"
      @click="addTag"
    >添加属性</button>
  </section>
</template>

<style scoped>
.field__label {
  display: block;
  font-size: var(--admin-font-sm);
  font-weight: 600;
  margin-bottom: var(--admin-space-2);
}

.field__private {
  display: inline-block;
  margin-left: var(--admin-space-2);
  font-size: var(--admin-font-xs);
  font-weight: 600;
  color: var(--admin-status-warning);
  background: var(--admin-status-warning-soft);
  border-radius: 999px;
  padding: 0.05rem 0.5rem;
}

.field__input {
  width: 100%;
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  font: inherit;
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
}

.field__input--compact {
  max-width: 14rem;
}

.field__input:focus {
  border-color: var(--admin-border-focus);
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}

.field__input:disabled,
.field__input[readonly] {
  background: var(--admin-bg-subtle);
  color: var(--admin-text-tertiary);
}

.field__input[aria-invalid='true'] {
  border-color: var(--admin-status-error);
}

.field__textarea {
  min-height: auto;
  padding: var(--admin-space-2) var(--admin-space-3);
  resize: vertical;
}

.field__affix {
  display: flex;
  align-items: stretch;
}

.field__prefix {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--admin-space-2) 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-right: none;
  border-radius: var(--admin-radius-md) 0 0 var(--admin-radius-md);
  background: var(--admin-bg-subtle);
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-sm);
  font-family: var(--font-admin-mono);
}

.field__input--affixed {
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}

.field__hint {
  margin: var(--admin-space-1) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
  line-height: var(--admin-line-normal);
}

.field__error {
  margin: var(--admin-space-1) 0 0;
  font-size: var(--admin-font-xs);
  font-weight: 600;
  color: var(--admin-status-error);
}

.field__warning {
  margin: var(--admin-space-2) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-warning);
  line-height: var(--admin-line-normal);
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--admin-space-2);
  margin-top: var(--admin-space-2);
}

.presets__button {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: 999px;
  background: var(--admin-bg-primary);
  color: var(--admin-text-secondary);
  font: inherit;
  font-size: var(--admin-font-xs);
  cursor: pointer;
}

.presets__button[aria-pressed='true'] {
  border-color: var(--admin-accent-primary);
  color: var(--admin-accent-primary);
  font-weight: 600;
}

.presets__button:disabled {
  opacity: 0.55;
  cursor: default;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  min-height: var(--admin-control-height);
  font-size: var(--admin-font-sm);
}

.checkbox__input {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--admin-accent-primary);
}

.editor-card__grid {
  display: grid;
  gap: var(--admin-space-4);
}






.tags {
  list-style: none;
  margin: 0 0 var(--admin-space-3);
  padding: 0;
  display: grid;
  gap: var(--admin-space-3);
}

.tags__control {
  display: flex;
  gap: var(--admin-space-2);
  align-items: center;
  flex-wrap: wrap;
}

.tags__input {
  flex: 1 1 12rem;
  min-width: 0;
  max-width: 20rem;
}

.tags__buttons {
  display: flex;
  gap: var(--admin-space-2);
}

.tags__button {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
  font-family: inherit;
  cursor: pointer;
}

.tags__button:hover:not(:disabled) {
  border-color: var(--admin-text-primary);
  color: var(--admin-text-primary);
}

.tags__button--danger:hover:not(:disabled) {
  color: var(--admin-danger);
  border-color: var(--admin-danger);
}

.tags__empty {
  margin: 0 0 var(--admin-space-3);
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.tags__add {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.tags__add:hover:not(:disabled) {
  background: var(--admin-bg-subtle);
}

.tags__add:disabled,
.tags__button:disabled {
  opacity: 0.55;
  cursor: default;
}

@media (min-width: 768px) {
  .editor-card__grid {
    grid-template-columns: 1fr 1fr;
  }

  .field--wide {
    grid-column: 1 / -1;
  }
}
</style>
