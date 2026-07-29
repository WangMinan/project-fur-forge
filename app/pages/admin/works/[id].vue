<script setup lang="ts">
import type { AdoptionMethod, BusinessStatus, SuitType, WorkPurpose } from '~~/shared/types/contracts'
import { findAdminWorkById } from '~~/shared/fixtures/visual-admin'
import { buildPublicationChecklist } from '~/utils/publication-checklist'
import {
  ADOPTION_METHOD_LABELS,
  BUSINESS_STATUS_LABELS,
  SUIT_TYPE_LABELS,
  WORK_PURPOSE_LABELS,
} from '~/utils/work-labels'
import { SUIT_TYPE_VALUES, WORK_PURPOSE_VALUES } from '~~/shared/schemas/work'

definePageMeta({
  ssr: false,
})

useSeoMeta({
  title: '编辑作品',
  robots: 'noindex, nofollow',
})

const route = useRoute()
const work = findAdminWorkById(String(route.params.id))

useSeoMeta({
  title: work ? `编辑 ${work.dto.characterName}` : '作品不存在',
})

const initialTags = work ? [...work.dto.featureTags] : []

const form = reactive({
  characterName: work?.dto.characterName ?? '',
  slug: work?.dto.slug ?? '',
  species: work?.dto.species ?? '',
  ownerDisplay: work?.dto.ownerDisplay ?? '',
  suitType: (work?.dto.suitType ?? 'full') as SuitType,
  purpose: (work?.dto.purpose ?? 'showcase') as WorkPurpose,
  ownerContact: work?.dto.private.ownerContact ?? '',
  adoptionMethod: (work?.dto.purpose === 'adoption' ? work.dto.adoptionMethod : '') as AdoptionMethod | '',
  businessStatus: (work?.dto.purpose === 'adoption' ? work?.dto.businessStatus : '') as BusinessStatus | '',
  priceYuan: work?.dto.purpose === 'adoption' && work?.dto.priceCnyMinor != null
    ? String(work.dto.priceCnyMinor / 100)
    : '',
})

const tags = ref<string[]>(initialTags)
const notice = ref<string | null>(null)

function announce(message: string) {
  notice.value = message
}

const parsedPriceMinor = computed(() => {
  const yuan = Number.parseFloat(form.priceYuan)
  if (!Number.isFinite(yuan) || yuan < 0) {
    return undefined
  }
  return Math.round(yuan * 100)
})

// 发布检查求值基于当前表单（而非夹具快照），让检查项随编辑即时变化；仍然不会持久化。
const checklist = computed(() => {
  if (!work) {
    return null
  }
  return buildPublicationChecklist({
    ...work,
    dto: {
      ...work.dto,
      purpose: form.purpose,
      adoptionMethod: form.purpose === 'adoption' && form.adoptionMethod ? form.adoptionMethod : undefined,
      businessStatus: form.purpose === 'adoption' && form.businessStatus ? form.businessStatus : undefined,
      priceCnyMinor: form.purpose === 'adoption' ? parsedPriceMinor.value : undefined,
    } as typeof work.dto,
  })
})

const isDirty = computed(() => {
  if (!work) {
    return false
  }
  return form.characterName !== work.dto.characterName
    || form.slug !== work.dto.slug
    || form.species !== work.dto.species
    || form.ownerDisplay !== (work.dto.ownerDisplay ?? '')
    || form.suitType !== work.dto.suitType
    || form.purpose !== work.dto.purpose
    || form.ownerContact !== (work.dto.private.ownerContact ?? '')
    || tags.value.join('') !== initialTags.join('')
})

const duplicateTag = computed(() => {
  const seen = new Set<string>()
  for (const tag of tags.value) {
    const normalized = tag.trim()
    if (normalized && seen.has(normalized)) {
      return normalized
    }
    seen.add(normalized)
  }
  return null
})

function addTag() {
  if (tags.value.length < 8) {
    tags.value.push('')
  }
}

function removeTag(index: number) {
  tags.value.splice(index, 1)
}
</script>

