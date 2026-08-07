<script setup lang="ts">
import type {
  AdminReturnPhotoDto,
  PublicationFailureStage,
  PublicationOperationDto,
  ReturnPhotoBlocker,
  ReturnPhotoPublicationCheckDto,
} from '~~/shared/types/contracts'

/**
 * 分区 5–7：私有原图与无水印公开预览、发布检查/发布/下架/失败恢复、
 * 危险操作边界。
 *
 * 这里不出现活动水印 profile、Logo、位置、不透明度、缩放或
 * “关闭水印”开关：返图公开图永远无水印。
 * 也不出现“移到回收站”或“30 天内可恢复”。
 */
const props = defineProps<{
  blockerLabels: Record<ReturnPhotoBlocker, string>
  blockers: ReturnPhotoBlocker[]
  canPublish: boolean
  check: ReturnPhotoPublicationCheckDto | null
  confirmDelete: boolean
  deleting: boolean
  isPublished: boolean
  operation: PublicationOperationDto | null
  operationStageLabels: Record<PublicationFailureStage, string>
  operationStatusLabels: Record<string, string>
  privatePreviewSrc: string | null
  publicReady: boolean
  publishing: boolean
  record: AdminReturnPhotoDto
}>()

const emit = defineEmits<{
  cancelDelete: []
  confirmDelete: []
  publish: []
  requestDelete: []
  unpublish: []
}>()

const privateFailed = ref(false)
const publicFailed = ref(false)

/**
 * 无水印公开预览地址由服务端在管理 DTO 里给出。
 *
 * 不在这里调用 `/api/public/**`：管理 Host 会按 Host 边界拒绝公开接口，
 * 跨 Host 取预览既拿不到数据也没有必要。
 */
const publicPreview = computed(() => props.record.publicPreview)

watch(
  () => props.record.publicPreview?.src,
  () => {
    publicFailed.value = false
  },
)

const operationText = computed(() => {
  const current = props.operation
  if (!current) {
    return null
  }
  const status = props.operationStatusLabels[current.status] ?? current.status
  if (current.status === 'FAILED' && current.failureStage) {
    return `${status}：在「${props.operationStageLabels[current.failureStage]}」这一步停下了`
  }
  return status
})
</script>

<template>
  <!-- 5 私有原图与无水印公开预览 -->
  <section class="admin-card">
    <h2 class="admin-card__title">图片预览</h2>
    <p class="admin-card__hint">
      左边是只有后台能看到的私有原图，右边是访客在返图墙上实际看到的公开图片。
      返图的公开图片<strong>不加水印</strong>，也不受品牌水印设置影响。
    </p>

    <div class="return-previews">
      <figure class="return-preview">
        <figcaption class="return-preview__label">
          私有原图（仅后台可见）
        </figcaption>
        <div class="return-preview__frame">
          <img
            v-if="privatePreviewSrc && !privateFailed"
            :src="privatePreviewSrc"
            :alt="`${record.work.characterName}的返图私有原图预览`"
            loading="lazy"
            decoding="async"
            @error="privateFailed = true"
          >
          <p v-else class="return-preview__empty">
            {{ privatePreviewSrc ? '预览加载失败' : '还没有上传图片' }}
          </p>
        </div>
      </figure>

      <figure class="return-preview">
        <figcaption class="return-preview__label">
          公开图片（无水印）
        </figcaption>
        <div class="return-preview__frame">
          <img
            v-if="publicPreview && !publicFailed"
            :src="publicPreview.src"
            :alt="`${record.work.characterName}的返图公开图片预览`"
            :width="publicPreview.width"
            :height="publicPreview.height"
            loading="lazy"
            decoding="async"
            @error="publicFailed = true"
          >
          <p v-else class="return-preview__empty">
            <template v-if="publicFailed">
              公开图片加载失败，可稍后刷新或重新发布。
            </template>
            <template v-else-if="!record.publicPreview">
              发布之后会生成公开图片，这里将显示访客看到的真实结果。
            </template>
            <template v-else>公开图片暂时无法显示，可尝试重新发布。</template>
          </p>
        </div>
      </figure>
    </div>
  </section>

  <!-- 6 发布检查、发布、下架与恢复 -->
  <section class="admin-card">
    <h2 class="admin-card__title">发布</h2>

    <p class="return-publish__summary">
      当前公开图片：{{ publicReady ? '已生成完整' : '尚未生成完整' }}
      <template v-if="check">
        （已生成 {{ check.requiredVariantCount - check.missingVariantCount }} /
        {{ check.requiredVariantCount }}）
      </template>
    </p>

    <template v-if="blockers.length > 0">
      <p class="return-publish__blocked">还需要处理：</p>
      <ul class="return-publish__blockers">
        <li v-for="blocker in blockers" :key="blocker">
          {{ blockerLabels[blocker] }}
        </li>
      </ul>
    </template>
    <p v-else-if="!isPublished" class="return-publish__ok">
      发布条件已满足，可以发布到返图墙。
    </p>

    <p v-if="operationText" class="return-publish__operation" role="status">
      任务状态：{{ operationText }}
      <template v-if="operation && operation.cleanupPendingCount > 0">
        ，还有 {{ operation.cleanupPendingCount }} 个公开图片待清理
      </template>
      。刷新页面后这里仍会显示最新结果。
    </p>

    <div class="return-publish__actions">
      <button
        v-if="!isPublished"
        type="button"
        :disabled="!canPublish || publishing"
        @click="emit('publish')"
      >
        {{ publishing ? '发布中…' : '发布到返图墙' }}
      </button>
      <button
        v-else
        type="button"
        class="return-publish__unpublish"
        :disabled="publishing"
        @click="emit('unpublish')"
      >
        {{ publishing ? '下架中…' : '从返图墙下架' }}
      </button>
    </div>

    <p v-if="record.work.publicationStatus !== 'published' && isPublished" class="return-publish__note">
      关联作品当前不是已发布状态，因此这张返图暂时不会出现在返图墙上。
      返图记录和原图都保留着，作品重新发布后会自动恢复显示。
    </p>
  </section>

  <!-- 7 危险操作边界 -->
  <section class="admin-card admin-card--danger">
    <h2 class="admin-card__title">危险操作</h2>
    <p class="admin-card__hint">
      删除会永久移除这条返图记录，<strong>不可恢复</strong>，也没有回收站。
      已发布的返图必须先下架。私有原图会保留在存储里，不随记录删除。
    </p>

    <template v-if="!confirmDelete">
      <button
        type="button"
        class="return-danger__button"
        :disabled="isPublished"
        @click="emit('requestDelete')"
      >
        删除这条返图
      </button>
      <p v-if="isPublished" class="admin-field__help">
        请先从返图墙下架，再删除。
      </p>
    </template>
    <div v-else class="return-danger__confirm">
      <p>
        确认永久删除这条返图记录吗？此操作不可恢复，且不会进入回收站。
      </p>
      <div class="return-danger__confirm-actions">
        <button
          type="button"
          class="return-danger__button"
          :disabled="deleting"
          @click="emit('confirmDelete')"
        >
          {{ deleting ? '删除中…' : '确认永久删除' }}
        </button>
        <button type="button" :disabled="deleting" @click="emit('cancelDelete')">
          取消
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-card {
  padding: var(--admin-space-5);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  background: var(--admin-bg-primary);
}

