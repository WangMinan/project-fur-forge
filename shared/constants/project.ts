export const PROJECT_NAME = '有点小狗工作室'
/** 英文名统一全大写，页头、页脚与登录页都直接用这个常量。 */
export const PROJECT_ENGLISH_NAME = 'DITE DOG'

export const ACCESS_SURFACES = [
  'public',
  'admin',
] as const

export type AccessSurface = typeof ACCESS_SURFACES[number]

export const ORIGINAL_IMAGE_MAX_BYTES = 30_000_000
