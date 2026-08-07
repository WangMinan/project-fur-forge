import type {
  PublicationFailureStage,
  ReturnPhotoBlocker,
  ReturnPhotoConsentSource,
} from '~~/shared/types/contracts'

/**
 * 返图管理端中文标签。
 *
 * 全部使用景宸能直接理解的说法：不出现任务号、表名、Object Key
 * 或中英混杂的内部错误码。
 */

export const RETURN_BLOCKER_LABELS: Record<ReturnPhotoBlocker, string> = {
  RETURN_PHOTO_WORK_NOT_PUBLISHED: '关联作品还没有发布，先发布作品才能发布返图',
  RETURN_PHOTO_ALT_REQUIRED: '需要填写图片说明',
  RETURN_PHOTO_ASSET_REQUIRED: '还没有上传返图图片',
  RETURN_PHOTO_ASSET_NOT_READY: '返图图片还在处理中或处理失败',
  RETURN_PHOTO_SOURCE_TOO_SMALL: '图片太小，宽度至少需要 480 像素',
  RETURN_PHOTO_VARIANT_INCOMPLETE: '公开图片还没有生成完整',
}

export const RETURN_CONSENT_SOURCE_LABELS: Record<
  ReturnPhotoConsentSource,
  string
> = {
  qq: 'QQ',
  email: '邮件',
  other: '其他渠道',
}

/** 长任务阶段：说明“现在在做什么”，不显示内部错误码。 */
export const RETURN_OPERATION_STAGE_LABELS: Record<
  PublicationFailureStage,
  string
> = {
  PREPARING_SOURCE: '准备图片来源',
  VALIDATING: '检查发布条件',
  GENERATING_PUBLIC: '生成公开图片',
  APPLYING_WATERMARK: '处理图片',
  VERIFYING_PUBLIC: '校验公开图片',
  COMMITTING: '提交发布状态',
  CLEANING_PUBLIC: '清理公开图片',
}

/** operation 当前状态的可读说明。 */
export const RETURN_OPERATION_STATUS_LABELS: Record<string, string> = {
  PREPARING_SOURCE: '正在准备图片来源',
  GENERATING_PUBLIC: '正在生成公开图片',
  APPLYING_WATERMARK: '正在处理图片',
  VERIFYING_PUBLIC: '正在校验公开图片',
  COMMITTING: '正在提交发布状态',
  CLEANING_PUBLIC: '正在清理公开图片',
  DONE: '已完成',
  FAILED: '未完成',
}
