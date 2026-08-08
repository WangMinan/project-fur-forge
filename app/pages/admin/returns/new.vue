<script setup lang="ts">
import { adminReturnCharacterResponseSchema } from '~~/shared/schemas/return-photo'
import { workListResponseSchema } from '~~/shared/schemas/work'
import type { WorkListItemDto } from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'
import { SLUG_PATTERN } from '~/utils/work-form'

/**
 * 新增设定：先确定这是谁的设定，保存后在编辑页逐张上传返图。
 * 关联作品可以留空——老作品没上架、甚至没建作品记录，也可以有返图。
 */
definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '新增设定',
  robots: 'noindex, nofollow',
})

const adminApi = useAdminApi()
const works = ref<WorkListItemDto[]>([])
const name = ref('')
const nickname = ref('')
const slug = ref('')
const workId = ref('')
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
    // 作品列表只用于可选关联，取不到不影响新建设定。
    works.value = []
  }
})

const slugValid = computed(() => SLUG_PATTERN.test(slug.value.trim()))

const canSubmit = computed(() => (
  name.value.trim() !== '' && slugValid.value && !submitting.value
))

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
        slug: slug.value.trim(),
        name: name.value.trim(),
        nickname: nickname.value.trim() === '' ? null : nickname.value.trim(),
        workId: workId.value === '' ? null : workId.value,
        authorization: { source: null, confirmedAt: null, note: null },
      },
      schema: adminReturnCharacterResponseSchema,
    })
    await navigateTo(`/admin/returns/${created.data.id}`)
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    errorText.value = error instanceof AdminApiError
      && error.reason === 'RETURN_CHARACTER_SLUG_TAKEN'
      ? '这个网址名称已经被其他设定使用，请换一个。'
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
        <h1 class="return-new__title">新增设定</h1>
        <p class="return-new__hint">
          保存后就可以上传这个设定的返图，一个设定可以放多张。
        </p>
      </header>

      <p v-if="errorText" class="return-new__error" role="alert">
        {{ errorText }}
      </p>

      <form class="return-new__form" @submit.prevent="submit">
        <label class="return-new__field">
          <span class="return-new__label">名称</span>
          <input v-model="name" type="text" maxlength="100" required>
          <span class="return-new__help">设定的名字，例如“天暮”。</span>
        </label>

        <label class="return-new__field">
          <span class="return-new__label">昵称（可选）</span>
          <input v-model="nickname" type="text" maxlength="50">
          <span class="return-new__help">
            返图页上显示为 @昵称，不用自己加 @。
          </span>
        </label>

        <label class="return-new__field">
          <span class="return-new__label">网址名称</span>
          <input v-model="slug" type="text" maxlength="120" required>
          <span
            v-if="slug.trim() !== '' && !slugValid"
            class="return-new__field-error"
            role="alert"
          >只能使用小写字母、数字与连字符，且不能以连字符开头或结尾</span>
          <span v-else class="return-new__help">
            返图页地址会是 /returns/{{ slug.trim() || 'tianmu' }}。
          </span>
        </label>

        <label class="return-new__field">
          <span class="return-new__label">关联作品（可选）</span>
          <select v-model="workId">
            <option value="">不关联</option>
            <option v-for="work in works" :key="work.id" :value="work.id">
              {{ work.characterName }}
            </option>
          </select>
          <span class="return-new__help">
            关联后返图页会给出这件作品的入口。留空也可以正常发布返图。
          </span>
        </label>

        <div class="return-new__actions">
          <button type="submit" :disabled="!canSubmit">
            {{ submitting ? '保存中…' : '保存并上传返图' }}
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

.return-new__field-error {
  color: var(--admin-status-error);
  font-size: var(--admin-font-xs);
  font-weight: 600;
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
