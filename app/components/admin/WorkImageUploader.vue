<script setup lang="ts">
import type { useStudioPhotoUpload } from '~/composables/useStudioPhotoUpload'

const props = defineProps<{
  disabled: boolean
  empty: boolean
  label: string
  uploads: ReturnType<typeof useStudioPhotoUpload>
  workId: string
  workVersion: number
}>()
const selectedFile = shallowRef<File | null>(null)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const busy = computed(() => props.uploads.items.value.some(item => ['digesting', 'uploading', 'validating'].includes(item.state)))

async function uploadSelectedFile() {
  if (!selectedFile.value || props.disabled || !props.empty || busy.value) return
  const file = selectedFile.value
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
  await props.uploads.startUpload(file, { workId: props.workId, workVersion: props.workVersion })
}
</script>

<template>
  <div class="work-image-upload">
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      :aria-label="`选择领养${label}文件`"
      @change="selectedFile = ($event.target as HTMLInputElement).files?.[0] ?? null"
    >
    <div v-if="empty" class="work-image-upload__actions">
      <AdminAction :disabled="disabled || busy" @click="fileInput?.click()">选择{{ label }}</AdminAction>
      <span class="work-image-upload__filename">{{ selectedFile?.name ?? '未选择图片' }}</span>
      <AdminAction variant="primary" :disabled="!selectedFile || disabled || busy" :loading="busy" loading-label="处理中…" @click="uploadSelectedFile">上传{{ label }}</AdminAction>
    </div>
    <ul v-if="uploads.items.value.length > 0" class="work-image-upload__sessions" role="list">
      <li v-for="item in uploads.items.value" :key="item.id">
        <AdminUploadSessionCard
          :item="item"
          @cancel="uploads.cancelUpload(item)"
          @dismiss="uploads.dismiss(item)"
          @retry-processing="uploads.retryProcessing(item)"
          @retry-upload="uploads.retryUpload(item, { workId, workVersion })"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.work-image-upload { margin-top: var(--admin-space-3); }
.work-image-upload__actions { display: flex; align-items: center; gap: var(--admin-space-2); flex-wrap: wrap; }
.work-image-upload__filename { min-width: 0; max-width: 24rem; overflow: hidden; color: var(--admin-text-secondary); font-size: var(--admin-font-sm); text-overflow: ellipsis; white-space: nowrap; }
.work-image-upload__sessions { display: grid; gap: var(--admin-space-3); margin: var(--admin-space-3) 0 0; padding: 0; list-style: none; }
</style>
