<script setup lang="ts">
import type { WatermarkCandidateDto } from '~~/shared/types/contracts'
import { formatWatermarkDateTime } from '~/utils/watermark-labels'
import type { useWatermarkLogoUpload } from '~/composables/useWatermarkLogoUpload'
import { adminUploadProgressModel } from '~/utils/admin-upload-progress'

const props = defineProps<{
  brandingVersion: number
  candidates: WatermarkCandidateDto[]
  disabled: boolean
  selectedAssetId: string | null
  upload: ReturnType<typeof useWatermarkLogoUpload>
}>()

const emit = defineEmits<{
  select: [assetId: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const pendingFile = ref<File | null>(null)

const uploadProgress = computed(() => adminUploadProgressModel({
  failureText: props.upload.failureText.value,
  label: props.upload.fileName.value ?? '水印 Logo 上传',
  progress: props.upload.progress.value,
  stage: props.upload.stage.value === 'done' ? 'completed' : props.upload.stage.value,
  stageLabel: props.upload.failureStage.value,
}))

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  pendingFile.value = input.files?.[0] ?? null
}

async function startUpload() {
  const file = pendingFile.value
  if (!file || props.upload.busy.value) {
    return
  }
  pendingFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  await props.upload.start(file, props.brandingVersion)
}
</script>

<template>
  <section class="editor-card branding-candidates" aria-labelledby="branding-candidates-title">
    <div class="editor-card__head">
      <h2 id="branding-candidates-title" class="editor-card__title">Logo 候选</h2>
      <p class="editor-card__hint">透明 PNG · 不超过 20 MB</p>
    </div>

    <div class="branding-candidates__uploader">
      <input
        ref="fileInput"
        type="file"
        accept="image/png"
        hidden
        aria-label="选择水印 Logo 文件"
        @change="onFileChange"
      >
      <AdminAction
        :disabled="disabled || upload.busy.value"
        @click="pickFile"
      >选择 PNG</AdminAction>
      <span class="branding-candidates__filename" aria-live="polite">
        {{ pendingFile?.name ?? '未选择文件' }}
      </span>
      <AdminAction
        variant="primary"
        :disabled="!pendingFile || disabled || upload.busy.value"
        :loading="upload.busy.value"
        loading-label="上传中…"
        @click="startUpload"
      >上传候选</AdminAction>
    </div>

    <AdminTaskProgress
      v-if="upload.stage.value !== 'idle'"
      v-bind="uploadProgress"
    />

    <p v-if="candidates.length === 0" class="branding-candidates__empty">
      还没有 Logo 候选。上传一张透明 PNG 后开始配置水印。
    </p>

    <ul v-else class="branding-candidates__list" role="list">
      <li v-for="candidate in candidates" :key="candidate.assetId">
        <label
          class="branding-candidate"
          :data-selected="selectedAssetId === candidate.assetId"
        >
          <input
            type="radio"
            name="watermark-candidate"
            class="branding-candidate__radio"
            :value="candidate.assetId"
            :checked="selectedAssetId === candidate.assetId"
            :disabled="disabled"
            @change="emit('select', candidate.assetId)"
          >
          <span class="branding-candidate__thumb-frame">
            <img
              :src="candidate.previewUrl"
              :alt="`候选 Logo ${candidate.width}×${candidate.height}`"
              class="branding-candidate__thumb"
              loading="lazy"
              referrerpolicy="no-referrer"
            >
          </span>
          <span class="branding-candidate__meta">
            <span class="branding-candidate__badges">
              <AdminStatusBadge v-if="candidate.active" tone="success" label="当前使用" />
              <AdminStatusBadge v-else-if="candidate.draft" tone="info" label="草稿" />
            </span>
            <span class="branding-candidate__facts">
              {{ candidate.width }}×{{ candidate.height }} ·
              {{ formatWatermarkDateTime(candidate.createdAt) }}
            </span>
          </span>
        </label>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.branding-candidates__uploader {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
  flex-wrap: wrap;
  margin-bottom: var(--admin-space-3);
}

.branding-candidates__filename {
  min-width: 6rem;
  max-width: 16rem;
  overflow: hidden;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.branding-candidates__empty {
  margin: 0;
  padding: var(--admin-space-5);
  border: 1px dashed var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
  text-align: center;
}

.branding-candidates__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--admin-space-2);
  max-height: 22rem;
  overflow-y: auto;
}

.branding-candidate {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
  padding: var(--admin-space-2);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  cursor: pointer;
  min-height: var(--admin-touch-target);
}

.branding-candidate:hover {
  background: var(--admin-bg-subtle);
}

.branding-candidate[data-selected='true'] {
  border-color: var(--admin-accent-primary);
}

.branding-candidate__radio {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--admin-accent-primary);
  flex-shrink: 0;
}

.branding-candidate__thumb-frame {
  width: 4rem;
  height: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--admin-radius-sm);
  /* 透明 PNG 需要可辨识的衬底，但不喧宾夺主。 */
  background:
    repeating-conic-gradient(var(--admin-bg-subtle) 0% 25%, var(--admin-bg-primary) 0% 50%)
    0 0 / 1rem 1rem;
  border: 1px solid var(--admin-border-secondary);
  flex-shrink: 0;
  overflow: hidden;
}

.branding-candidate__thumb {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.branding-candidate__meta {
  display: grid;
  gap: var(--admin-space-1);
  min-width: 0;
}

.branding-candidate__badges {
  display: flex;
  gap: var(--admin-space-1);
}

.branding-candidate__facts {
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}
</style>
