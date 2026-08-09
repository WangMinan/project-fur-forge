<script setup lang="ts">
import {
  adminReturnCharacterResponseSchema,
  adminReturnPhotoResponseSchema,
  deleteReturnPhotoResponseSchema,
  returnPhotoPublicationActionResponseSchema,
  returnPhotoPublicationCheckResponseSchema,
} from '~~/shared/schemas/return-photo'
import { publicationOperationResponseSchema } from '~~/shared/schemas/publication'
import type {
  AdminReturnCharacterDto,
  AdminReturnPhotoDto,
  PublicationOperationDto,
  ReturnPhotoPublicationCheckDto,
} from '~~/shared/types/contracts'
import type { useReturnPhotoUpload } from '~/composables/useReturnPhotoUpload'
import { RETURN_UPLOAD_STATE_LABELS } from '~/composables/useReturnPhotoUpload'
import { AdminApiError } from '~/composables/useAdminApi'
import { RETURN_BLOCKER_LABELS } from '~/utils/return-labels'
import { publicationFailureLabel } from '~/utils/media-labels'
import { PUBLICATION_STATUS_LABELS } from '~/utils/work-labels'

/**
 * 一个设定的全部返图：上传、逐张 alt、指定主图、逐张发布/下架、删除。
 *
 * 这里不显示公开衍生预览：返图公开图无水印、与私有原图内容一致。
 * 也没有返图排序输入——返图墙每次随机打乱。
 */
const props = defineProps<{
  record: AdminReturnCharacterDto
  upload: ReturnType<typeof useReturnPhotoUpload>
}>()

const emit = defineEmits<{
  changed: []
  pickFile: [Event]
}>()

const adminApi = useAdminApi()
const pendingId = ref<string | null>(null)
const errorText = ref<string | null>(null)
/** alt 草稿：按返图 id 保存，保存成功后置 undefined 交回服务端值。 */
const altDrafts = reactive<Record<string, string | undefined>>({})
const checks = ref<Record<string, ReturnPhotoPublicationCheckDto | null>>({})
const operations = ref<Record<string, PublicationOperationDto | undefined>>({})
const operationFeedback = ref<Record<string, string | undefined>>({})

function altOf(photo: AdminReturnPhotoDto) {
  return altDrafts[photo.id] ?? photo.alt
}

function photoUrl(photo: AdminReturnPhotoDto, action = '') {
  return `/api/admin/v1/returns/${props.record.id}/photos/${photo.id}${action}`
}

/** 逐张读取发布检查：阻断原因要能落到具体那一张上。 */
async function loadChecks() {
  const entries = await Promise.all(props.record.photos.map(async (photo) => {
    try {
      const response = await adminApi(
        photoUrl(photo, '/publication-check'),
        { schema: returnPhotoPublicationCheckResponseSchema },
      )
      return [photo.id, response.data] as const
    }
    catch {
      return [photo.id, null] as const
    }
  }))
  checks.value = Object.fromEntries(entries)
}

watch(() => props.record.photos.map(photo => `${photo.id}:${photo.version}`).join(), () => {
  void loadChecks()
}, { immediate: true })

async function run(
  photo: AdminReturnPhotoDto,
  action: () => Promise<void>,
  failureText: string,
) {
  if (pendingId.value !== null) {
    return
  }
  pendingId.value = photo.id
  errorText.value = null
  try {
    await action()
    emit('changed')
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (error instanceof AdminApiError && error.status === 409) {
      errorText.value = error.reason === 'RETURN_PHOTO_PUBLICATION_BLOCKED'
        ? '还有未满足的发布条件，请先处理这张返图下面列出的项目。'
        : error.reason === 'ACTIVE_OPERATION_EXISTS'
          ? '上一个任务还在进行中，请稍后刷新查看结果。'
          : '这张返图已在别处修改，请刷新后重试。'
      emit('changed')
      return
    }
    errorText.value = failureText
  }
  finally {
    pendingId.value = null
  }
}

function saveAlt(photo: AdminReturnPhotoDto) {
  const alt = altOf(photo).trim()
  if (alt === photo.alt) {
    return
  }
  void run(photo, async () => {
    await adminApi(photoUrl(photo), {
      method: 'PUT',
      body: { expectedVersion: photo.version, payload: { alt } },
      schema: adminReturnPhotoResponseSchema,
    })
    // 保存成功后交回服务端值，草稿不再覆盖显示。
    altDrafts[photo.id] = undefined
  }, '图片说明保存失败，请稍后重试。')
}

