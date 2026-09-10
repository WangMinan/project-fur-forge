<script setup lang="ts">
import type Cropper from 'cropperjs'
import type { CompositionUsage, CropRect, ImageComposition, ImageCompositions } from '~~/shared/schemas/image-composition'
import { COMPOSITION_LABELS, COMPOSITION_RATIOS, allowedCompositionUsages, compositionError, defaultComposition, pixelCrop, resolveComposition } from '~~/shared/utils/image-composition'

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
const selected = ref<CompositionUsage>('detail-thumbnail')
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const canvasHost = useTemplateRef<HTMLDivElement>('canvasHost')
const opened = ref(false)
const loading = ref(false)
const error = ref('')
const mode = ref<'crop' | 'contain'>('crop')
const rect = ref<CropRect>({ x: 0, y: 0, width: 1, height: 1 })
let cropper: Cropper | null = null
let resize: ResizeObserver | null = null
let revision = 0
let restoring = false
let returnFocus: HTMLElement | null = null
const previewRect = computed(() => pixelCrop(rect.value, props.width, props.height))
const previewStyle = computed(() => mode.value === 'contain' ? {} : {
  position: 'absolute' as const,
  width: `${props.width / previewRect.value.width * 100}%`,
  height: `${props.height / previewRect.value.height * 100}%`,
  left: `${-previewRect.value.x / previewRect.value.width * 100}%`,
  top: `${-previewRect.value.y / previewRect.value.height * 100}%`,
  maxWidth: 'none',
})
const previewRatio = computed(() => COMPOSITION_RATIOS[selected.value] ?? (mode.value === 'crop' ? previewRect.value.width / previewRect.value.height : props.width / props.height))
const validity = computed(() => compositionError(props.role, selected.value, mode.value === 'contain' ? { mode: 'contain' } : { mode: 'crop', rect: rect.value }, props.width, props.height))
const lowResolution = computed(() => mode.value === 'crop' && previewRect.value.width < (selected.value === 'detail-thumbnail' ? 288 : 1200))

function imageBounds() {
  const image = cropper?.getCropperImage()?.getBoundingClientRect()
  const canvas = cropper?.getCropperCanvas()?.getBoundingClientRect()
  return image && canvas ? { x: image.left - canvas.left, y: image.top - canvas.top, width: image.width, height: image.height } : null
}

function restoreSelection() {
  const selection = cropper?.getCropperSelection()
  const bounds = imageBounds()
  if (!selection || !bounds?.width || !bounds.height) return
  restoring = true
  const ratio = COMPOSITION_RATIOS[selected.value]
  selection.aspectRatio = ratio ? ratio * (bounds.width / props.width) / (bounds.height / props.height) : NaN
  selection.$change(bounds.x + rect.value.x * bounds.width, bounds.y + rect.value.y * bounds.height,
    rect.value.width * bounds.width, rect.value.height * bounds.height, selection.aspectRatio)
  selection.hidden = mode.value === 'contain'
  restoring = false
}

function onSelection(event: Event) {
  if (restoring) return
  const bounds = imageBounds()
  const value = (event as CustomEvent<{ x: number, y: number, width: number, height: number }>).detail
  if (!bounds || !value || !Number.isFinite(value.width)) return
  const next = { x: (value.x - bounds.x) / bounds.width, y: (value.y - bounds.y) / bounds.height, width: value.width / bounds.width, height: value.height / bounds.height }
  if (next.x < -0.000001 || next.y < -0.000001 || next.width <= 0 || next.height <= 0 || next.x + next.width > 1.000001 || next.y + next.height > 1.000001) {
    event.preventDefault()
    return
  }
  next.x = Math.max(0, next.x)
  next.y = Math.max(0, next.y)
  next.width = Math.min(1 - next.x, next.width)
  next.height = Math.min(1 - next.y, next.height)
  rect.value = next
}

