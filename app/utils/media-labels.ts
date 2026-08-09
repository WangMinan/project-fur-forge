import type {
  AssetStatus,
  PublicationBlocker,
  PublicationFailureStage,
  PublicationOperationStatus,
  UploadFailureCode,
  UploadFailureStage,
  UploadSessionStatus,
  WatermarkAnchor,
} from '~~/shared/types/contracts'

// 稳定失败码/阶段的中文映射：界面只展示这些安全文案，不解析服务端英文 message。

export const UPLOAD_SESSION_STATUS_LABELS: Record<UploadSessionStatus, string> = {
  AWAITING_UPLOAD: '等待上传',
  VALIDATING: '校验中',
  COMPLETED: '已完成',
  FAILED: '上传失败',
  CANCELLED: '已取消',
  EXPIRED: '已过期',
}

export const UPLOAD_FAILURE_STAGE_LABELS: Record<UploadFailureStage, string> = {
  HEAD: '对象检查',
  DIGEST: '摘要核验',
  IMAGE_INFO: '图片信息',
  PREPROCESS: '私有处理源',
  DATABASE: '入库',
  CLEANUP: '清理',
}

export const UPLOAD_FAILURE_CODE_LABELS: Record<UploadFailureCode, string> = {
  UPLOAD_OBJECT_MISSING: '上传的文件未到达私有存储，请重新上传',
  UPLOAD_METADATA_MISMATCH: '文件摘要或元数据与声明不一致，请重新上传',
  UPLOAD_IMAGE_INVALID: '文件不是有效的图片，请更换后重新上传',
  UPLOAD_DIMENSIONS_INVALID: '图片尺寸或格式不符合要求，请更换后重新上传',
  UPLOAD_STORAGE_FAILURE: '存储服务暂时不可用，请稍后重试',
  UPLOAD_PREPROCESS_FAILURE: '大原图私有处理源生成失败，可重试处理',
  UPLOAD_CLEANUP_FAILED: '临时文件清理失败，请联系维护人员',
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  PENDING: '处理中',
  READY: '已就绪',
  FAILED: '处理失败',
}

export const WATERMARK_ANCHOR_LABELS: Record<WatermarkAnchor, string> = {
  'top-left': '左上角',
  'top-right': '右上角',
  'bottom-left': '左下角',
  'bottom-right': '右下角',
}

export const PUBLICATION_BLOCKER_LABELS: Record<PublicationBlocker, string> = {
  EVENT_DROP_FIELDS_REQUIRED: '展会掉落需要填写展会名称与展会时间',
  WORK_FIELDS_INVALID: '基础信息不完整，请检查必填字段',
  DESIGN_SHEET_REQUIRED: '领养作品必须保存一张设定图',
  DESIGN_SHEET_NOT_READY: '设定图尚未完成服务端校验',
  DESIGN_SHEET_SOURCE_TOO_SMALL: '设定图需要尺寸适配，请重新发布重试；完整原图会保留',
  DESIGN_SHEET_ALT_REQUIRED: '设定图缺少图片说明',
  STUDIO_PHOTO_REQUIRED: '至少需要一张出厂照',
  PRIMARY_STUDIO_PHOTO_REQUIRED: '需要设置唯一一张主图',
  STUDIO_PHOTO_NOT_READY: '有出厂照尚未处理完成',
  STUDIO_PHOTO_SOURCE_TOO_SMALL: '有出厂照尺寸不足，原图至少需支持 2400 像素详情图与 1200 × 1600 卡片图',
  STUDIO_PHOTO_ALT_REQUIRED: '有出厂照缺少图片说明',
  WATERMARK_PROFILE_REQUIRED: '需要先初始化并启用站点水印',
}

export const PUBLICATION_OPERATION_STATUS_LABELS
  : Record<PublicationOperationStatus, string> = {
    PREPARING_SOURCE: '生成私有适配源中',
    GENERATING_PUBLIC: '生成公开图片中',
    APPLYING_WATERMARK: '烘焙水印中',
    VERIFYING_PUBLIC: '校验公开图片中',
    COMMITTING: '提交中',
    CLEANING_PUBLIC: '清理公开文件中',
    FAILED: '操作失败',
    DONE: '已完成',
  }

export const PUBLICATION_FAILURE_STAGE_LABELS
  : Record<PublicationFailureStage, string> = {
    PREPARING_SOURCE: '生成私有适配源',
    VALIDATING: '发布检查',
    GENERATING_PUBLIC: '生成公开图片',
    APPLYING_WATERMARK: '烘焙水印',
    VERIFYING_PUBLIC: '校验公开图片',
    COMMITTING: '提交',
    CLEANING_PUBLIC: '公开文件清理',
  }

const PUBLICATION_FAILURE_CODE_LABELS: Record<string, string> = {
  HERO_UPSCALE_FAILED: '大图适配失败，私有原图已保留，请重试',
  DESIGN_SHEET_UPSCALE_FAILED: '设定图尺寸适配失败，完整原图已保留；可以重新发布重试，或换一张更清晰的图片',
  PUBLICATION_VALIDATION_FAILED: '发布检查未通过，请根据待办项修正后重试',
  PUBLIC_MEDIA_GENERATION_FAILED: '公开图片生成失败，请稍后重试',
  PUBLIC_MEDIA_VERIFICATION_FAILED: '公开图片校验失败，请稍后重试',
  PUBLICATION_COMMIT_FAILED: '发布提交失败，请刷新状态后重试',
  UNPUBLICATION_VALIDATION_FAILED: '下架校验未通过，请刷新状态后重试',
  UNPUBLICATION_COMMIT_FAILED: '下架提交失败，请刷新状态后重试',
  PUBLIC_CLEANUP_FAILED: '公开文件清理失败',
  EDGE_PURGE_SUBMIT_FAILED: 'ESA 缓存撤销请求提交失败，请稍后重试',
  EDGE_PURGE_QUERY_FAILED: 'ESA 缓存撤销状态查询失败，请稍后重试',
  EDGE_PURGE_FAILED: 'ESA 缓存撤销失败，请稍后重试',
  EDGE_PURGE_TASK_NOT_FOUND: '未找到 ESA 缓存撤销任务，请重新提交',
  EDGE_PURGE_TIMEOUT: 'ESA 缓存撤销仍未完成，请稍后重试',
  HOME_UNPUBLICATION_COMMIT_FAILED: '大图停用提交失败，请刷新状态后重试',
  HOME_UNPUBLICATION_INTERRUPTED: '大图停用被中断，请重试撤销',
}

export function publicationFailureLabel(code: string | null) {
  return (code && PUBLICATION_FAILURE_CODE_LABELS[code])
    ?? '操作失败，请刷新状态后重试'
}
