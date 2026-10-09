<script setup lang="ts">
import type { WorkBasicsForm, WorkFormErrors } from '~/utils/work-form'
import { PUBLIC_FEATURED_LIMIT } from '~/utils/work-form'
import { WORK_PURPOSE_VALUES } from '~~/shared/schemas/work'
import { WORK_PURPOSE_LABELS } from '~/utils/work-labels'

const props = withDefaults(defineProps<{
  disabled?: boolean
  errors: WorkFormErrors
  featuredEligible?: boolean
  showErrors?: boolean
}>(), {
  disabled: false,
  featuredEligible: false,
  showErrors: false,
})

const form = defineModel<WorkBasicsForm>({ required: true })

function errorFor(key: keyof WorkFormErrors) {
  return props.showErrors ? props.errors[key] : undefined
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
          :aria-describedby="errorFor('characterName') ? 'f-name-error' : undefined"
        >
        <p v-if="errorFor('characterName')" id="f-name-error" class="field__error">{{ errorFor('characterName') }}</p>
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
        <p v-if="errorFor('species')" id="f-species-error" class="field__error">{{ errorFor('species') }}</p>
      </div>

      <div class="field field--wide">
        <label class="field__label" for="f-slug">公开地址 <span aria-hidden="true">*</span></label>
        <div class="field__affix">
          <span class="field__prefix">/works/</span>
          <input
            id="f-slug"
            v-model="form.slug"
            class="field__input field__input--affixed"
            type="text"
            maxlength="120"
            required
            :disabled="disabled"
            :aria-invalid="errorFor('slug') ? 'true' : undefined"
            :aria-describedby="errorFor('slug') ? 'f-slug-error' : undefined"
          >
        </div>
        <p class="field__hint">小写字母、数字和连字符；发布后更改会影响原链接。</p>
        <p v-if="errorFor('slug')" id="f-slug-error" class="field__error">{{ errorFor('slug') }}</p>
      </div>

      <div class="field field--wide">
        <label class="field__label" for="f-purpose">内部用途 <span aria-hidden="true">*</span></label>
        <AdminSelect id="f-purpose" v-model="form.purpose" :disabled="disabled" :options="WORK_PURPOSE_VALUES.map(value => ({ value, label: WORK_PURPOSE_LABELS[value] }))" />
        <p class="field__hint">仅管理端可见；领养作品会额外启用领养状态、画师、价格和横版封面。</p>
      </div>

      <template v-if="form.purpose === 'adoption'">
        <div class="field">
          <label class="field__label" for="f-artist">画师</label>
          <input
            id="f-artist"
            v-model="form.artist"
            class="field__input"
            maxlength="100"
            :disabled="disabled"
            :aria-invalid="errorFor('artist') ? 'true' : undefined"
            :aria-describedby="errorFor('artist') ? 'f-artist-hint f-artist-error' : 'f-artist-hint'"
          >
          <p id="f-artist-hint" class="field__hint">绘制设定图的画师公开署名；填写后显示在领养列表和详情，留空不显示。</p>
          <p v-if="errorFor('artist')" id="f-artist-error" class="field__error">{{ errorFor('artist') }}</p>
        </div>
        <div class="field">
          <label class="field__label" for="f-adoption-status">领养状态 <span aria-hidden="true">*</span></label>
          <AdminSelect
            id="f-adoption-status"
            v-model="form.adoptionStatus"
            required
            :disabled="disabled"
            :aria-invalid="errorFor('adoptionStatus') ? 'true' : undefined"
            :aria-describedby="errorFor('adoptionStatus') ? 'f-adoption-status-error' : undefined"
            :options="[{ value: '', label: '请人工确认', disabled: true }, { value: 'available', label: '可领养' }, { value: 'adopted', label: '已领养' }]"
          />
          <p class="field__hint">不得根据历史状态自动猜测；不明确时保持未选择并交由负责人确认。</p>
          <p v-if="errorFor('adoptionStatus')" id="f-adoption-status-error" class="field__error">{{ errorFor('adoptionStatus') }}</p>
        </div>

        <div class="field">
          <label class="field__label" for="f-price">价格（人民币元）</label>
          <input
            id="f-price"
            v-model="form.priceYuan"
            class="field__input"
            inputmode="decimal"
            placeholder="留空表示不公开价格"
            :disabled="disabled"
            :aria-invalid="errorFor('price') ? 'true' : undefined"
            :aria-describedby="errorFor('price') ? 'f-price-hint f-price-error' : 'f-price-hint'"
          >
          <p id="f-price-hint" class="field__hint">填写后仅在作品详情公开，已领养后仍显示；留空不显示。</p>
          <p v-if="errorFor('price')" id="f-price-error" class="field__error">{{ errorFor('price') }}</p>
        </div>
      </template>

      <div class="field">
        <label class="checkbox">
          <input
            v-model="form.featured"
            class="checkbox__input"
            type="checkbox"
            :disabled="disabled || (!form.featured && !featuredEligible)"
          >
          <span>设为代表作品</span>
        </label>
        <p class="field__hint">
          最多 {{ PUBLIC_FEATURED_LIMIT }} 件；必须先上传至少一张竖版出厂照。
        </p>
      </div>

    </div>
  </section>
</template>

<style scoped>
.editor-card__grid { display: grid; gap: var(--admin-space-4); }
.field__label { display: block; margin-bottom: var(--admin-space-2); font-size: var(--admin-font-sm); font-weight: 600; }
.field__input { width: 100%; min-height: var(--admin-control-height); padding: 0 var(--admin-space-3); border: 1px solid var(--admin-border-primary); border-radius: var(--admin-radius-md); color: var(--admin-text-primary); background: var(--admin-bg-primary); font: inherit; }
.field__input:focus { border-color: var(--admin-border-focus); outline: none; box-shadow: 0 0 0 3px var(--admin-focus-ring); }
.field__input:disabled { color: var(--admin-text-tertiary); background: var(--admin-bg-subtle); }
.field__input[aria-invalid='true'] { border-color: var(--admin-status-error); }
.field__affix { display: flex; align-items: stretch; }
.field__prefix { display: inline-flex; align-items: center; padding: 0 var(--admin-space-2) 0 var(--admin-space-3); border: 1px solid var(--admin-border-primary); border-right: 0; border-radius: var(--admin-radius-md) 0 0 var(--admin-radius-md); color: var(--admin-text-tertiary); background: var(--admin-bg-subtle); font-family: var(--font-admin-mono); font-size: var(--admin-font-sm); }
.field__input--affixed { border-start-start-radius: 0; border-end-start-radius: 0; }
.field__hint { margin: var(--admin-space-1) 0 0; color: var(--admin-text-tertiary); font-size: var(--admin-font-xs); line-height: var(--admin-line-normal); }
.field__error { margin: var(--admin-space-1) 0 0; color: var(--admin-status-error); font-size: var(--admin-font-xs); font-weight: 600; }
.checkbox { display: flex; align-items: center; gap: var(--admin-space-2); min-height: var(--admin-control-height); font-size: var(--admin-font-sm); }
.checkbox__input { width: 1.1rem; height: 1.1rem; accent-color: var(--admin-accent-primary); }
@media (min-width: 768px) {
  .editor-card__grid { grid-template-columns: 1fr 1fr; }
  .field--wide { grid-column: 1 / -1; }
}
</style>
