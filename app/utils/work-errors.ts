import { AdminApiError } from '~/composables/useAdminApi'

/**
 * 管理端作品接口的稳定服务端消息 → 可读中文。
 * 键为后端契约中固定的 `error.message`，前端不新增错误语义，
 * 也不把英文原文直接暴露给管理员。
 */
const WORK_API_MESSAGES: Record<string, string> = {
  'Work fields are invalid for the selected purpose.':
    '当前用途的字段组合未通过服务端校验：请检查用途、业务状态、价格与属性后重试。',
  'Work id is invalid.':
    '作品地址无效，请返回作品列表重新进入。',
  'Work slug is already in use.':
    '该链接别名已被其他作品使用，请更换后重试。',
  'Resource version is stale.':
    '作品已在其他地方被修改（版本冲突），本次修改未保存。',
  'Unpublish the work before editing it.':
    '作品已发布：请先下架，再修改字段。',
  'Unpublish the work before editing media.':
    '作品已发布：请先下架，再修改媒体。',
  'Unpublish the work before deleting it.':
    '作品已发布：请先下架，再删除。',
  'Remove the design sheet before changing the work purpose.':
    '该领养作品已有领养设定图：请先移除设定图，才能改为非领养用途。',
  'Asset is already linked to a work.':
    '该图片已经关联到另一件作品。',
  'Work was not found.':
    '作品不存在或已被删除。',
}

const STATUS_FALLBACKS: Record<number, string> = {
  400: '填写内容未通过服务端校验，请检查标注的字段后重试。',
  404: '作品不存在或已被删除。',
  409: '作品状态已变化，本次操作未执行；请刷新后重试。',
}

/**
 * 服务端可读错误优先，其次按状态码给出可操作说明，
 * 最后回落到调用方提供的场景文案（网络失败、响应结构异常等）。
 */
export function workApiErrorText(error: unknown, fallback: string): string {
  if (!(error instanceof AdminApiError)) {
    return fallback
  }
  const mapped = error.serverMessage
    ? WORK_API_MESSAGES[error.serverMessage]
    : undefined
  if (mapped) {
    return mapped
  }
  return (error.status !== null && STATUS_FALLBACKS[error.status]) || fallback
}
