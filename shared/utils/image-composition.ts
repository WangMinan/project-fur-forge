import type { CompositionUsage, CropRect, ImageComposition, ImageCompositions } from '../schemas/image-composition'

export const COMPOSITION_LABELS: Record<CompositionUsage, string> = {
  'detail-thumbnail': '详情缩略图',
  'work-catalog': '作品目录',
  'home-featured': '首页代表作品',
  'adoption-catalog': '领养目录',
  'home-adoption': '首页当前领养',
}
export const COMPOSITION_RATIOS: Partial<Record<CompositionUsage, number>> = {
  'detail-thumbnail': 1,
  'work-catalog': 4 / 5,
  'home-featured': 3 / 4,
}

export function allowedCompositionUsages(role: string): CompositionUsage[] {
  if (role === 'studio_photo') return ['detail-thumbnail', 'work-catalog', 'home-featured']
  if (role === 'adoption_cover' || role === 'design_sheet') return ['detail-thumbnail', 'work-catalog', 'adoption-catalog', 'home-adoption']
  return []
}

export function fitCrop(width: number, height: number, ratio: number, region: CropRect = { x: 0, y: 0, width: 1, height: 1 }, focusX = 0.5, focusY = 0.5): CropRect {
  const w = Math.min(region.width, region.height * height * ratio / width)
  const h = Math.min(region.height, region.width * width / ratio / height)
  return { x: region.x + (region.width - w) * focusX, y: region.y + (region.height - h) * focusY, width: w, height: h }
}

export function defaultComposition(role: string, usage: CompositionUsage, width: number, height: number): ImageComposition {
  const ratio = COMPOSITION_RATIOS[usage]
  return ratio && (usage === 'detail-thumbnail' || role === 'studio_photo')
    ? { mode: 'crop', rect: fitCrop(width, height, ratio) }
    : { mode: 'contain' }
}

export function resolveComposition(role: string, usage: CompositionUsage, width: number, height: number, compositions: ImageCompositions = {}): ImageComposition {
  return compositions[usage] ?? defaultComposition(role, usage, width, height)
}

/** Round edges once, shared by preview and server; retain at least one source pixel. */
export function pixelCrop(rect: CropRect, width: number, height: number) {
  const x = Math.min(width - 1, Math.round(rect.x * width))
  const y = Math.min(height - 1, Math.round(rect.y * height))
  return {
    x, y,
    width: Math.max(1, Math.min(width, Math.round((rect.x + rect.width) * width)) - x),
    height: Math.max(1, Math.min(height, Math.round((rect.y + rect.height) * height)) - y),
  }
}

export function compositionOutputHeight(usage: CompositionUsage, outputWidth: number, width: number, height: number, value: ImageComposition) {
  const rect = value.mode === 'crop' ? pixelCrop(value.rect, width, height) : { width, height }
  const ratio = COMPOSITION_RATIOS[usage]
  return Math.max(1, Math.round(outputWidth * (ratio ? 1 / ratio : rect.height / rect.width)))
}

export function compositionMinimumDimensions(usage: CompositionUsage, outputWidth: number, width: number, height: number, value: ImageComposition) {
  const rect = value.mode === 'crop' ? value.rect : { width: 1, height: 1 }
  return {
    width: Math.ceil(outputWidth / rect.width),
    height: Math.ceil(compositionOutputHeight(usage, outputWidth, width, height, value) / rect.height),
  }
}

export function compositionError(role: string, usage: CompositionUsage, value: ImageComposition, width: number, height: number): string | null {
  if (!allowedCompositionUsages(role).includes(usage)) return '图片不支持此构图用途'
  if (value.mode === 'contain') return usage === 'detail-thumbnail' ? '详情缩略图必须为方形' : null
  const rect = value.rect
  if (rect.width * width < 1 || rect.height * height < 1) return '选区至少包含一个完整像素'
  const ratio = COMPOSITION_RATIOS[usage]
  if (ratio && Math.abs(rect.width * width / (rect.height * height) - ratio) > ratio * 0.00001) return '选区比例与展示用途不符'
  const outputWidth = usage === 'detail-thumbnail' ? 288 : usage === 'adoption-catalog' || usage === 'home-adoption' ? 1600 : 1200
  const minimum = compositionMinimumDimensions(usage, outputWidth, width, height, value)
  const scale = Math.max(minimum.width / width, minimum.height / height)
  if (Math.ceil(Math.max(width, height) * scale) > 12000) return '选区过小，处理尺寸将超过上限，请扩大选区'
  return null
}
