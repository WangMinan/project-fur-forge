<script setup lang="ts">
import type {
  AdminReturnCharacterDto,
  WorkListItemDto,
} from '~~/shared/types/contracts'
import { RETURN_CONSENT_SOURCE_LABELS } from '~/utils/return-labels'
import { PUBLICATION_STATUS_LABELS } from '~/utils/work-labels'

/** 设定基本信息 + 可选授权记录。表单草稿由父页面持有（409 时要保留）。 */
export interface ReturnCharacterForm {
  consentConfirmedAt: string
  consentNote: string
  consentSource: '' | 'qq' | 'email' | 'other'
  name: string
  nickname: string
  slug: string
  workId: string
}

const form = defineModel<ReturnCharacterForm>('form', { required: true })

defineProps<{
  conflict: AdminReturnCharacterDto | null
  works: WorkListItemDto[]
}>()

const selectedWork = computed(() => form.value.workId)
</script>

<template>
  <div class="character-cards">
    <section class="admin-card">
      <h2 class="admin-card__title">设定</h2>

      <label class="admin-field">
        <span class="admin-field__label">名称</span>
        <input
          v-model="form.name"
          type="text"
          maxlength="100"
          class="admin-field__control"
        >
      </label>

      <label class="admin-field">
        <span class="admin-field__label">昵称（可选）</span>
        <input
          v-model="form.nickname"
          type="text"
          maxlength="50"
          class="admin-field__control admin-field__control--short"
        >
        <span class="admin-field__help">返图页显示为 @昵称，不用自己加 @。</span>
      </label>

      <label class="admin-field">
        <span class="admin-field__label">网址名称</span>
        <input
          v-model="form.slug"
          type="text"
          maxlength="120"
          class="admin-field__control admin-field__control--short"
        >
        <span class="admin-field__help">
          返图页地址：/returns/{{ form.slug.trim() || '…' }}
        </span>
      </label>

      <label class="admin-field">
        <span class="admin-field__label">关联作品（可选）</span>
        <select v-model="form.workId" class="admin-field__control">
          <option value="">不关联</option>
          <option v-for="work in works" :key="work.id" :value="work.id">
            {{ work.characterName }}
          </option>
        </select>
        <span class="admin-field__help">
          <template v-if="selectedWork === ''">
            留空也可以正常发布返图。
          </template>
          <template v-else>
            返图页会给出这件作品的入口。作品未发布时只是暂时不显示入口，
            返图照常公开。
          </template>
        </span>
      </label>
    </section>

    <section class="admin-card">
      <h2 class="admin-card__title">授权记录（可选，仅后台可见）</h2>
      <p class="admin-card__hint">
        三项都可以留空，不影响保存和发布。只保存在后台，不出现在公开页面。
      </p>
      <label class="admin-field">
        <span class="admin-field__label">授权来源</span>
        <select
          v-model="form.consentSource"
          class="admin-field__control admin-field__control--short"
        >
          <option value="">未记录</option>
          <option
            v-for="(label, value) in RETURN_CONSENT_SOURCE_LABELS"
            :key="value"
            :value="value"
          >{{ label }}</option>
        </select>
      </label>
      <label class="admin-field">
        <span class="admin-field__label">确认时间</span>
        <input
          v-model="form.consentConfirmedAt"
          type="date"
          class="admin-field__control admin-field__control--short"
        >
      </label>
      <label class="admin-field">
        <span class="admin-field__label">内部备注</span>
        <textarea
          v-model="form.consentNote"
          maxlength="500"
          rows="3"
          class="admin-field__control"
        />
      </label>
    </section>

    <!-- 保存按钮在页头右上角（与作品编辑页一致），这里只报冲突。 -->
    <p v-if="conflict" class="character-cards__conflict" role="status">
      服务端最新内容：名称「{{ conflict.name }}」，网址名称
      {{ conflict.slug }}{{ conflict.work ? `，关联${conflict.work.characterName}（${PUBLICATION_STATUS_LABELS[conflict.work.publicationStatus]}）` : '，未关联作品' }}。
      你填写的内容仍然保留。
    </p>
  </div>
</template>

<style scoped>
.character-cards {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-5);
  margin-top: var(--admin-space-6);
}

.admin-card {
  padding: var(--admin-space-5);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  background: var(--admin-bg-primary);
}

/* 授权记录卡与其他卡片一样是白底：它只是内容不同，不是警告区。 */

.admin-card__title {
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.admin-card__hint {
  margin-top: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.admin-field {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-2);
  margin-top: var(--admin-space-4);
}

.admin-field__label {
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.admin-field__control {
  width: 100%;
  max-width: 30rem;
  min-height: var(--admin-control-height);
  padding: var(--admin-space-2) var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
}

.admin-field__control--short {
  max-width: 16rem;
}

.admin-field__help {
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.character-cards__save {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--admin-space-3);
}

.character-cards__save button {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border: none;
  border-radius: var(--admin-radius-md);
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font: inherit;
  font-size: var(--admin-font-sm);
  cursor: pointer;
}

.character-cards__save button:disabled {
  opacity: 0.55;
  cursor: default;
}

.character-cards__conflict {
  flex: 1 1 20rem;
  padding: var(--admin-space-3);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-warning-soft);
  color: var(--admin-status-warning);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}
</style>
