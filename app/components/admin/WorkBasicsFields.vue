<script setup lang="ts">
import type { SuitType } from '~~/shared/types/contracts'
import { SUIT_TYPE_VALUES } from '~~/shared/schemas/work'
import { SUIT_TYPE_LABELS, WORK_PURPOSE_LABELS } from '~/utils/work-labels'

export interface WorkBasicsForm {
  characterName: string
  featureTags: string[]
  ownerContact: string
  ownerDisplay: '不公开' | '有点小狗工作室'
  purpose: 'commission' | 'showcase'
  slug: string
  species: string
  suitType: SuitType
}

defineProps<{
  disabled?: boolean
}>()

// 与父页共享 reactive 表单对象：双向绑定直接落在父级状态上，
// dirty 基线比较在父级完成。
const form = defineModel<WorkBasicsForm>({ required: true })

const NON_ADOPTION_PURPOSES = ['commission', 'showcase'] as const
const OWNER_DISPLAY_OPTIONS = ['有点小狗工作室', '不公开'] as const

const duplicateTag = computed(() => {
  const seen = new Set<string>()
  for (const tag of form.value.featureTags) {
    const normalized = tag.trim()
    if (normalized && seen.has(normalized)) {
      return normalized
    }
    seen.add(normalized)
  }
  return null
})

function addTag() {
  if (form.value.featureTags.length < 8) {
    form.value.featureTags.push('')
  }
}

function removeTag(index: number) {
  form.value.featureTags.splice(index, 1)
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
        >
        <p class="field__hint">公开端展示 · 最多 100 字</p>
      </div>
      <div class="field">
        <label class="field__label" for="f-slug">链接别名（slug） <span aria-hidden="true">*</span></label>
        <div class="field__affix">
          <span class="field__prefix" aria-hidden="true">/works/</span>
          <input
            id="f-slug"
            v-model="form.slug"
            class="field__input field__input--affixed"
            type="text"
            maxlength="120"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
            :disabled="disabled"
          >
        </div>
        <p class="field__hint">小写字母、数字与连字符 · 公开详情页地址</p>
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
        >
      </div>
      <div class="field">
        <label class="field__label" for="f-owner">角色主人公开值 <span aria-hidden="true">*</span></label>
        <select id="f-owner" v-model="form.ownerDisplay" class="field__input" :disabled="disabled">
          <option v-for="value in OWNER_DISPLAY_OPTIONS" :key="value" :value="value">
            {{ value }}
          </option>
        </select>
        <p class="field__hint">工作室作品选“有点小狗工作室”，隐私作品选“不公开”</p>
      </div>
      <div class="field">
        <label class="field__label" for="f-suit">装型</label>
        <select id="f-suit" v-model="form.suitType" class="field__input" :disabled="disabled">
          <option v-for="value in SUIT_TYPE_VALUES" :key="value" :value="value">
            {{ SUIT_TYPE_LABELS[value] }}
          </option>
        </select>
      </div>
      <div class="field">
        <label class="field__label" for="f-purpose">用途</label>
        <select id="f-purpose" v-model="form.purpose" class="field__input" :disabled="disabled">
          <option v-for="value in NON_ADOPTION_PURPOSES" :key="value" :value="value">
            {{ WORK_PURPOSE_LABELS[value] }}
          </option>
        </select>
        <p class="field__hint">领养作品流程尚未开放（T25）</p>
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
        />
        <p class="field__hint">私有字段，任何公开接口与页面都不会输出 · 最多 500 字</p>
      </div>
    </div>

    <div class="tags-block">
      <div class="editor-card__head">
        <h3 class="tags-block__title">作品属性</h3>
        <p class="editor-card__hint">短标签 {{ form.featureTags.length }}/8 · 每条最多 24 字</p>
      </div>
      <ul class="tags" role="list">
        <li v-for="(tag, index) in form.featureTags" :key="index" class="tags__item">
          <input
            v-model="form.featureTags[index]"
            class="field__input tags__input"
            type="text"
            maxlength="24"
            :disabled="disabled"
            :aria-label="`作品属性第 ${index + 1} 条`"
          >
          <button
            type="button"
            class="tags__remove"
            :disabled="disabled"
            :aria-label="`删除第 ${index + 1} 条属性`"
            @click="removeTag(index)"
          >删除</button>
        </li>
      </ul>
      <p v-if="duplicateTag" class="tags__warning" role="status">
        “{{ duplicateTag }}”重复出现，请合并或删除其一。
      </p>
      <button
        type="button"
        class="tags__add"
        :disabled="disabled || form.featureTags.length >= 8"
        @click="addTag"
      >添加属性</button>
    </div>
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

.field__input:focus {
  border-color: var(--admin-border-focus);
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}

.field__input:disabled {
  background: var(--admin-bg-subtle);
  color: var(--admin-text-tertiary);
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
}

.editor-card__grid {
  display: grid;
  gap: var(--admin-space-4);
}

.tags-block {
  margin-top: var(--admin-space-5);
}

.tags-block__title {
  margin: 0;
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.tags {
  list-style: none;
  margin: 0 0 var(--admin-space-3);
  padding: 0;
  display: grid;
  gap: var(--admin-space-2);
}

.tags__item {
  display: flex;
  gap: var(--admin-space-2);
  align-items: center;
}

.tags__input {
  max-width: 20rem;
}

.tags__remove {
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

.tags__remove:hover:not(:disabled) {
  color: var(--admin-danger);
  border-color: var(--admin-danger);
}

.tags__warning {
  margin: 0 0 var(--admin-space-3);
  font-size: var(--admin-font-sm);
  color: var(--admin-status-warning);
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
.tags__remove:disabled {
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