function makePrimary(photo: AdminReturnPhotoDto) {
  void run(photo, async () => {
    await adminApi(photoUrl(photo, '/primary'), {
      method: 'POST',
      body: { expectedVersion: photo.version, payload: {} },
      schema: adminReturnCharacterResponseSchema,
    })
  }, '设置主图失败，请稍后重试。')
}

function publish(photo: AdminReturnPhotoDto, action: 'publish' | 'unpublish') {
  void run(photo, async () => {
    const result = await adminApi(photoUrl(photo, `/${action}`), {
      method: 'POST',
      body: { expectedVersion: photo.version, payload: {} },
      schema: returnPhotoPublicationActionResponseSchema,
    })
    const operation = result.data.operation
    operations.value = { ...operations.value, [photo.id]: operation }
    operationFeedback.value = {
      ...operationFeedback.value,
      [photo.id]: operation.status === 'DONE'
        ? action === 'unpublish'
          ? '已下架：页面已隐藏，公开文件与 ESA 缓存已撤销。'
          : '发布完成。'
        : action === 'unpublish' && operation.edgePurgeStatus === 'FAILED'
          ? `页面已隐藏，但 ESA 缓存撤销未完成：${publicationFailureLabel(operation.failureCode)}`
          : publicationFailureLabel(operation.failureCode),
    }
  }, action === 'publish' ? '发布失败，请稍后重试。' : '下架失败，请稍后重试。')
}

function retryCleanup(photo: AdminReturnPhotoDto) {
  const operation = operations.value[photo.id]
  if (!operation || operation.status !== 'FAILED') {
    return
  }
  void run(photo, async () => {
    const result = await adminApi(
      `/api/admin/v1/publication-operations/${operation.operationId}/retry-cleanup`,
      {
        method: 'POST',
        body: { expectedVersion: operation.version, payload: {} },
        schema: publicationOperationResponseSchema,
      },
    )
    operations.value = { ...operations.value, [photo.id]: result.data }
    operationFeedback.value = {
      ...operationFeedback.value,
      [photo.id]: result.data.status === 'DONE'
        ? '公开文件与 ESA 缓存撤销完成。'
        : `撤销仍未完成：${publicationFailureLabel(result.data.failureCode)}`,
    }
  }, '重试撤销失败，请稍后再试。')
}

function remove(photo: AdminReturnPhotoDto) {
  void run(photo, async () => {
    await adminApi(photoUrl(photo), {
      method: 'DELETE',
      body: { expectedVersion: photo.version, payload: {} },
      schema: deleteReturnPhotoResponseSchema,
    })
  }, '删除失败，请稍后重试。')
}

const uploadStateText = computed(
  () => RETURN_UPLOAD_STATE_LABELS[props.upload.state.value],
)

function blockersOf(photo: AdminReturnPhotoDto) {
  return checks.value[photo.id]?.blockers ?? []
}

function canPublish(photo: AdminReturnPhotoDto) {
  return checks.value[photo.id]?.canPublish === true
}
</script>

