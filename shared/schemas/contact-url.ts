import { z } from 'zod'

export const xContactUrlSchema = z.string().trim()
  .regex(/^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/?$/u, '请填写 https://x.com/账号 格式的 X 主页链接')
  .transform(value => value.replace(/\/$/u, ''))

