<script setup lang="ts">
import type { AdminSiteContentDto } from '~~/shared/types/contracts'
import {
  hasUnsafePlainText,
  SITE_CONTENT_LIMITS,
} from '~/utils/site-content'

/**
 * T34-F3 委托 FAQ：独立分区、独立版本。
 * 每项有稳定 ID，Vue key 用 ID 而非数组下标，新增/删除/重排不会复用错误的输入状态。
 */
const props = defineProps<{
  content: AdminSiteContentDto
  conflictSection: string | null
  savedSection: string | null
  savingSection: string | null
}>()

const emit = defineEmits<{
  save: [payload: Record<string, unknown>]
}>()

const card = useSiteContentSectionCard({
  section: 'commission-faq',
  content: () => props.content,
  conflictSection: () => props.conflictSection,
  savedSection: () => props.savedSection,
  savingSection: () => props.savingSection,
  extract: dto => ({
    faqs: dto.commission.faqs.map(faq => ({ ...faq })),
  }),
})

const canAdd = computed(() =>
  card.draft.value.faqs.length < SITE_CONTENT_LIMITS.faqMaxCount)

function addRow() {
  if (!canAdd.value) {
    return
  }
  card.draft.value.faqs.push({
    id: crypto.randomUUID(),
    question: '',
    answer: '',
  })
}

function removeRow(id: string) {
  card.draft.value.faqs = card.draft.value.faqs.filter(faq => faq.id !== id)
}

/** 排序与身份分离：移动只改数组位置，ID 不变。 */
function move(id: string, delta: number) {
  const rows = card.draft.value.faqs
  const index = rows.findIndex(faq => faq.id === id)
  const target = index + delta
  if (index < 0 || target < 0 || target >= rows.length) {
    return
  }
  const [row] = rows.splice(index, 1)
  rows.splice(target, 0, row!)
}

const issues = computed(() => {
  const found: Record<string, string> = {}
  const seen = new Set<string>()
  for (const faq of card.draft.value.faqs) {
    const question = faq.question.trim()
    const answer = faq.answer.trim()
    if (!question || !answer) {
      found[faq.id] = '请同时填写问题与回答，或删除该整行'
    }
    else if (question.length > SITE_CONTENT_LIMITS.faqQuestion) {
      found[faq.id] = `问题最多 ${SITE_CONTENT_LIMITS.faqQuestion} 字`
    }
    else if (answer.length > SITE_CONTENT_LIMITS.faqAnswer) {
      found[faq.id] = `回答最多 ${SITE_CONTENT_LIMITS.faqAnswer} 字`
    }
    else if (seen.has(question)) {
      found[faq.id] = '问题不得重复'
    }
    else if (hasUnsafePlainText(question) || hasUnsafePlainText(answer)) {
      found[faq.id] = '只允许安全纯文本，不能包含 HTML 或脚本'
    }
    seen.add(question)
  }
  return found
})

function save() {
  emit('save', {
    faqs: card.draft.value.faqs.map(faq => ({
      id: faq.id,
      question: faq.question.trim(),
      answer: faq.answer.trim(),
    })),
  })
}
</script>

<template>
  <AdminSiteSectionCardShell
    section="commission-faq"
    title="委托常见问题"
    :hint="`最多 ${SITE_CONTENT_LIMITS.faqMaxCount} 项，按当前顺序显示在委托页。`"
    :conflict="card.conflict.value"
    :dirty="card.isDirty.value"
    :has-issues="Object.keys(issues).length > 0"
    :saved="card.saved.value"
    :saving="card.saving.value"
    @adopt-latest="card.adoptLatest"
    @reset="card.reset"
    @save="save"
  >
    <p v-if="card.draft.value.faqs.length === 0" class="faq-empty">
      还没有常见问题。
    </p>

    <ol class="faq-list">
      <li
        v-for="(faq, index) in card.draft.value.faqs"
        :key="faq.id"
        class="faq-row"
        :data-faq-id="faq.id"
      >
        <div class="faq-row__header">
          <span class="faq-row__index">第 {{ index + 1 }} 项</span>
          <div class="faq-row__actions">
            <button
              type="button"
              class="faq-row__button"
              :disabled="index === 0"
              :aria-label="`上移第 ${index + 1} 项`"
              @click="move(faq.id, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="faq-row__button"
              :disabled="index === card.draft.value.faqs.length - 1"
              :aria-label="`下移第 ${index + 1} 项`"
              @click="move(faq.id, 1)"
            >
              ↓
            </button>
            <button
              type="button"
              class="faq-row__button"
              :aria-label="`删除第 ${index + 1} 项`"
              @click="removeRow(faq.id)"
            >
              删除
            </button>
          </div>
        </div>

        <input
          v-model="faq.question"
          class="faq-row__input"
          type="text"
          :aria-label="`第 ${index + 1} 项问题`"
          placeholder="问题"
        >
        <textarea
          v-model="faq.answer"
          class="faq-row__input faq-row__input--area"
          rows="3"
          :aria-label="`第 ${index + 1} 项回答`"
          placeholder="回答"
        />
        <p v-if="issues[faq.id]" class="faq-row__issue" role="alert">
          {{ issues[faq.id] }}
        </p>
      </li>
    </ol>

    <button
      type="button"
      class="faq-add"
      :disabled="!canAdd"
      data-testid="site-faq-add"
      @click="addRow"
    >
      新增问题
    </button>

    <template #latest>
      <ol class="faq-latest">
        <li v-for="faq in card.latest.value.faqs" :key="`latest-${faq.id}`">
          <strong>{{ faq.question }}</strong>
          <span>{{ faq.answer }}</span>
        </li>
        <li v-if="card.latest.value.faqs.length === 0">（未填写）</li>
      </ol>
    </template>
  </AdminSiteSectionCardShell>
</template>

<style scoped>
.faq-list,
.faq-latest {
  display: grid;
  gap: var(--admin-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.faq-empty,
.faq-row__issue {
  margin: 0;
  font-size: var(--admin-font-xs);
}

.faq-empty {
  color: var(--admin-text-secondary);
}

.faq-row {
  display: grid;
  gap: var(--admin-space-1);
  padding: var(--admin-space-3);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-sm);
}

.faq-row__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--admin-space-2);
}

.faq-row__index {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
}

.faq-row__actions {
  display: flex;
  gap: var(--admin-space-1);
}

.faq-row__button,
.faq-add {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-xs);
  cursor: pointer;
}

.faq-add {
  justify-self: start;
  /* T26–T27 视觉：新增按钮与上方列表保持可见间距。 */
  margin-top: var(--admin-space-2);
  padding: 0 var(--admin-space-3);
}

.faq-row__button:disabled,
.faq-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.faq-row__input {
  width: 100%;
  padding: var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
}

.faq-row__input--area {
  line-height: var(--admin-line-normal);
  resize: vertical;
}

.faq-row__issue {
  color: var(--admin-text-danger, #b3261e);
}

.faq-latest {
  font-size: var(--admin-font-xs);
}

.faq-latest li {
  display: grid;
  gap: 2px;
}
</style>
