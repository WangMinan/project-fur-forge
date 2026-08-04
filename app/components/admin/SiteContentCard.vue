<script setup lang="ts">
import type { AdminSiteContentDto } from '~~/shared/types/contracts'
import type { SiteContentPayload } from '~/composables/useAdminSiteContent'
import {
  normalizeNullableText,
  SITE_CONTENT_LIMITS,
  siteContentFieldIssues,
} from '~/utils/site-content'

// T26–T27 固定站点内容卡片：委托/关于/联系三类字段一次原子保存；
// 可空字段留空即不公开显示，邮箱与 QQ 继续在上方“首屏设置”维护。
const props = defineProps<{
  content: AdminSiteContentDto
  mutating: boolean
  saved: boolean
}>()

const emit = defineEmits<{
  save: [payload: SiteContentPayload]
}>()

interface FaqRow {
  question: string
  answer: string
}

const intro = ref(props.content.commission.intro ?? '')
const estimateNote = ref(props.content.commission.estimateNote ?? '')
const emailAction = ref(props.content.commission.emailAction ?? '')
const faqs = ref<FaqRow[]>(props.content.commission.faqs.map(faq => ({ ...faq })))
const studioFacts = ref(props.content.about.studioFacts ?? '')
const makingScope = ref(props.content.about.makingScope ?? '')
const basicTerms = ref(props.content.about.basicTerms ?? '')
const douyin = ref(props.content.contact.douyin ?? '')
const antiScam = ref(props.content.contact.antiScam ?? '')

function snapshotOf() {
  return JSON.stringify({
    intro: intro.value,
    estimateNote: estimateNote.value,
    emailAction: emailAction.value,
    faqs: faqs.value,
    studioFacts: studioFacts.value,
    makingScope: makingScope.value,
    basicTerms: basicTerms.value,
    douyin: douyin.value,
    antiScam: antiScam.value,
  })
}

const baseline = ref(snapshotOf())

function syncFromContent(dto: AdminSiteContentDto) {
  intro.value = dto.commission.intro ?? ''
  estimateNote.value = dto.commission.estimateNote ?? ''
  emailAction.value = dto.commission.emailAction ?? ''
  faqs.value = dto.commission.faqs.map(faq => ({ ...faq }))
  studioFacts.value = dto.about.studioFacts ?? ''
  makingScope.value = dto.about.makingScope ?? ''
  basicTerms.value = dto.about.basicTerms ?? ''
  douyin.value = dto.contact.douyin ?? ''
  antiScam.value = dto.contact.antiScam ?? ''
  baseline.value = snapshotOf()
}

const isDirty = computed(() => snapshotOf() !== baseline.value)

watch(() => props.content, (dto) => {
  if (!isDirty.value) {
    syncFromContent(dto)
  }
  else {
    // 有未保存修改时只推进基线，保留管理员输入；冲突重载后可对比重试。
    baseline.value = JSON.stringify({
      intro: dto.commission.intro ?? '',
      estimateNote: dto.commission.estimateNote ?? '',
      emailAction: dto.commission.emailAction ?? '',
      faqs: dto.commission.faqs,
      studioFacts: dto.about.studioFacts ?? '',
      makingScope: dto.about.makingScope ?? '',
      basicTerms: dto.about.basicTerms ?? '',
      douyin: dto.contact.douyin ?? '',
      antiScam: dto.contact.antiScam ?? '',
    })
  }
})

const issues = computed(() => siteContentFieldIssues({
  intro: intro.value,
  estimateNote: estimateNote.value,
  emailAction: emailAction.value,
  faqs: faqs.value,
  studioFacts: studioFacts.value,
  makingScope: makingScope.value,
  basicTerms: basicTerms.value,
  douyin: douyin.value,
  antiScam: antiScam.value,
}))

const canSubmit = computed(() =>
  !props.mutating && isDirty.value && Object.keys(issues.value).length === 0,
)

const showSaved = computed(() => props.saved && !isDirty.value)

