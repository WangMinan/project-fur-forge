<script setup lang="ts">
import type { CompositionUsage, ImageComposition, ImageCompositions } from '~~/shared/schemas/image-composition'
import { COMPOSITION_LABELS, COMPOSITION_RATIOS, allowedCompositionUsages, compositionError, resolveComposition } from '~~/shared/utils/image-composition'

const props = defineProps<{
  assetId: string
  src: string
  role: 'studio_photo' | 'adoption_cover' | 'design_sheet'
  width: number
  height: number
  title: string
  caption?: string
  compositions?: ImageCompositions | undefined
  primary?: boolean
  disabled: boolean
}>()
const emit = defineEmits<{ update: [value: ImageCompositions] }>()
const usages = computed(() => allowedCompositionUsages(props.role).filter(usage => props.role !== 'studio_photo' || props.primary || usage === 'detail-thumbnail'))
const selected = ref<CompositionUsage | null>(null)

function apply(value: ImageComposition | null) {
  if (selected.value) emit('update', { ...props.compositions, [selected.value]: value })
}

function validate(value: ImageComposition) {
  return selected.value ? compositionError(props.role, selected.value, value, props.width, props.height) : null
}
</script>

<template>
  <div class="composition-controls">
    <AdminAction v-for="usage in usages" :key="usage" size="small" :disabled="disabled" @click="selected = usage">
      {{ COMPOSITION_LABELS[usage] }}{{ compositions?.[usage] ? ' · 已调整' : '' }}
    </AdminAction>
    <p>各用途独立；详情大图保持完整。构图保存后重新发布生效。</p>
    <AdminCompositionDialog
      v-if="selected"
      :src="src" :width="width" :height="height" :title="title"
      :label="COMPOSITION_LABELS[selected]" :ratio="COMPOSITION_RATIOS[selected]"
      :initial="resolveComposition(role, selected, width, height, compositions)"
      :allow-contain="selected !== 'detail-thumbnail'" :disabled="disabled"
      :output-width="selected === 'detail-thumbnail' ? 288 : 1200" :validate="validate"
      @apply="apply" @close="selected = null"
    >
      <span v-if="selected === 'work-catalog'" class="composition-caption">{{ caption || '作品名称 · 物种' }}</span>
    </AdminCompositionDialog>
  </div>
</template>

<style scoped>
.composition-controls { display: flex; flex-wrap: wrap; gap: var(--admin-space-2); }
.composition-controls > p { flex-basis: 100%; margin: 0; color: var(--admin-text-secondary); font-size: var(--admin-font-xs); }
.composition-caption { position: absolute; inset: auto 0 0; display: flex; align-items: end; min-height: 42%; padding: 0.75rem; color: white; background: linear-gradient(transparent, rgb(10 12 17 / 0.84)); }
</style>