<template>
  <section class="admin-card">
    <div class="photos__head">
      <h2 class="admin-card__title">返图</h2>
      <p class="admin-card__hint">
        目前总数 {{ record.photos.length }} 张，可以横竖混放。选为主图的返图会自动定位头像。
      </p>
    </div>

    <label class="photos__picker">
      <span class="photos__picker-button">上传返图</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :disabled="upload.state.value === 'uploading'"
        @change="emit('pickFile', $event)"
      >
    </label>
    <p class="photos__upload-state" role="status">
      {{ uploadStateText }}
      <template v-if="upload.progress.value !== null">
        （{{ Math.round(upload.progress.value * 100) }}%）
      </template>
    </p>
    <p v-if="upload.failureText.value" class="photos__error" role="alert">
      {{ upload.failureText.value }}
    </p>
    <p class="admin-card__hint">
      支持 JPEG、PNG、WebP，单张不超过 30 MB，宽度至少 480 像素。
    </p>

    <p v-if="errorText" class="photos__error" role="alert">{{ errorText }}</p>

    <p v-if="record.photos.length === 0" class="photos__empty">
      还没有返图。上传第一张后即可发布到返图墙。
    </p>

    <ul v-else class="photos__list" role="list">
      <li v-for="photo in record.photos" :key="photo.id" class="photo">
        <AdminReturnThumb
          :asset-id="photo.asset?.assetId ?? null"
          :name="record.name"
          :width="160"
        />

        <div class="photo__body">
          <p class="photo__row">
            <AdminStatusBadge
              :label="PUBLICATION_STATUS_LABELS[photo.publicationStatus]"
              :tone="photo.publicationStatus === 'published' ? 'success' : photo.publicationStatus === 'unpublished' ? 'warning' : 'neutral'"
            />
            <span v-if="photo.primary" class="photo__primary">主图</span>
            <span v-if="photo.asset" class="photo__size">
              {{ photo.asset.width }} × {{ photo.asset.height }}
            </span>
          </p>

          <label class="photo__alt">
            <span class="photo__alt-label">图片说明</span>
            <input
              :value="altOf(photo)"
              type="text"
              maxlength="500"
              :disabled="pendingId === photo.id"
              @input="altDrafts[photo.id] = ($event.target as HTMLInputElement).value"
              @change="saveAlt(photo)"
            >
          </label>

          <ul v-if="blockersOf(photo).length > 0" class="photo__blockers">
            <li v-for="blocker in blockersOf(photo)" :key="blocker">
              {{ RETURN_BLOCKER_LABELS[blocker] }}
            </li>
          </ul>

          <div class="photo__actions">
            <button
              v-if="photo.publicationStatus !== 'published'"
              type="button"
              :disabled="!canPublish(photo) || pendingId === photo.id"
              @click="publish(photo, 'publish')"
            >发布</button>
            <button
              v-else
              type="button"
              :disabled="pendingId === photo.id"
              @click="publish(photo, 'unpublish')"
            >下架</button>
            <button
              v-if="!photo.primary"
              type="button"
              :disabled="!photo.asset || pendingId === photo.id"
              @click="makePrimary(photo)"
            >设为主图</button>
            <button
              type="button"
              class="photo__delete"
              :disabled="photo.publicationStatus === 'published' || pendingId === photo.id"
              @click="remove(photo)"
            >删除</button>
          </div>
          <p
            v-if="operationFeedback[photo.id]"
            class="photos__operation-feedback"
            :data-tone="operations[photo.id]?.status === 'FAILED' ? 'error' : 'success'"
            :role="operations[photo.id]?.status === 'FAILED' ? 'alert' : 'status'"
          >{{ operationFeedback[photo.id] }}</p>
          <button
            v-if="operations[photo.id]?.status === 'FAILED'
              && operations[photo.id]?.operationType === 'UNPUBLISH'"
            type="button"
            :disabled="pendingId === photo.id"
            @click="retryCleanup(photo)"
          >重试撤销</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.admin-card {
  margin-top: var(--admin-space-5);
  padding: var(--admin-space-5);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  background: var(--admin-bg-primary);
}

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

.photos__operation-feedback {
  margin-top: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.photos__operation-feedback[data-tone='error'] {
  color: var(--admin-danger);
}

.photos__picker {
  display: inline-flex;
  margin-top: var(--admin-space-4);
}

.photos__picker input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.photos__picker-button {
  display: inline-flex;
  align-items: center;
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border: 1px solid var(--admin-accent-primary);
  border-radius: var(--admin-radius-md);
  color: var(--admin-accent-primary);
  font-size: var(--admin-font-sm);
  cursor: pointer;
}

.photos__picker:focus-within .photos__picker-button {
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}

.photos__upload-state {
  margin-top: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.photos__error {
  margin-top: var(--admin-space-3);
  padding: var(--admin-space-2) var(--admin-space-3);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
}

.photos__empty {
  margin-top: var(--admin-space-4);
  padding: var(--admin-space-5);
  border: 1px dashed var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  text-align: center;
}

.photos__list {
  display: grid;
  gap: var(--admin-space-3);
  margin: var(--admin-space-5) 0 0;
  padding: 0;
  list-style: none;
}

.photo {
  display: flex;
  align-items: flex-start;
  gap: var(--admin-space-3);
  padding: var(--admin-space-3);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}

.photo__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-2);
}

.photo__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--admin-space-2);
}

.photo__primary {
  padding: 0.05rem 0.5rem;
  border: 1px solid var(--admin-accent-primary);
  border-radius: var(--admin-radius-sm);
  color: var(--admin-accent-primary);
  font-size: var(--admin-font-xs);
}

.photo__size {
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
}

.photo__alt {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-1);
}

.photo__alt-label {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
}

.photo__alt input {
  width: 100%;
  max-width: 30rem;
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
}

.photo__blockers {
  margin: 0;
  padding-left: var(--admin-space-5);
  color: var(--admin-status-warning);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.photo__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--admin-space-2);
}

.photo__actions button {
  min-height: var(--admin-touch-target);
  padding: 0 var(--admin-space-4);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
  cursor: pointer;
}

.photo__actions button:disabled {
  opacity: 0.5;
  cursor: default;
}

.photo__delete {
  border-color: var(--admin-danger) !important;
  color: var(--admin-danger) !important;
}
</style>