<template>
  <AdminShell current="works">
    <div v-if="!work" class="editor-missing">
      <p class="editor-missing__title">未找到该作品</p>
      <p class="editor-missing__text">当前为夹具演示数据，仅包含 6 件示例作品。</p>
      <NuxtLink to="/admin/works" class="editor-missing__back">返回作品列表</NuxtLink>
    </div>

    <div v-else class="editor">
      <header class="editor__header">
        <div class="editor__heading">
          <NuxtLink to="/admin/works" class="editor__back">← 作品</NuxtLink>
          <h1 class="editor__title">{{ work.dto.characterName }}</h1>
          <AdminStatusBadge
            :tone="isDirty ? 'warning' : 'neutral'"
            :label="isDirty ? '有未保存更改' : '未更改'"
          />
        </div>
        <div class="editor__actions">
          <button
            type="button"
            class="editor__button editor__button--secondary"
            @click="announce('保存接口尚未接入（T17）：修改不会持久化，刷新后还原为夹具数据。')"
          >保存草稿</button>
          <button
            type="button"
            class="editor__button editor__button--primary"
            :disabled="!checklist?.publishable"
            :title="checklist?.publishable ? undefined : '请先完成发布检查中的所有待办项'"
            @click="announce('发布接口尚未接入（T18）：不会生成公开图片，也不会改变发布状态。')"
          >发布</button>
        </div>
      </header>

      <p v-if="notice" class="editor__notice" role="status">{{ notice }}</p>

      <div class="editor__layout">
        <div class="editor__main">
          <section class="editor-card" aria-labelledby="basics-title">
            <h2 id="basics-title" class="editor-card__title">基础信息</h2>
            <div class="editor-card__grid">
              <div class="field">
                <label class="field__label" for="f-name">角色名 <span aria-hidden="true">*</span></label>
                <input id="f-name" v-model="form.characterName" class="field__input" type="text" maxlength="32" required>
                <p class="field__hint">公开端展示 · 最多 32 字</p>
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
                    maxlength="64"
                    pattern="[a-z0-9-]+"
                    required
                  >
                </div>
                <p class="field__hint">小写字母、数字与连字符 · 公开详情页地址</p>
              </div>
              <div class="field">
                <label class="field__label" for="f-species">物种 <span aria-hidden="true">*</span></label>
                <input id="f-species" v-model="form.species" class="field__input" type="text" maxlength="24" required>
              </div>
              <div class="field">
                <label class="field__label" for="f-owner">角色主人公开值</label>
                <input id="f-owner" v-model="form.ownerDisplay" class="field__input" type="text" maxlength="24">
                <p class="field__hint">留空表示工作室作品 · 最多 24 字</p>
              </div>
              <div class="field">
                <label class="field__label" for="f-suit">装型</label>
                <select id="f-suit" v-model="form.suitType" class="field__input">
                  <option v-for="value in SUIT_TYPE_VALUES" :key="value" :value="value">
                    {{ SUIT_TYPE_LABELS[value] }}
                  </option>
                </select>
              </div>
              <div class="field">
                <label class="field__label" for="f-purpose">用途</label>
                <select id="f-purpose" v-model="form.purpose" class="field__input">
                  <option v-for="value in WORK_PURPOSE_VALUES" :key="value" :value="value">
                    {{ WORK_PURPOSE_LABELS[value] }}
                  </option>
                </select>
                <p class="field__hint">切换为“领养”后将出现领养信息与价格字段</p>
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
                  maxlength="200"
                />
                <p class="field__hint">T03 契约私有字段，任何公开接口与页面都不会输出 · 最多 200 字</p>
              </div>
            </div>
          </section>

          <section class="editor-card" aria-labelledby="tags-title">
            <div class="editor-card__head">
              <h2 id="tags-title" class="editor-card__title">作品属性</h2>
              <p class="editor-card__hint">短标签 {{ tags.length }}/8 · 每条最多 24 字</p>
            </div>
            <ul class="tags" role="list">
              <li v-for="(tag, index) in tags" :key="index" class="tags__item">
                <input
                  v-model="tags[index]"
                  class="field__input tags__input"
                  type="text"
                  maxlength="24"
                  :aria-label="`作品属性第 ${index + 1} 条`"
                >
                <button type="button" class="tags__remove" :aria-label="`删除第 ${index + 1} 条属性`" @click="removeTag(index)">
                  删除
                </button>
              </li>
            </ul>
            <p v-if="duplicateTag" class="tags__warning" role="status">
              “{{ duplicateTag }}”重复出现，请合并或删除其一。
            </p>
            <button
              type="button"
              class="editor__button editor__button--secondary"
              :disabled="tags.length >= 8"
              @click="addTag"
            >添加属性</button>
          </section>

          <section v-if="form.purpose === 'adoption'" class="editor-card" aria-labelledby="adoption-title">
            <h2 id="adoption-title" class="editor-card__title">领养信息</h2>
            <div class="editor-card__grid">
              <div class="field">
                <label class="field__label" for="f-method">领养方式 <span aria-hidden="true">*</span></label>
                <select id="f-method" v-model="form.adoptionMethod" class="field__input">
                  <option value="" disabled>请选择</option>
                  <option v-for="(label, value) in ADOPTION_METHOD_LABELS" :key="value" :value="value">
                    {{ label }}
                  </option>
                </select>
              </div>
              <div class="field">
                <label class="field__label" for="f-status">业务状态 <span aria-hidden="true">*</span></label>
                <select id="f-status" v-model="form.businessStatus" class="field__input">
                  <option value="" disabled>请选择</option>
                  <option v-for="(label, value) in BUSINESS_STATUS_LABELS" :key="value" :value="value">
                    {{ label }}
                  </option>
                </select>
              </div>
              <div class="field">
                <label class="field__label" for="f-price">公开人民币价格（元）</label>
                <input
                  id="f-price"
                  v-model="form.priceYuan"
                  class="field__input"
                  type="text"
                  inputmode="decimal"
                  placeholder="例如 15600"
                >
                <p class="field__hint">可留空；留空时公开端整区隐藏价格。网站不接受登记、定金或付款。</p>
              </div>
            </div>
          </section>

          <section class="editor-card" aria-labelledby="media-title">
            <div class="editor-card__head">
              <h2 id="media-title" class="editor-card__title">图片</h2>
              <p class="editor-card__hint">
                原图进私有 Bucket，公开端只展示生成的衍生图；浏览器不会出现私有 Key
              </p>
            </div>
            <ul class="media" role="list">
              <li v-for="asset in work.assets" :key="asset.assetId">
                <AdminMediaAssetCard
                  :asset="asset"
                  @retry="announce('重试接口尚未接入（T16）：失败素材需要真实 OSS 链路才能重试。')"
                  @remove="announce('删除接口尚未接入（T17）：夹具素材不会被移除。')"
                  @set-primary="announce('设主图与排序接口尚未接入（T17）：不会改变夹具中的主图设定。')"
                />
              </li>
            </ul>
            <button
              type="button"
              class="editor__button editor__button--secondary"
              @click="announce('上传接口尚未接入（T14–T16）：不会打开文件选择，也不会写入 OSS。')"
            >上传出厂照</button>
          </section>
        </div>

        <aside class="editor__aside">
          <PublicationChecklist v-if="checklist" :checklist="checklist" />
          <section class="preview-card" aria-labelledby="preview-title">
            <h2 id="preview-title" class="editor-card__title">公开预览</h2>
            <div class="preview-card__thumb">
              <img
                v-if="work.thumb"
                :src="work.thumb.src"
                :alt="work.thumb.alt"
                width="300"
                height="400"
                loading="lazy"
              >
            </div>
            <p class="preview-card__name">{{ work.dto.characterName }}</p>
            <p class="preview-card__meta">{{ work.dto.species }} · {{ SUIT_TYPE_LABELS[form.suitType] }}</p>
            <p class="preview-card__note">本地样张预览 · 公开端实际衍生图由 OSS 生成（T11–T12）</p>
          </section>
        </aside>
      </div>
    </div>
  </AdminShell>