function addFaq() {
  if (faqs.value.length >= SITE_CONTENT_LIMITS.faqMaxCount) {
    return
  }
  faqs.value = [...faqs.value, { question: '', answer: '' }]
}

function removeFaq(index: number) {
  faqs.value = faqs.value.filter((_, current) => current !== index)
}

function onSave() {
  if (!canSubmit.value) {
    return
  }
  emit('save', {
    commission: {
      intro: normalizeNullableText(intro.value),
      estimateNote: normalizeNullableText(estimateNote.value),
      emailAction: normalizeNullableText(emailAction.value),
      faqs: faqs.value
        .map(faq => ({ question: faq.question.trim(), answer: faq.answer.trim() }))
        .filter(faq => faq.question.length > 0 || faq.answer.length > 0),
    },
    about: {
      studioFacts: normalizeNullableText(studioFacts.value),
      makingScope: normalizeNullableText(makingScope.value),
      basicTerms: normalizeNullableText(basicTerms.value),
    },
    contact: {
      douyin: normalizeNullableText(douyin.value),
      antiScam: normalizeNullableText(antiScam.value),
    },
  })
}
</script>

<template>
  <section class="site-content" aria-labelledby="site-content-title">
    <header class="site-content__head">
      <h2 id="site-content-title" class="site-content__card-title">页面内容</h2>
      <p class="site-content__meta">
        委托、关于、联系页的固定文字。所有字段留空即不在公开页显示对应区块；
        邮箱（{{ content.contact.email }}）与 QQ（{{ content.contact.qq }}）继续在“大图管理”的“首屏设置”维护。
      </p>
    </header>

    <div class="site-content__group" aria-labelledby="site-content-commission">
      <h3 id="site-content-commission" class="site-content__group-title">自设委托页</h3>

      <div class="site-content__field">
        <label class="site-content__label" for="sc-intro">
          委托短说明（{{ intro.trim().length }}/{{ SITE_CONTENT_LIMITS.intro }}）
        </label>
        <textarea
          id="sc-intro"
          v-model="intro"
          class="site-content__textarea"
          rows="2"
          :maxlength="SITE_CONTENT_LIMITS.intro"
          :disabled="mutating"
        />
        <p class="site-content__hint">显示在委托页页名下；不写价格和排期。</p>
        <p v-if="issues.intro" class="site-content__issue" role="alert">{{ issues.intro }}</p>
      </div>

      <div class="site-content__field">
        <label class="site-content__label" for="sc-estimate">
          人工估价说明（{{ estimateNote.trim().length }}/{{ SITE_CONTENT_LIMITS.estimateNote }}）
        </label>
        <textarea
          id="sc-estimate"
          v-model="estimateNote"
          class="site-content__textarea"
          rows="3"
          :maxlength="SITE_CONTENT_LIMITS.estimateNote"
          :disabled="mutating"
        />
        <p class="site-content__hint">说明逐单人工估价的方式与需要访客准备的资料。</p>
        <p v-if="issues.estimateNote" class="site-content__issue" role="alert">{{ issues.estimateNote }}</p>
      </div>

      <div class="site-content__field">
        <label class="site-content__label" for="sc-email-action">
          邮件行动说明（{{ emailAction.trim().length }}/{{ SITE_CONTENT_LIMITS.emailAction }}）
        </label>
        <textarea
          id="sc-email-action"
          v-model="emailAction"
          class="site-content__textarea"
          rows="2"
          :maxlength="SITE_CONTENT_LIMITS.emailAction"
          :disabled="mutating"
        />
        <p class="site-content__hint">显示在“打开邮件客户端 / 复制邮箱”按钮旁，说明回信时效等。</p>
        <p v-if="issues.emailAction" class="site-content__issue" role="alert">{{ issues.emailAction }}</p>
      </div>

      <div class="site-content__field">
        <span class="site-content__label">常见问题（{{ faqs.length }}/{{ SITE_CONTENT_LIMITS.faqMaxCount }}）</span>
        <p class="site-content__hint">只保留已确认的问答；空行保存时自动忽略。</p>
        <p v-if="issues.faqs" class="site-content__issue" role="alert">{{ issues.faqs }}</p>

        <div v-for="(faq, index) in faqs" :key="index" class="site-content__faq">
          <div class="site-content__faq-head">
            <span class="site-content__faq-index">问题 {{ index + 1 }}</span>
            <button
              type="button"
              class="site-content__button"
              :disabled="mutating"
              @click="removeFaq(index)"
            >删除</button>
          </div>
          <label class="site-content__sr" :for="`sc-faq-q-${index}`">问题 {{ index + 1 }} 的问题</label>
          <input
            :id="`sc-faq-q-${index}`"
            v-model="faq.question"
            class="site-content__input"
            type="text"
            placeholder="问题"
            :maxlength="SITE_CONTENT_LIMITS.faqQuestion"
            :disabled="mutating"
          >
          <label class="site-content__sr" :for="`sc-faq-a-${index}`">问题 {{ index + 1 }} 的回答</label>
          <textarea
            :id="`sc-faq-a-${index}`"
            v-model="faq.answer"
            class="site-content__textarea"
            rows="2"
            placeholder="回答"
            :maxlength="SITE_CONTENT_LIMITS.faqAnswer"
            :disabled="mutating"
          />
          <p v-if="issues[`faq-${index}`]" class="site-content__issue" role="alert">
            {{ issues[`faq-${index}`] }}
          </p>
        </div>

        <button
          v-if="faqs.length < SITE_CONTENT_LIMITS.faqMaxCount"
          type="button"
          class="site-content__button"
          :disabled="mutating"
          @click="addFaq"
        >新增问题</button>
      </div>
    </div>

    <div class="site-content__group" aria-labelledby="site-content-about">
      <h3 id="site-content-about" class="site-content__group-title">关于页</h3>

      <div class="site-content__field">
        <label class="site-content__label" for="sc-facts">
          工作室事实（{{ studioFacts.trim().length }}/{{ SITE_CONTENT_LIMITS.studioFacts }}）
        </label>
        <textarea
          id="sc-facts"
          v-model="studioFacts"
          class="site-content__textarea"
          rows="4"
          :maxlength="SITE_CONTENT_LIMITS.studioFacts"
          :disabled="mutating"
        />
        <p class="site-content__hint">只写真实、可核对的事实；空行分段。</p>
        <p v-if="issues.studioFacts" class="site-content__issue" role="alert">{{ issues.studioFacts }}</p>
      </div>

      <div class="site-content__field">
        <label class="site-content__label" for="sc-scope">
          制作范围（{{ makingScope.trim().length }}/{{ SITE_CONTENT_LIMITS.makingScope }}）
        </label>
        <textarea
          id="sc-scope"
          v-model="makingScope"
          class="site-content__textarea"
          rows="4"
          :maxlength="SITE_CONTENT_LIMITS.makingScope"
          :disabled="mutating"
        />
        <p class="site-content__hint">关于页的制作范围补充说明；空行分段。</p>
        <p v-if="issues.makingScope" class="site-content__issue" role="alert">{{ issues.makingScope }}</p>
      </div>

      <div class="site-content__field">
        <label class="site-content__label" for="sc-terms">
          基本约定（{{ basicTerms.trim().length }}/{{ SITE_CONTENT_LIMITS.basicTerms }}）
        </label>
        <textarea
          id="sc-terms"
          v-model="basicTerms"
          class="site-content__textarea site-content__textarea--tall"
          rows="10"
          :maxlength="SITE_CONTENT_LIMITS.basicTerms"
          :disabled="mutating"
        />
        <p class="site-content__hint">显示在关于页“基本约定”区；空行分段，逐条换行书写。</p>
        <p v-if="issues.basicTerms" class="site-content__issue" role="alert">{{ issues.basicTerms }}</p>
      </div>
    </div>

    <div class="site-content__group" aria-labelledby="site-content-contact">
      <h3 id="site-content-contact" class="site-content__group-title">联系页</h3>

      <div class="site-content__field">
        <label class="site-content__label" for="sc-douyin">抖音号</label>
        <input
          id="sc-douyin"
          v-model="douyin"
          class="site-content__input site-content__input--narrow"
          type="text"
          :maxlength="SITE_CONTENT_LIMITS.douyinMax"
          :disabled="mutating"
        >
        <p class="site-content__hint">2–30 位字母、数字、点、下划线或连字符。</p>
        <p v-if="issues.douyin" class="site-content__issue" role="alert">{{ issues.douyin }}</p>
      </div>

      <div class="site-content__field">
        <label class="site-content__label" for="sc-antiscam">
          防诈骗提示（{{ antiScam.trim().length }}/{{ SITE_CONTENT_LIMITS.antiScam }}）
        </label>
        <textarea
          id="sc-antiscam"
          v-model="antiScam"
          class="site-content__textarea"
          rows="3"
          :maxlength="SITE_CONTENT_LIMITS.antiScam"
          :disabled="mutating"
        />
        <p class="site-content__hint">说明官方渠道边界与核验方式；空行分段。</p>
        <p v-if="issues.antiScam" class="site-content__issue" role="alert">{{ issues.antiScam }}</p>
      </div>
    </div>

    <div class="site-content__actions">
      <p v-if="showSaved" class="site-content__saved" role="status">已保存</p>
      <button
        type="button"
        class="site-content__button site-content__button--primary"
        :disabled="!canSubmit"
        @click="onSave"
      >{{ mutating ? '保存中…' : '保存页面内容' }}</button>
    </div>
  </section>
