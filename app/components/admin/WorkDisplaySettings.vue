<script setup lang="ts">
import type { ManagedWorkDto } from '~~/shared/types/contracts'
import type { WorkDisplaySettings } from '~~/shared/schemas/image-composition'
import { managedWorkResponseSchema } from '~~/shared/schemas/work'
import { adminMediaPreviewUrl } from '~/utils/admin-media-preview'
import { workApiErrorText } from '~/utils/work-errors'

const props = defineProps<{ work: ManagedWorkDto, disabled: boolean }>()
const emit = defineEmits<{ saved: [work: ManagedWorkDto], stateChange: [state: { busy: boolean, dirty: boolean }] }>()
const api = useAdminApi()
const values = ref<WorkDisplaySettings>({ showAdoptionCoverInDetail: true, showDesignSheetInDetail: true, adoptionCoverSource: 'auto' })
const baseline = ref('')
const saving = ref(false)
const error = ref('')
const notice = ref('')
const dirty = computed(() => JSON.stringify(values.value) !== baseline.value)
function reset() {
  values.value = { showAdoptionCoverInDetail: props.work.showAdoptionCoverInDetail, showDesignSheetInDetail: props.work.showDesignSheetInDetail, adoptionCoverSource: props.work.adoptionCoverSource }
  baseline.value = JSON.stringify(values.value)
}
reset()
watch(() => props.work, () => { if (!dirty.value) reset() })
watch([saving, dirty], ([busy, changed]) => emit('stateChange', { busy, dirty: changed }), { immediate: true })
const preview = computed(() => {
  if (props.work.purpose !== 'adoption') return null
  return values.value.adoptionCoverSource === 'adoption_cover' ? props.work.adoptionCover
    : values.value.adoptionCoverSource === 'design_sheet' ? props.work.designSheet
      : props.work.designSheet ?? props.work.adoptionCover
})
async function save() {
  if (saving.value || props.disabled) return false
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await api(`/api/admin/v1/works/${props.work.id}/presentation`, {
      method: 'PUT', body: { expectedVersion: props.work.version, payload: values.value }, schema: managedWorkResponseSchema,
    })
    baseline.value = JSON.stringify(values.value)
    emit('saved', result.data)
    notice.value = '详情展示设置已更新。'
    return true
  }
  catch (cause) { error.value = workApiErrorText(cause, '展示设置保存失败，请重试。'); return false }
  finally { saving.value = false }
}
defineExpose({ save })
</script>

<template>
  <section class="editor-card display-settings" aria-labelledby="display-settings-title">
    <h2 id="display-settings-title" class="editor-card__title">领养图片展示</h2>
    <label for="adoption-cover-source">领养封面来源</label>
    <select id="adoption-cover-source" v-model="values.adoptionCoverSource" :disabled="disabled || saving">
      <option value="auto">自动选择（优先设定图）</option>
      <option value="adoption_cover">使用横版封面</option>
      <option value="design_sheet">使用设定图</option>
    </select>
    <p>共同控制领养目录与首页当前领养；各位置构图可在对应图片区域独立调整。</p>
    <figure v-if="preview">
      <img :src="adminMediaPreviewUrl(preview.assetId, 320)" :alt="preview.alt || '所选封面来源预览'" width="160" height="120">
      <figcaption>所选来源预览 · {{ preview.alt || '尚未填写图片说明' }}</figcaption>
    </figure>
    <p v-else role="status">所选来源尚无可用图片。</p>
    <label class="display-settings__check"><input v-model="values.showAdoptionCoverInDetail" type="checkbox" :disabled="disabled || saving">在详情图集中显示领养横版封面</label>
    <label class="display-settings__check"><input v-model="values.showDesignSheetInDetail" type="checkbox" :disabled="disabled || saving">在详情图集中显示设定图</label>
    <p>仅控制详情图集，不影响列表封面。详情至少保留一张可展示图片；缺少出厂照时，请保留封面或设定图。</p>
    <div v-if="dirty" class="display-settings__actions">
      <AdminAction variant="primary" :loading="saving" :disabled="disabled || saving" @click="save">保存展示设置</AdminAction>
      <AdminAction :disabled="saving" @click="reset">放弃更改</AdminAction>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
  </section>
</template>

<style scoped>
.display-settings { display: grid; gap: var(--admin-space-3); }
.display-settings p, .display-settings figure { margin: 0; }
.display-settings p, .display-settings figcaption { color: var(--admin-text-secondary); font-size: var(--admin-font-sm); }
.display-settings img { object-fit: contain; background: var(--admin-bg-subtle); }
.display-settings select { width: 100%; min-height: 44px; font: inherit; color: var(--admin-text-primary); background: var(--admin-bg-primary); border: 1px solid var(--admin-border-primary); padding: var(--admin-space-2); }
.display-settings__check { display: flex; align-items: center; gap: var(--admin-space-2); min-height: 44px; }
.display-settings__actions { display: flex; flex-wrap: wrap; gap: var(--admin-space-2); }
</style>