</template>

<style scoped>
.editor {
  max-width: var(--admin-content-max);
}

.editor__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--admin-space-4);
  flex-wrap: wrap;
  margin-bottom: var(--admin-space-5);
}

.editor__heading {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
  flex-wrap: wrap;
}

.editor__back {
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
  min-height: var(--admin-touch-target);
  display: inline-flex;
  align-items: center;
}

.editor__back:hover {
  color: var(--admin-text-primary);
}

.editor__title {
  margin: 0;
  font-size: var(--admin-font-xl);
  font-weight: 600;
  line-height: var(--admin-line-tight);
}

.editor__actions {
  display: flex;
  gap: var(--admin-space-2);
}

.editor__button {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border-radius: var(--admin-radius-md);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--admin-duration-fast) var(--admin-easing);
}

.editor__button--primary {
  border: none;
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
}

.editor__button--primary:hover:not(:disabled) {
  background: var(--admin-accent-hover);
}

.editor__button--primary:disabled {
  opacity: 0.55;
  cursor: default;
}

.editor__button--secondary {
  border: 1px solid var(--admin-border-primary);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
}

.editor__button--secondary:hover:not(:disabled) {
  background: var(--admin-bg-subtle);
}

.editor__button--secondary:disabled {
  opacity: 0.55;
  cursor: default;
}

