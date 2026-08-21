export type AdminUploadStage
  = | 'cancelled'
    | 'completed'
    | 'digesting'
    | 'expired'
    | 'failed'
    | 'idle'
    | 'ready'
    | 'uploading'
    | 'validating'

const STAGE_LABELS: Record<AdminUploadStage, string> = {
  cancelled: '已取消',
  completed: '上传与校验完成',
  digesting: '正在计算文件摘要',
  expired: '上传会话已过期',
  failed: '上传失败',
  idle: '等待选择文件',
  ready: '上传与校验完成',
  uploading: '正在上传到私有存储',
  validating: '服务端正在校验图片',
}

/**
 * 四类管理上传只共享展示映射；owner、role、会话与错误处理仍留在各业务 composable。
 * 百分比只来自 XHR loaded/total，校验或 FFmpeg 阶段绝不推测数值。
 */
export function adminUploadProgressModel(input: {
  failureText?: string | null
  ffmpeg?: boolean
  label: string
  progress?: number | null
  stage: AdminUploadStage
  stageLabel?: string | null
}) {
  const terminalStatus = input.stage === 'completed' || input.stage === 'ready'
    ? 'success' as const
    : input.stage === 'failed' || input.stage === 'expired'
      ? 'error' as const
      : input.stage === 'cancelled'
        ? 'cancelled' as const
        : 'active' as const

  return {
    detail: input.failureText ?? null,
    label: input.label,
    max: input.stage === 'uploading' ? 1 : null,
    mode: input.stage === 'uploading'
      ? 'determinate' as const
      : input.stage === 'validating' && input.ffmpeg
        ? 'indeterminate' as const
        : 'stage' as const,
    showElapsed: input.stage === 'validating' && Boolean(input.ffmpeg),
    stage: input.stageLabel ?? STAGE_LABELS[input.stage],
    status: terminalStatus,
    value: input.stage === 'uploading' ? input.progress ?? 0 : null,
  }
}
