import { z } from 'zod'
import { apiSuccessSchema, resourceIdSchema } from './api'

export const ANALYTICS_EVENT_TYPE_VALUES = [
  'page_view',
  'contact_action',
] as const

export const ANALYTICS_ROUTE_KEY_VALUES = [
  'home',
  'works',
  'work_detail',
  'returns',
  'return_character',
  'commission',
  'adoptions',
  'updates',
  'about',
  'service',
  'privacy',
  'licenses',
] as const

export const ANALYTICS_ENTITY_TYPE_VALUES = [
  'work',
  'return_character',
] as const

export const ANALYTICS_ACTION_KEY_VALUES = [
  'email_open',
  'email_copy',
] as const

export const ANALYTICS_ROUTE_LABELS = {
  home: '首页',
  works: '作品展示',
  work_detail: '作品详情',
  returns: '返图墙',
  return_character: '返图设定页',
  commission: '自设委托',
  adoptions: '角色领养',
  updates: '最新动态',
  about: '关于我们',
  service: '服务条款',
  privacy: '隐私政策',
  licenses: '开源软件声明',
} as const satisfies Record<typeof ANALYTICS_ROUTE_KEY_VALUES[number], string>

export const ANALYTICS_ACTION_LABELS = {
  email_open: '打开邮件客户端',
  email_copy: '复制邮箱',
} as const satisfies Record<typeof ANALYTICS_ACTION_KEY_VALUES[number], string>

export const analyticsEventTypeSchema = z.enum(ANALYTICS_EVENT_TYPE_VALUES)
export const analyticsRouteKeySchema = z.enum(ANALYTICS_ROUTE_KEY_VALUES)
export const analyticsEntityTypeSchema = z.enum(ANALYTICS_ENTITY_TYPE_VALUES)
export const analyticsActionKeySchema = z.enum(ANALYTICS_ACTION_KEY_VALUES)

/**
 * 公开采集只接受规范枚举和公开实体 UUID。
 *
 * 请求不接受时间、URL、query、Referer、UA、联系方式或任意扩展字段；事件时间
 * 由服务端生成。详情页必须携带匹配类型的实体 ID，其余页面不得夹带实体。
 */
export const analyticsEventRequestSchema = z.object({
  eventType: analyticsEventTypeSchema,
  routeKey: analyticsRouteKeySchema,
  entityType: analyticsEntityTypeSchema.nullable(),
  entityId: resourceIdSchema.nullable(),
  actionKey: analyticsActionKeySchema.nullable(),
  sessionId: z.string().uuid(),
}).strict().superRefine((event, context) => {
  if (event.eventType === 'contact_action') {
    if (!['about', 'commission'].includes(event.routeKey)) {
      context.addIssue({
        code: 'custom',
        path: ['routeKey'],
        message: '联系行动只允许出现在已存在的官方联系页面',
      })
    }
    if (event.actionKey === null) {
      context.addIssue({
        code: 'custom',
        path: ['actionKey'],
        message: '联系行动必须提供白名单行动类别',
      })
    }
    if (event.entityType !== null || event.entityId !== null) {
      context.addIssue({
        code: 'custom',
        path: ['entityType'],
        message: '联系行动不能携带公开实体',
      })
    }
    return
  }

  if (event.actionKey !== null) {
    context.addIssue({
      code: 'custom',
      path: ['actionKey'],
      message: '页面浏览不能携带联系行动',
    })
  }

  const expectedEntity = event.routeKey === 'work_detail'
    ? 'work'
    : event.routeKey === 'return_character'
      ? 'return_character'
      : null

  if (expectedEntity === null) {
    if (event.entityType !== null || event.entityId !== null) {
      context.addIssue({
        code: 'custom',
        path: ['entityType'],
        message: '该页面浏览不能携带公开实体',
      })
    }
    return
  }

  if (event.entityType !== expectedEntity || event.entityId === null) {
    context.addIssue({
      code: 'custom',
      path: ['entityType'],
      message: '详情页必须携带匹配的公开实体',
    })
  }
})

export const analyticsEventResponseSchema = apiSuccessSchema(
  z.object({ accepted: z.literal(true) }).strict(),
)

export const analyticsRangeSummarySchema = z.object({
  pageViews: z.number().int().nonnegative(),
  approximateSessions: z.number().int().nonnegative(),
  contactActions: z.number().int().nonnegative(),
}).strict()

export const analyticsPageRankingItemSchema = z.object({
  routeKey: analyticsRouteKeySchema,
  label: z.string().trim().min(1).max(80),
  views: z.number().int().nonnegative(),
}).strict()

export const analyticsContentRankingItemSchema = z.object({
  id: resourceIdSchema,
  label: z.string().trim().min(1).max(120),
  href: z.string().regex(/^\/(?:works|returns)\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  views: z.number().int().nonnegative(),
}).strict()

export const analyticsContactActionItemSchema = z.object({
  actionKey: analyticsActionKeySchema,
  label: z.string().trim().min(1).max(80),
  count: z.number().int().nonnegative(),
}).strict()

export const analyticsOverviewDtoSchema = z.object({
  generatedAt: z.number().int().positive(),
  timeZone: z.literal('Asia/Shanghai'),
  retentionDays: z.literal(90),
  ranges: z.object({
    today: analyticsRangeSummarySchema,
    sevenDays: analyticsRangeSummarySchema,
    thirtyDays: analyticsRangeSummarySchema,
  }).strict(),
  topPages: z.array(analyticsPageRankingItemSchema).max(10),
  topWorks: z.array(analyticsContentRankingItemSchema).max(10),
  topReturnCharacters: z.array(analyticsContentRankingItemSchema).max(10),
  contactActions: z.array(analyticsContactActionItemSchema)
    .max(ANALYTICS_ACTION_KEY_VALUES.length),
}).strict()

export const analyticsOverviewResponseSchema = apiSuccessSchema(
  analyticsOverviewDtoSchema,
)