.editor__notice {
  margin: 0 0 var(--admin-space-5);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-info-soft);
  color: var(--admin-status-info);
  font-size: var(--admin-font-sm);
}

.editor__layout {
  display: grid;
  gap: var(--admin-space-5);
}

.editor__main {
  display: grid;
  gap: var(--admin-space-5);
  align-content: start;
  min-width: 0;
}

.editor__aside {
  display: grid;
  gap: var(--admin-space-5);
  align-content: start;
}

.editor-card {
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  padding: var(--admin-space-5);
}

.editor-card__title {
  margin: 0 0 var(--admin-space-4);
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.editor-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--admin-space-3);
  flex-wrap: wrap;
  margin-bottom: var(--admin-space-4);
}

.editor-card__head .editor-card__title {
  margin: 0;
}

.editor-card__hint {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.editor-card__grid {
  display: grid;
  gap: var(--admin-space-4);
}

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
  cursor: pointer;
}

.tags__remove:hover {
  color: var(--admin-danger);
  border-color: var(--admin-danger);
}

.tags__warning {
  margin: 0 0 var(--admin-space-3);
  font-size: var(--admin-font-sm);
  color: var(--admin-status-warning);
}

.media {
  list-style: none;
  margin: 0 0 var(--admin-space-4);
  padding: 0;
  display: grid;
  gap: var(--admin-space-3);
}

.preview-card__thumb {
  border-radius: var(--admin-radius-md);
  overflow: hidden;
  background: var(--admin-bg-subtle);
  margin-bottom: var(--admin-space-3);
}

.preview-card__thumb img {
  width: 100%;
  height: auto;
  display: block;
  aspect-ratio: 3 / 4;
  object-fit: cover;
}

.preview-card__name {
  margin: 0;
  font-weight: 600;
}

.preview-card__meta {
  margin: 0.1rem 0 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.preview-card__note {
  margin: var(--admin-space-2) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.editor-missing {
  max-width: var(--admin-reading-max);
  margin: var(--admin-space-8) auto;
  text-align: center;
  background: var(--admin-bg-primary);
  border: 1px dashed var(--admin-border-primary);
  border-radius: var(--admin-radius-lg);
  padding: var(--admin-space-8);
}

.editor-missing__title {
  margin: 0;
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.editor-missing__text {
  margin: var(--admin-space-2) 0 var(--admin-space-4);
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.editor-missing__back {
  color: var(--admin-accent-primary);
  font-weight: 600;
}

@media (min-width: 768px) {
  .editor-card__grid {
    grid-template-columns: 1fr 1fr;
  }

  .field--wide {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .editor__layout {
    grid-template-columns: 1fr var(--admin-editor-preview-width);
    align-items: start;
  }

  .editor__aside {
    position: sticky;
    top: var(--admin-space-6);
  }
}
</style>