async function open(usage: CompositionUsage) {
  if (props.disabled) return
  returnFocus = document.activeElement as HTMLElement | null
  selected.value = usage
  const value = resolveComposition(props.role, usage, props.width, props.height, props.compositions)
  mode.value = value.mode
  rect.value = value.mode === 'crop' ? { ...value.rect } : { x: 0, y: 0, width: 1, height: 1 }
  opened.value = true
  loading.value = true
  error.value = ''
  await nextTick()
  dialog.value?.showModal()
  const current = ++revision
  try {
    const { default: CropperConstructor } = await import('cropperjs')
    if (current !== revision || !canvasHost.value) return
    const image = new Image()
    image.src = props.src
    image.alt = props.title || '完整图片构图'
    cropper = new CropperConstructor(image, {
      container: canvasHost.value,
      template: `<cropper-canvas background><cropper-image></cropper-image><cropper-shade></cropper-shade><cropper-selection movable resizable zoomable precise><cropper-grid covered></cropper-grid><cropper-crosshair centered></cropper-crosshair><cropper-handle action="move" plain></cropper-handle><cropper-handle action="n-resize"></cropper-handle><cropper-handle action="e-resize"></cropper-handle><cropper-handle action="s-resize"></cropper-handle><cropper-handle action="w-resize"></cropper-handle><cropper-handle action="ne-resize"></cropper-handle><cropper-handle action="nw-resize"></cropper-handle><cropper-handle action="se-resize"></cropper-handle><cropper-handle action="sw-resize"></cropper-handle></cropper-selection></cropper-canvas>`,
    })
    await cropper.getCropperImage()?.$ready()
    if (current !== revision) return
    cropper.getCropperSelection()?.addEventListener('change', onSelection)
    const layout = () => {
      cropper?.getCropperImage()?.$center('contain')
      restoreSelection()
    }
    layout()
    resize = new ResizeObserver(layout)
    resize.observe(canvasHost.value)
  }
  catch {
    if (current === revision) error.value = '编辑预览加载失败，请关闭后重试。'
  }
  finally {
    if (current === revision) loading.value = false
  }
}

function close() {
  revision++
  resize?.disconnect()
  resize = null
  cropper?.destroy()
  cropper = null
  dialog.value?.close()
  opened.value = false
  returnFocus?.focus()
}

function moveSelection(x: number, y: number) { cropper?.getCropperSelection()?.$move(x, y) }
function zoomSelection(value: number) { cropper?.getCropperSelection()?.$zoom(value) }

function setMode(value: 'crop' | 'contain') {
  mode.value = value
  if (value === 'crop') {
    const initial = defaultComposition('studio_photo', selected.value, props.width, props.height)
    rect.value = initial.mode === 'crop' ? initial.rect : { x: 0, y: 0, width: 1, height: 1 }
  }
  restoreSelection()
}

function apply(value?: ImageComposition | null) {
  if (props.disabled) return close()
  const result = value === undefined ? mode.value === 'contain' ? { mode: 'contain' as const } : { mode: 'crop' as const, rect: { ...rect.value } } : value
  emit('update', { ...props.compositions, [selected.value]: result })
  close()
}

onBeforeUnmount(close)
</script>