.admin-card--danger {
  border-color: var(--admin-status-error-soft);
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

.admin-field__help {
  margin-top: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
}

.return-previews {
  display: grid;
  gap: var(--admin-return-preview-gap);
  margin-top: var(--admin-space-4);
}

@media (min-width: 768px) {
  .return-previews {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.return-preview {
  margin: 0;
}

.return-preview__label {
  margin-bottom: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
  font-weight: 600;
}

.return-preview__frame {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: var(--admin-return-preview-max);
  /* 高度上限固定：竖图和极端长图不会把整页拉得很长。 */
  height: 22rem;
  padding: var(--admin-space-3);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-return-preview-bg);
}

.return-preview__frame img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  /* 保持原比例：返图有大量竖图与极端长图。 */
  object-fit: contain;
}

.return-preview__empty {
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
  text-align: center;
}

.return-publish__summary {
  margin-top: var(--admin-space-4);
  font-size: var(--admin-font-sm);
}

.return-publish__blocked {
  margin-top: var(--admin-space-4);
  color: var(--admin-status-warning);
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.return-publish__blockers {
  margin: var(--admin-space-2) 0 0;
  padding-left: var(--admin-space-5);
  color: var(--admin-text-primary);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.return-publish__ok {
  margin-top: var(--admin-space-3);
  color: var(--admin-status-success);
  font-size: var(--admin-font-sm);
}

.return-publish__operation {
  margin-top: var(--admin-space-3);
  padding: var(--admin-space-3);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-info-soft);
  color: var(--admin-status-info);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.return-publish__note {
  margin-top: var(--admin-space-3);
  padding: var(--admin-space-3);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-warning-soft);
  color: var(--admin-status-warning);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.return-publish__actions {
  display: flex;
  gap: var(--admin-space-3);
  margin-top: var(--admin-space-4);
}

.return-publish__actions button {
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

.return-publish__actions button:disabled {
  opacity: 0.55;
  cursor: default;
}

.return-publish__unpublish {
  background: var(--admin-bg-primary) !important;
  border: 1px solid var(--admin-border-primary) !important;
  color: var(--admin-text-primary) !important;
}

.return-danger__button {
  min-height: var(--admin-control-height);
  margin-top: var(--admin-space-4);
  padding: 0 var(--admin-space-5);
  border: 1px solid var(--admin-danger);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-danger);
  font: inherit;
  font-size: var(--admin-font-sm);
  cursor: pointer;
}

.return-danger__button:disabled {
  opacity: 0.5;
  cursor: default;
}

.return-danger__confirm {
  margin-top: var(--admin-space-4);
  padding: var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.return-danger__confirm-actions {
  display: flex;
  gap: var(--admin-space-3);
  margin-top: var(--admin-space-3);
}

.return-danger__confirm-actions button:last-child {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-4);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
  cursor: pointer;
}
</style>
