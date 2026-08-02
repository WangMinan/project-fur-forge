<script setup lang="ts">
import type {
  AdminHeroAssetDto,
  VerifiedAssetDto,
} from '~~/shared/types/contracts'
import type { HeroSlot } from '~/composables/useHeroAssetUpload'

// T20 首页横/竖槽位：固定比例预览框 + 文件选择上传（选中即传）。
// 已保存资产只展示尺寸信息（私有原图不下发 URL）；新上传用本地 objectURL 预览。
const props = defineProps<{
  disabled: boolean
  homeVersion: number | null
  savedAsset: AdminHeroAssetDto | null
  orientation: HeroSlot
  unsavedAssetId: string | null
}>()

const emit = defineEmits<{
  conflict: []
  uploaded: [asset: VerifiedAssetDto]
}>()

const SLOT_LABEL: Record<HeroSlot, string> = {
  landscape: '横版（16:9）',
  portrait: '竖版（9:16）',
}

const fileInput = ref<HTMLInputElement | null>(null)

const upload = useHeroAssetUpload({
  slot: props.orientation,
  getHomeVersion: () => props.homeVersion,
  onAssetReady: (_slot, asset) => emit('uploaded', asset),
  onConflict: () => emit('conflict'),
})

const busy = computed(() =>
  upload.item.state === 'digesting'
  || upload.item.state === 'uploading'
  || upload.item.state === 'validating',
)

const stateText = computed(() => {
  switch (upload.item.state) {
    case 'digesting': return '正在预检查文件…'
    case 'uploading': return '正在上传…'
    case 'validating': return '正在核验…'
    default: return null
  }
})

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) {
    void upload.startUpload(file)
  }
}
</script>

<template>
  <div class="hero-slot" :data-orientation="orientation" :data-state="upload.item.state">
    <p class="hero-slot__label">
      {{ SLOT_LABEL[orientation] }}
    </p>

    <div
      class="hero-slot__preview"
      :class="`hero-slot__preview--${orientation}`"
      :data-testid="`hero-slot-preview-${orientation}`"
    >
      <img
        v-if="upload.item.previewUrl"
        :src="upload.item.previewUrl"
        :alt="`${SLOT_LABEL[orientation]}本地预览`"
        class="hero-slot__image"
        referrerpolicy="no-referrer"
      >
      <p v-else-if="savedAsset" class="hero-slot__saved">
        已保存原图 {{ savedAsset.width }}×{{ savedAsset.height }}<br>
        <span class="hero-slot__saved-note">私有库存储，不在此直接展示</span>
      </p>
      <p v-else class="hero-slot__empty">
        未上传
      </p>
    </div>

    <p v-if="unsavedAssetId && upload.item.state === 'completed'" class="hero-slot__unsaved" role="status">
      新图已上传（{{ upload.item.asset?.width }}×{{ upload.item.asset?.height }}），保存轮播项后生效
    </p>

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      :aria-label="`选择${SLOT_LABEL[orientation]}首页图文件`"
      @change="onFileChange"
    >

    <div class="hero-slot__actions">
      <button
        type="button"
        class="hero-slot__button"
        :disabled="disabled || busy || homeVersion === null"
        @click="pickFile"
      >{{ busy ? '上传中…' : (savedAsset || unsavedAssetId ? '重新上传' : '上传图片') }}</button>
      <span v-if="stateText" class="hero-slot__state" role="status">{{ stateText }}</span>
    </div>

    <progress
      v-if="upload.item.state === 'uploading' && upload.item.progress !== null"
      class="hero-slot__progress"
      :value="upload.item.progress"
      :max="1"
      :aria-label="`${SLOT_LABEL[orientation]}上传进度`"
    />

    <p v-if="upload.item.failureText" class="hero-slot__failure" role="alert">
      {{ upload.item.failureText }}
    </p>
  </div>
</template>

<style scoped>
.hero-slot {
  display: grid;
  gap: var(--admin-space-2);
  align-content: start;
}

.hero-slot__label {
  margin: 0;
  font-size: var(--admin-font-xs);
  font-weight: 600;
  color: var(--admin-text-secondary);
}

.hero-slot__preview {
  width: 100%;
  border-radius: var(--admin-radius-sm);
  overflow: hidden;
  background: var(--admin-bg-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-slot__preview--landscape {
  aspect-ratio: 16 / 9;
}

.hero-slot__preview--portrait {
  aspect-ratio: 9 / 16;
  max-width: 10rem;
}

.hero-slot__image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.hero-slot__saved,
.hero-slot__empty {
  margin: 0;
  padding: var(--admin-space-3);
  text-align: center;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
  line-height: var(--admin-line-normal);
}

.hero-slot__saved-note {
  color: var(--admin-text-tertiary);
}

.hero-slot__unsaved {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-success);
}

.hero-slot__actions {
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  flex-wrap: wrap;
}

.hero-slot__button {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font-size: var(--admin-font-xs);
  font-family: inherit;
  cursor: pointer;
}

.hero-slot__button:hover:not(:disabled) {
  background: var(--admin-bg-subtle);
}

.hero-slot__button:disabled {
  opacity: 0.55;
  cursor: default;
}

.hero-slot__state {
  font-size: var(--admin-font-xs);
  color: var(--admin-text-secondary);
}

.hero-slot__progress {
  width: 100%;
  height: 0.375rem;
  accent-color: var(--admin-accent-primary);
}

.hero-slot__failure {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-error);
}
</style>
