<script setup lang="ts">
import { managedWorkResponseSchema } from '~~/shared/schemas/work'
import { AdminApiError } from '~/composables/useAdminApi'
import type { WorkBasicsForm } from '~/components/admin/WorkBasicsFields.vue'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '创建作品',
  robots: 'noindex, nofollow',
})

const adminApi = useAdminApi()

const form = ref<WorkBasicsForm>({
  characterName: '',
  featureTags: [],
  ownerContact: '',
  ownerDisplay: '有点小狗工作室',
  purpose: 'commission',
  slug: '',
  species: '',
  suitType: 'full',
})

const saving = ref(false)
const saveError = ref<string | null>(null)

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function validate(): string | null {
  const value = form.value
  if (!value.characterName.trim() || !value.species.trim()) {
    return '角色名与物种为必填项。'
  }
  if (!SLUG_PATTERN.test(value.slug)) {
    return '链接别名只能使用小写字母、数字与连字符，且不能以连字符开头或结尾。'
  }
  const tags = value.featureTags.map(tag => tag.trim())
  if (tags.some(tag => tag.length === 0) && value.featureTags.length > 0) {
    return '作品属性不能为空条目，请删除空行。'
  }
  if (new Set(tags).size !== tags.length) {
    return '作品属性不得重复。'
  }
  return null
}

async function createWork() {
  if (saving.value) {
    return
  }
  saveError.value = validate()
  if (saveError.value) {
    return
  }
  saving.value = true
  try {
    const value = form.value
    const result = await adminApi('/api/admin/v1/works', {
      method: 'POST',
      body: {
        slug: value.slug.trim(),
        characterName: value.characterName.trim(),
        species: value.species.trim(),
        suitType: value.suitType,
        purpose: value.purpose,
        ownerDisplay: value.ownerDisplay,
        ownerContact: value.ownerContact.trim() === '' ? null : value.ownerContact.trim(),
        featureTags: value.featureTags.map(tag => tag.trim()),
      },
      schema: managedWorkResponseSchema,
    })
    await navigateTo(`/admin/works/${result.data.id}`)
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (error instanceof AdminApiError && error.status === 409) {
      saveError.value = '该链接别名已被使用，请更换后重试。'
      return
    }
    if (error instanceof AdminApiError && error.status === 400) {
      saveError.value = '填写内容未通过校验，请检查标星字段后重试。'
      return
    }
    saveError.value = '创建失败，请稍后重试；已填写的内容不会丢失。'
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

      <AdminWorkBasicsFields v-model="form" />

      <p class="new-work__note">
        创建后进入编辑页上传出厂照；作品保存为草稿，发布前不会出现在公开端。
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

.new-work__note {
  margin: var(--admin-space-4) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}
</style>
