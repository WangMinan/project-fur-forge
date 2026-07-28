export const PROJECT_NAME = '有点小狗工作室'
export const PROJECT_ENGLISH_NAME = 'dite dog'

export const ACCESS_SURFACES = [
  'public',
  'admin',
] as const

export type AccessSurface = typeof ACCESS_SURFACES[number]
