<script setup lang="ts">
import { managedWorkResponseSchema } from '~~/shared/schemas/work'
import { AdminApiError } from '~/composables/useAdminApi'
import {
  emptyWorkForm,
  hasWorkFormError,
  toWorkFieldsPayload,
  validateWorkForm,
} from '~/utils/work-form'
import { workApiErrorText } from '~/utils/work-errors'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '创建作品',
  robots: 'noindex, nofollow',
})

const adminApi = useAdminApi()

const form = ref(emptyWorkForm())
const submitted = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)

const errors = computed(() => validateWorkForm(form.value))
const invalid = computed(() => hasWorkFormError(errors.value))

async function createWork() {
  if (saving.value) {
    return
  }
  submitted.value = true
  saveError.value = null
  if (invalid.value) {
    saveError.value = '填写内容未通过校验，请修正下方标注的字段后重试。'
    return
  }
  saving.value = true
  try {
    const result = await adminApi('/api/admin/v1/works', {
      method: 'POST',
      body: toWorkFieldsPayload(form.value),
      schema: managedWorkResponseSchema,
    })
    await navigateTo(`/admin/works/${result.data.id}`)
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    saveError.value = workApiErrorText(
      error,
      '创建失败，请稍后重试；已填写的内容不会丢失。',
    )
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <AdminShell current="works">
    <div class="new-work">
      <header class="new-work__header">
        <div class="new-work__heading">
          <NuxtLink to="/admin/works" class="new-work__back">← 作品</NuxtLink>
          <h1 class="new-work__title">创建作品</h1>
        </div>
        <button
          type="button"
          class="new-work__submit"
          :disabled="saving"
          @click="createWork"
        >{{ saving ? '创建中…' : '创建草稿' }}</button>
      </header>

      <p v-if="saveError" class="new-work__error" role="alert">{{ saveError }}</p>

      <div class="new-work__fields">
        <AdminWorkBasicsFields
          v-model="form"
          :errors="errors"
          :show-errors="submitted"
        />
      </div>

      <p class="new-work__note">
        创建后进入编辑页上传出厂照；作品保存为草稿，发布前不会出现在公开端。
        领养作品的完整发布流程属于 T25，本阶段只维护字段。
      </p>
    </div>
  </AdminShell>
</template>

<style scoped>
.new-work {
  max-width: var(--admin-reading-max);
}

.new-work__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--admin-space-4);
  flex-wrap: wrap;
  margin-bottom: var(--admin-space-5);
}

.new-work__heading {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
  flex-wrap: wrap;
}

.new-work__back {
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
  min-height: var(--admin-touch-target);
  display: inline-flex;
  align-items: center;
}

.new-work__back:hover {
  color: var(--admin-text-primary);
}

.new-work__title {
  margin: 0;
  font-size: var(--admin-font-xl);
  font-weight: 600;
  line-height: var(--admin-line-tight);
}

.new-work__submit {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border: none;
  border-radius: var(--admin-radius-md);
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.new-work__submit:hover:not(:disabled) {
  background: var(--admin-accent-hover);
}

.new-work__submit:disabled {
  opacity: 0.55;
  cursor: default;
}

.new-work__error {
  margin: 0 0 var(--admin-space-5);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
}

.new-work__fields {
  display: grid;
  gap: var(--admin-space-5);
  min-width: 0;
}

.new-work__note {
  margin: var(--admin-space-4) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
  line-height: var(--admin-line-normal);
}
</style>
