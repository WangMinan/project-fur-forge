<script setup lang="ts">
import type {
  AdminReturnPhotoDto,
  PublicationFailureStage,
  PublicationOperationDto,
  ReturnPhotoBlocker,
  ReturnPhotoConsentSource,
  ReturnPhotoPublicationCheckDto,
  WorkListItemDto,
} from '~~/shared/types/contracts'
import type { useReturnPhotoUpload } from '~/composables/useReturnPhotoUpload'
import { RETURN_UPLOAD_STATE_LABELS } from '~/composables/useReturnPhotoUpload'
import { RETURN_OPERATION_STATUS_LABELS } from '~/utils/return-labels'
import { PUBLICATION_STATUS_LABELS } from '~/utils/work-labels'

/**
 * 返图编辑分区。顺序固定：关联作品 → 返图图片 → alt 与排序 →
 * 授权记录（仅后台可见）→ 私有/公开预览 → 发布与恢复 → 危险操作。
 */
/** 表单草稿由父组件持有（409 时要保留），这里用 model 双向绑定。 */
export interface ReturnEditorForm {
  alt: string
  consentConfirmedAt: string
  consentNote: string
  consentSource: '' | 'qq' | 'email' | 'other'
  sortOrder: number
  workId: string
}

const form = defineModel<ReturnEditorForm>('form', { required: true })

const props = defineProps<{
  blockerLabels: Record<ReturnPhotoBlocker, string>
  check: ReturnPhotoPublicationCheckDto | null
  confirmDelete: boolean
  conflict: AdminReturnPhotoDto | null
  consentSourceLabels: Record<ReturnPhotoConsentSource, string>
  deleting: boolean
  operation: PublicationOperationDto | null
  operationStageLabels: Record<PublicationFailureStage, string>
  privatePreviewSrc: string | null
  publishing: boolean
  record: AdminReturnPhotoDto
  saving: boolean
  upload: ReturnType<typeof useReturnPhotoUpload>
  works: WorkListItemDto[]
}>()

const emit = defineEmits<{
  cancelDelete: []
  confirmDelete: []
  pickFile: [Event]
  publish: []
  requestDelete: []
  save: []
  unpublish: []
}>()

const isPublished = computed(
  () => props.record.publicationStatus === 'published',
)

/**
 * 上传状态文字。
 *
 * 刷新页面后上传状态机回到 idle，但记录里已经有图片，
 * 这时必须按服务端事实显示“已就绪”，不能说“尚未选择图片”。
 */
const uploadStateText = computed(() => {
  if (props.upload.state.value === 'idle' && props.record.asset) {
    return props.record.asset.status === 'READY'
      ? '私有原图已就绪'
      : '私有原图处理未完成'
  }
  return RETURN_UPLOAD_STATE_LABELS[props.upload.state.value]
})

const blockers = computed(() => props.check?.blockers ?? [])
const canPublish = computed(() => props.check?.canPublish === true)

/** 公开变体是否完整；决定无水印公开预览能否显示真实结果。 */
const publicReady = computed(() => (
  props.record.publicVariantCount > 0
  && props.check !== null
  && props.check.missingVariantCount === 0
))
</script>

