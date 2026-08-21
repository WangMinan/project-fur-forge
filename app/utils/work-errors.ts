import type { ErrorReason } from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'

/**
 * T34-F4：稳定业务 `reason` → 可读中文。
 *
 * 前端只匹配 `reason`，不再匹配服务端英文 `message`；服务端改写说明文字
 * 不会影响这里的任何分支。中文提示集中在本表维护，不在各组件里重复。
 */
const REASON_MESSAGES: Partial<Record<ErrorReason, string>> = {
  WORK_FIELDS_INVALID:
    '当前用途的字段组合未通过服务端校验：请检查用途、业务状态、价格与属性后重试。',
  WORK_SLUG_TAKEN:
    '该链接别名已被其他作品使用，请更换后重试。',
  VERSION_CONFLICT:
    '内容已在其他地方被修改（版本冲突），本次修改未保存。',
  WORK_PUBLISHED_READONLY:
    '作品已发布：请先下架，再修改或删除。',
  WORK_DESIGN_SHEET_PRESENT:
    '该领养作品已有领养设定图：请先移除设定图，才能改为非领养用途。',
  WORK_PUBLICATION_BLOCKED:
    '还有未解决的发布阻塞项，请先按提示补齐后再发布。',
  FEATURED_LIMIT_REACHED:
    '代表作品最多设置 4 件；请先移出一件，再选择新的代表作品。',
  FEATURED_PORTRAIT_PHOTO_REQUIRED:
    '代表作品必须至少有一张已就绪的竖版出厂照；请先上传竖版出厂照。',
  ASSET_ALREADY_LINKED:
    '该图片已经关联到另一件作品。',
  RESOURCE_NOT_FOUND:
    '内容不存在或已被删除。',
  VALIDATION_FAILED:
    '填写内容未通过服务端校验，请检查标注的字段后重试。',
  ACTIVE_OPERATION_EXISTS:
    '已有一个操作正在进行，请等它结束后再试。',
  OPERATION_NOT_RETRYABLE:
    '当前状态不支持重试，请刷新后查看最新进度。',
  PUBLIC_VARIANT_INCOMPLETE:
    '公开图还没有全部生成完成，请稍后重试。',
  MEDIA_SOURCE_TOO_SMALL:
    '原图尺寸不足，无法生成这个展示位需要的公开图。',
  MEDIA_SOURCE_UNAVAILABLE:
    '找不到可用的图片处理源，请重新上传原图。',
  UPLOAD_SESSION_EXPIRED:
    '上传会话已过期，请重新开始上传。',
  HERO_ITEM_ENABLED:
    '这张大图正在启用中：请先停用，再修改、预览或删除。',
  HERO_ASSET_NOT_READY:
    '这张大图还没准备好，请确认图片已上传成功。',
  HERO_ASSET_ALREADY_ASSIGNED:
    '这张图片已经被另一条大图使用了。',
  HERO_ASSET_REQUIRES_UPSCALE:
    '图片清晰度不足：请先确认生成适配图，再启用。',
  HERO_ORDER_STALE:
    '大图顺序已在其他地方变化，请刷新后重新调整。',
  HERO_SLOT_LIMIT:
    '启用的大图需要 1 到 5 个不重复的位置。',
  WATERMARK_DRAFT_STALE:
    '水印草稿已过期，请重新创建草稿。',
  WATERMARK_PREVIEW_REQUIRED:
    '请先生成并核验水印预览，再应用到全站。',
  WATERMARK_PROFILE_UNAVAILABLE:
    '当前没有可用的水印配置。',
}

const STATUS_FALLBACKS: Record<number, string> = {
  400: '填写内容未通过服务端校验，请检查标注的字段后重试。',
  403: '这个操作没有通过安全校验，请刷新页面后重试。',
  404: '内容不存在或已被删除。',
  409: '状态已变化，本次操作未执行；请刷新后重试。',
  429: '操作过于频繁，请稍后再试。',
}

/**
 * 稳定 reason 优先，其次按状态码给出可操作说明，
 * 最后回落到调用方提供的场景文案（网络失败、响应结构异常等）。
 */
export function workApiErrorText(error: unknown, fallback: string): string {
  if (!(error instanceof AdminApiError)) {
    return fallback
  }
  const mapped = error.reason ? REASON_MESSAGES[error.reason] : undefined
  if (mapped) {
    return mapped
  }
  return (error.status !== null && STATUS_FALLBACKS[error.status]) || fallback
}

/** 供非作品场景复用同一张中文映射表。 */
export function adminReasonText(reason: ErrorReason | null): string | null {
  return reason ? REASON_MESSAGES[reason] ?? null : null
}
