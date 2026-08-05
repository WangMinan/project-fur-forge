import type {
  WatermarkOperationStatus,
  WatermarkPreviewKind,
  WatermarkProfileStatus,
} from '~~/shared/types/contracts'

// GATE-07 居中水印：界面只展示稳定状态/失败码对应的中文文案，不解析服务端英文 message。

export const WATERMARK_PROFILE_STATUS_LABELS: Record<WatermarkProfileStatus, string> = {
  DRAFT: '草稿',
  APPLYING: '应用中',
  ACTIVE: '当前使用',
  RETIRED: '已退役',
  FAILED: '应用失败',
}

export const WATERMARK_PROFILE_STATUS_TONES: Record<
  WatermarkProfileStatus,
  'error' | 'info' | 'neutral' | 'success' | 'warning'
> = {
  DRAFT: 'info',
  APPLYING: 'warning',
  ACTIVE: 'success',
  RETIRED: 'neutral',
  FAILED: 'error',
}

export const WATERMARK_OPERATION_STATUS_LABELS: Record<WatermarkOperationStatus, string> = {
  GENERATING_PUBLIC: '生成公开图',
  VERIFYING_PUBLIC: '核验公开图',
  SWITCHING_PROFILE: '切换配置',
  CLEANING_PUBLIC: '清理旧公开图',
  FAILED: '失败',
  DONE: '已完成',
}

export const WATERMARK_OPERATION_TYPE_LABELS = {
  WATERMARK_PREVIEW: '真实预览',
  WATERMARK_REBUILD: '全站应用',
} as const

// 稳定安全失败码 → 中文动作提示；不展示底层 OSS 错误。
export const WATERMARK_FAILURE_HINTS: Record<string, string> = {
  WATERMARK_PREVIEW_FAILED: '预览生成失败，当前公开站不受影响，请重试。',
  WATERMARK_PREVIEW_CLEANUP_FAILED: '预览生成失败，且临时预览文件未清理完，重试会继续清理。',
  WATERMARK_REBUILD_FAILED: '公开图重新生成失败，当前公开站仍使用原水印配置，请重试。',
  WATERMARK_CLEANUP_FAILED: '新水印已生效，但旧公开图未清理完，重试只会继续清理。',
}

export function watermarkFailureHint(code: string | null) {
  return (code && WATERMARK_FAILURE_HINTS[code])
    ?? '操作失败，请重新加载后重试。'
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatWatermarkDateTime(iso: string) {
  return dateTimeFormatter.format(new Date(iso))
}

export const WATERMARK_PREVIEW_KIND_LABELS: Record<WatermarkPreviewKind, string> = {
  'work-card': '作品卡片',
  'detail': '作品详情',
  'design-sheet': '领养设定图',
}

export const WATERMARK_PREVIEW_ASPECT_LABELS: Record<WatermarkPreviewKind, string> = {
  'work-card': '3:4',
  'detail': '原比例',
  'design-sheet': '原比例',
}