<template>
  <div class="return-cards">
    <!-- 1 关联作品 -->
    <section class="admin-card">
      <h2 class="admin-card__title">关联作品</h2>
      <p class="admin-card__hint">
        返图必须属于一件已有作品。公开返图墙上，这张图片会链接到该作品详情。
      </p>
      <label class="admin-field">
        <span class="admin-field__label">作品</span>
        <select
          v-model="form.workId"
          :disabled="isPublished"
          class="admin-field__control"
        >
          <option v-for="work in works" :key="work.id" :value="work.id">
            {{ work.characterName }}
          </option>
        </select>
        <span class="admin-field__help">
          当前作品状态：{{ PUBLICATION_STATUS_LABELS[record.work.publicationStatus] }}。
          <template v-if="isPublished">
            这条返图已发布，更换关联作品前请先下架。
          </template>
        </span>
      </label>
    </section>

    <!-- 2 返图图片 -->
    <section class="admin-card">
      <h2 class="admin-card__title">返图图片</h2>
      <p class="admin-card__hint">
        一条记录只放一张返图。这里上传的是访客拍摄的真实使用照片，
        不是工作室出厂照。
      </p>

      <p class="return-upload__state" role="status">
        {{ uploadStateText }}
        <template v-if="upload.progress.value !== null">
          （{{ Math.round(upload.progress.value * 100) }}%）
        </template>
      </p>
      <p
        v-if="upload.failureText.value"
        class="return-upload__error"
        role="alert"
      >
        {{ upload.failureText.value }}
      </p>

      <label class="return-upload__picker">
        <span class="return-upload__button">
          {{ record.asset ? '更换返图图片' : '选择返图图片' }}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          :disabled="isPublished || upload.state.value === 'uploading'"
          @change="emit('pickFile', $event)"
        >
      </label>
      <p class="admin-field__help">
        支持 JPEG、PNG、WebP，单张不超过 30 MB，宽度至少 480 像素。
        <template v-if="isPublished">已发布返图需要先下架才能更换图片。</template>
      </p>

      <dl v-if="record.asset" class="return-facts">
        <div>
          <dt>图片尺寸</dt>
          <dd>{{ record.asset.width }} × {{ record.asset.height }}</dd>
        </div>
        <div>
          <dt>私有原图状态</dt>
          <dd>{{ record.asset.status === 'READY' ? '已就绪' : '处理中或失败' }}</dd>
        </div>
      </dl>
    </section>

    <!-- 3 alt 与排序 -->
    <section class="admin-card">
      <h2 class="admin-card__title">说明与排序</h2>
      <label class="admin-field">
        <span class="admin-field__label">图片说明（alt）</span>
        <input
          v-model="form.alt"
          type="text"
          maxlength="500"
          class="admin-field__control"
        >
        <span class="admin-field__help">
          描述画面内容，供读屏和图片无法显示时使用。不要写联系方式或网址。
        </span>
      </label>
      <label class="admin-field">
        <span class="admin-field__label">排序</span>
        <input
          v-model.number="form.sortOrder"
          type="number"
          min="0"
          step="1"
          class="admin-field__control admin-field__control--short"
        >
        <span class="admin-field__help">
          数字小的排在返图墙前面；相同数字时按稳定顺序排列。
        </span>
      </label>
    </section>

    <!-- 4 授权记录（可选，仅后台可见） -->
    <section class="admin-card admin-card--consent">
      <h2 class="admin-card__title">授权记录（可选，仅后台可见）</h2>
      <p class="admin-card__hint">
        这三项都可以留空，留空不影响保存和发布。它们只保存在后台，
        不会出现在公开页面、图片信息或分享内容里。
      </p>
      <label class="admin-field">
        <span class="admin-field__label">授权来源</span>
        <select
          v-model="form.consentSource"
          class="admin-field__control admin-field__control--short"
        >
          <option value="">未记录</option>
          <option
            v-for="(label, value) in consentSourceLabels"
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
        <span class="admin-field__help">
          仅供自己回忆当时怎么确认的，不对外展示。
        </span>
      </label>
    </section>

    <div class="return-cards__save">
      <button type="button" :disabled="saving" @click="emit('save')">
        {{ saving ? '保存中…' : '保存修改' }}
      </button>
      <p v-if="conflict" class="return-cards__conflict" role="status">
        服务端最新内容：说明「{{ conflict.alt }}」，排序 {{ conflict.sortOrder }}，
        状态{{ PUBLICATION_STATUS_LABELS[conflict.publicationStatus] }}。
        你当前填写的内容仍然保留，可以自行比较后再保存。
      </p>
    </div>

    <AdminReturnPublishCard
      :record="record"
      :check="check"
      :operation="operation"
      :blocker-labels="blockerLabels"
      :operation-stage-labels="operationStageLabels"
      :operation-status-labels="RETURN_OPERATION_STATUS_LABELS"
      :private-preview-src="privatePreviewSrc"
      :public-ready="publicReady"
      :publishing="publishing"
      :can-publish="canPublish"
      :blockers="blockers"
      :is-published="isPublished"
      :deleting="deleting"
      :confirm-delete="confirmDelete"
      @publish="emit('publish')"
      @unpublish="emit('unpublish')"
      @request-delete="emit('requestDelete')"
      @cancel-delete="emit('cancelDelete')"
      @confirm-delete="emit('confirmDelete')"
    />
  </div>
</template>

<style scoped>
.return-cards {
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

.admin-card--consent {
  background: var(--admin-consent-card-bg);
  border-color: var(--admin-consent-card-border);
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
  max-width: var(--admin-event-field-max);
}

.admin-field__help {
  color: var(--admin-consent-hint-color);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.return-upload__state {
  margin-top: var(--admin-space-4);
  color: var(--admin-text-primary);
  font-size: var(--admin-font-sm);
}

.return-upload__error {
  margin-top: var(--admin-space-2);
  padding: var(--admin-space-2) var(--admin-space-3);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
}

.return-upload__picker {
  display: inline-flex;
  margin-top: var(--admin-space-3);
}

.return-upload__picker input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.return-upload__button {
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

.return-upload__picker:focus-within .return-upload__button {
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}

.return-facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--admin-space-5);
  margin-top: var(--admin-space-4);
  font-size: var(--admin-font-sm);
}

.return-facts dt {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
}

.return-facts dd {
  margin-top: var(--admin-space-1);
}

.return-cards__save {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--admin-space-3);
}

.return-cards__save button {
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

.return-cards__save button:disabled {
  opacity: 0.55;
  cursor: default;
}

.return-cards__conflict {
  flex: 1 1 20rem;
  padding: var(--admin-space-3);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-warning-soft);
  color: var(--admin-status-warning);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}
</style>