<template>
  <div class="composition-controls">
    <AdminAction v-for="usage in usages" :key="usage" size="small" :disabled="disabled" @click="open(usage)">
      {{ COMPOSITION_LABELS[usage] }}{{ compositions?.[usage] ? ' · 已调整' : '' }}
    </AdminAction>
    <p>各用途独立；详情大图保持完整。构图保存后重新发布生效。</p>
    <dialog v-if="opened" ref="dialog" class="composition-dialog" :aria-labelledby="`crop-title-${assetId}`" @cancel.prevent="close">
      <h3 :id="`crop-title-${assetId}`">{{ COMPOSITION_LABELS[selected] }}构图</h3>
      <div v-if="selected !== 'detail-thumbnail'" class="composition-actions" role="group" aria-label="显示方式">
        <AdminAction :aria-pressed="mode === 'crop'" @click="setMode('crop')">手动裁切</AdminAction>
        <AdminAction :aria-pressed="mode === 'contain'" @click="setMode('contain')">完整显示</AdminAction>
      </div>
      <p v-if="loading" role="status">正在加载编辑预览…</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <div class="composition-layout">
        <div ref="canvasHost" class="composition-canvas" :class="{ 'composition-canvas--contain': mode === 'contain' }" />
        <div>
          <p>展示预览</p>
          <div class="composition-preview" :style="{ aspectRatio: String(previewRatio), width: `min(100%, calc(24rem * ${previewRatio}))` }">
            <img :src="src" :alt="title || '构图预览'" :style="previewStyle">
            <span v-if="selected === 'work-catalog'" class="composition-caption">{{ caption || '作品名称 · 物种' }}</span>
          </div>
          <p v-if="mode === 'crop'">选区 {{ previewRect.width }} × {{ previewRect.height }} 像素</p>
          <p v-if="lowResolution" role="status">选区较小，发布时可能需要放大；放大不会恢复细节。</p>
          <p v-if="validity" role="alert">{{ validity }}</p>
        </div>
      </div>
      <div v-if="mode === 'crop'" class="composition-actions" role="group" aria-label="调整选区">
        <AdminAction :disabled="loading" aria-label="选区向左" @click="moveSelection(-4, 0)">←</AdminAction>
        <AdminAction :disabled="loading" aria-label="选区向右" @click="moveSelection(4, 0)">→</AdminAction>
        <AdminAction :disabled="loading" aria-label="选区向上" @click="moveSelection(0, -4)">↑</AdminAction>
        <AdminAction :disabled="loading" aria-label="选区向下" @click="moveSelection(0, 4)">↓</AdminAction>
        <AdminAction :disabled="loading" @click="zoomSelection(-0.1)">缩小选区</AdminAction>
        <AdminAction :disabled="loading" @click="zoomSelection(0.1)">扩大选区</AdminAction>
      </div>
      <div class="composition-actions">
        <AdminAction variant="primary" :disabled="loading || Boolean(error) || Boolean(validity)" @click="apply()">应用构图</AdminAction>
        <AdminAction @click="apply(null)">重置当前用途</AdminAction>
        <AdminAction @click="close">取消</AdminAction>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.composition-controls, .composition-actions { display: flex; flex-wrap: wrap; gap: var(--admin-space-2); }
.composition-controls > p { flex-basis: 100%; margin: 0; color: var(--admin-text-secondary); font-size: var(--admin-font-xs); }
.composition-dialog { width: min(60rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); overflow: auto; padding: var(--admin-space-4); color: var(--admin-text-primary); background: var(--admin-bg-primary); border: 1px solid var(--admin-border-primary); border-radius: var(--admin-radius-md); }
.composition-dialog::backdrop { background: rgb(0 0 0 / 0.5); }
.composition-dialog h3 { margin: 0 0 var(--admin-space-3); }
.composition-layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--admin-space-4); margin-block: var(--admin-space-3); }
.composition-canvas { min-width: 0; height: clamp(16rem, 48dvh, 28rem); }
.composition-canvas :deep(cropper-canvas) { height: 100%; }
.composition-canvas--contain { pointer-events: none; }
.composition-preview { position: relative; width: 100%; max-height: 24rem; overflow: hidden; background: var(--admin-bg-subtle); }
.composition-preview > img { width: 100%; height: 100%; object-fit: contain; }
.composition-caption { position: absolute; inset: auto 0 0; display: flex; align-items: end; min-height: 42%; padding: 0.75rem; color: white; background: linear-gradient(transparent, rgb(10 12 17 / 0.84)); }
.composition-actions { margin-top: var(--admin-space-3); }
.composition-actions :deep(button) { min-width: 44px; min-height: 44px; }
@media (max-width: 767px) { .composition-layout { grid-template-columns: minmax(0, 1fr); } .composition-preview { width: min(100%, 12rem); } }
</style>
