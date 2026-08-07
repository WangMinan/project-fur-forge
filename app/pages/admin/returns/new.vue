<script setup lang="ts">
import { adminReturnPhotoResponseSchema } from '~~/shared/schemas/return-photo'
import { workListResponseSchema } from '~~/shared/schemas/work'
import type { WorkListItemDto } from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'

/**
 * 新建返图：只收集关联作品、alt 与排序，保存后进入编辑页上传图片。
 * 图片必须在记录存在之后上传，因为上传会话的归属是返图记录及其版本。
 */
definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '新增返图',
  robots: 'noindex, nofollow',
})

const adminApi = useAdminApi()
const works = ref<WorkListItemDto[]>([])
const workId = ref('')
const alt = ref('')
const sortOrder = ref(0)
const submitting = ref(false)
const errorText = ref<string | null>(null)

onMounted(async () => {
  try {
    const response = await adminApi('/api/admin/v1/works', {
      schema: workListResponseSchema,
    })
    works.value = response.data
  }
  catch {
    errorText.value = '作品列表加载失败，请刷新页面后重试。'
  }
})

const canSubmit = computed(
  () => workId.value !== '' && alt.value.trim() !== '' && !submitting.value,
)

async function submit() {
  if (!canSubmit.value) {
    return
  }
  submitting.value = true
  errorText.value = null
  try {
    const created = await adminApi('/api/admin/v1/returns', {
      method: 'POST',
      body: {
        workId: workId.value,
        alt: alt.value.trim(),
        sortOrder: sortOrder.value,
        authorization: { source: null, confirmedAt: null, note: null },
      },
      schema: adminReturnPhotoResponseSchema,
    })
    await navigateTo(`/admin/returns/${created.data.id}`)
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    errorText.value = error instanceof AdminApiError
      && error.reason === 'RETURN_PHOTO_WORK_NOT_FOUND'
      ? '选择的作品不存在，请重新选择。'
      : '保存失败，请检查填写内容后重试。'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <AdminShell current="returns">
    <section class="return-new">
      <header>
        <h1 class="return-new__title">新增返图</h1>
        <p class="return-new__hint">
          先选择关联作品并填写图片说明，保存后即可上传这张返图。
        </p>
      </header>

      <p v-if="errorText" class="return-new__error" role="alert">
        {{ errorText }}
      </p>

      <form class="return-new__form" @submit.prevent="submit">
        <label class="return-new__field">
          <span class="return-new__label">关联作品</span>
          <select v-model="workId" required>
            <option value="" disabled>请选择作品</option>
            <option v-for="work in works" :key="work.id" :value="work.id">
              {{ work.characterName }}
            </option>
          </select>
          <span class="return-new__help">
            返图必须属于一件已有作品。只有关联作品已发布时才能发布返图。
          </span>
        </label>

        <label class="return-new__field">
          <span class="return-new__label">图片说明（alt）</span>
          <input v-model="alt" type="text" maxlength="500" required>
          <span class="return-new__help">
            描述画面内容，供读屏使用。不要写联系方式或网址。
          </span>
        </label>

        <label class="return-new__field">
          <span class="return-new__label">排序</span>
          <input v-model.number="sortOrder" type="number" min="0" step="1">
          <span class="return-new__help">
            数字小的排在前面；相同数字时按创建顺序稳定排列。
          </span>
        </label>

        <div class="return-new__actions">
          <button type="submit" :disabled="!canSubmit">
            {{ submitting ? '保存中…' : '保存并上传图片' }}
          </button>
          <NuxtLink to="/admin/returns">取消</NuxtLink>
        </div>
      </form>
    </section>
  </AdminShell>
</template>

<style scoped>
.return-new {
  max-width: var(--admin-reading-max);
}

.return-new__title {
  font-size: var(--admin-font-xl);
  font-weight: 600;
}

.return-new__hint {
  margin-top: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.return-new__error {
  margin-top: var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
}

.return-new__form {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-6);
  margin-top: var(--admin-space-6);
}

.return-new__field {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-2);
}

.return-new__label {
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.return-new__field input,
.return-new__field select {
  min-height: var(--admin-control-height);
  max-width: 26rem;
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
}

.return-new__help {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.return-new__actions {
  display: flex;
  align-items: center;
  gap: var(--admin-space-4);
}

.return-new__actions button {
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

.return-new__actions button:disabled {
  opacity: 0.55;
  cursor: default;
}

.return-new__actions a {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}
</style>