</template>

<style scoped>
.site-content {
  display: grid;
  gap: var(--admin-space-4);
}

.site-content__head {
  display: grid;
  gap: var(--admin-space-1);
}

.site-content__card-title {
  margin: 0;
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.site-content__meta {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-secondary);
  line-height: var(--admin-line-normal);
}

.site-content__group {
  display: grid;
  gap: var(--admin-space-3);
  padding-top: var(--admin-space-3);
  border-top: 1px solid var(--admin-border-secondary);
}

.site-content__group-title {
  margin: 0;
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.site-content__field {
  display: grid;
  gap: 0;
}

.site-content__label {
  display: block;
  font-size: var(--admin-font-xs);
  font-weight: 600;
  margin-bottom: var(--admin-space-1);
}

.site-content__input,
.site-content__textarea {
  width: 100%;
  padding: 0 var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  font: inherit;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
}

.site-content__input {
  min-height: var(--admin-control-height-sm);
}

.site-content__input--narrow {
  max-width: 16rem;
}

.site-content__textarea {
  padding: var(--admin-space-2);
  resize: vertical;
  line-height: var(--admin-line-normal);
}

.site-content__textarea--tall {
  min-height: 12rem;
}

.site-content__hint {
  margin: var(--admin-space-1) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.site-content__issue {
  margin: var(--admin-space-1) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-error);
}

.site-content__faq {
  display: grid;
  gap: var(--admin-space-2);
  margin-top: var(--admin-space-2);
  padding: var(--admin-space-3);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-sm);
}

.site-content__faq-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--admin-space-2);
}

.site-content__faq-index {
  font-size: var(--admin-font-xs);
  font-weight: 600;
  color: var(--admin-text-secondary);
}

.site-content__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.site-content__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--admin-space-3);
}

.site-content__saved {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-success);
}

.site-content__button {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font-size: var(--admin-font-xs);
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.site-content__button:hover:not(:disabled) {
  background: var(--admin-bg-subtle);
}

.site-content__button:disabled {
  opacity: 0.55;
  cursor: default;
}

.site-content__button--primary {
  background: var(--admin-accent-primary);
  border-color: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font-weight: 600;
}

.site-content__button--primary:hover:not(:disabled) {
  background: var(--admin-accent-primary);
}
</style>
