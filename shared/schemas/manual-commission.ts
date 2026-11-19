import { z } from 'zod'
import { apiSuccessSchema, resourceIdSchema, resourceVersionSchema } from './api'
import { commissionPhoneSchema, commissionSubmissionListItemDtoSchema, commissionSubmissionStatusSchema } from './commission'

const optionalText = (max: number) => z.string().trim().min(1).max(max).refine(value => !/[<>]/u.test(value) && !value.includes(String.fromCharCode(0)), '请填写纯文本').nullable()
export const manualCommissionFieldsSchema = z.object({
  nickname: z.string().trim().min(1, '请填写称呼').max(50),
  channel: z.enum(['qq', 'wechat', 'other']),
  channelLabel: optionalText(50),
  species: optionalText(50),
  phone: commissionPhoneSchema.nullable(),
  qq: z.string().trim().regex(/^[1-9]\d{4,11}$/u, 'QQ需为5–12位数字').nullable(),
  otherContact: optionalText(200),
  heightCm: z.number().int().min(80).max(250).nullable(),
  weightKg: z.number().min(20).max(300).multipleOf(0.1).nullable(),
  originalAppliedOn: z.iso.date().nullable(),
  historicalHandledOn: z.iso.date().nullable(),
  status: commissionSubmissionStatusSchema,
  internalNote: optionalText(2000),
  offlineAdultConfirmed: z.boolean(),
  offlinePrivacyConfirmed: z.boolean(),
}).strict().superRefine((value, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
  if (!value.phone && !value.qq && !value.otherContact) issue('otherContact', '请至少填写一种联系方式')
  if (value.channel === 'other' && !value.channelLabel) issue('channelLabel', '请填写来源渠道名称')
  if (value.channel !== 'other' && value.channelLabel) issue('channelLabel', '当前渠道无需额外名称')
  if (value.status === 'accepted') {
    if (!value.offlineAdultConfirmed) issue('offlineAdultConfirmed', '接受前请确认申请人已成年')
    if (!value.offlinePrivacyConfirmed) issue('offlinePrivacyConfirmed', '接受前请确认资料用于委托处理')
  }
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  for (const field of ['originalAppliedOn', 'historicalHandledOn'] as const) {
    if (value[field] && value[field] > today) issue(field, '日期不能晚于北京时间今天')
  }
  if (value.status === 'pending' && value.historicalHandledOn) issue('historicalHandledOn', '待处理申请不填写历史处理日期')
  if (value.originalAppliedOn && value.historicalHandledOn && value.historicalHandledOn < value.originalAppliedOn) issue('historicalHandledOn', '处理日期不能早于申请日期')
})

export const manualCommissionUploadSchema = z.object({
  id: resourceIdSchema,
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
  version: resourceVersionSchema,
}).strict()
export const saveManualCommissionSchema = z.object({
  fields: manualCommissionFieldsSchema,
  // undefined preserves the saved image; null explicitly removes it.
  upload: manualCommissionUploadSchema.nullable().optional(),
  conflictConfirmation: z.string().regex(/^[0-9a-f]{64}$/u).nullable().default(null),
}).strict()
export const createManualCommissionSchema = saveManualCommissionSchema.extend({ requestId: resourceIdSchema })
export const updateManualCommissionSchema = saveManualCommissionSchema.extend({ expectedVersion: resourceVersionSchema })
export const commissionConflictQuerySchema = z.object({
  phone: commissionPhoneSchema.nullable(),
  qq: z.string().trim().regex(/^[1-9]\d{4,11}$/u).nullable(),
  excludeId: resourceIdSchema.optional(),
}).strict()
export const commissionConflictsResponseSchema = apiSuccessSchema(z.object({
  confirmation: z.string().regex(/^[0-9a-f]{64}$/u),
  matches: z.array(commissionSubmissionListItemDtoSchema.extend({ reasons: z.array(z.enum(['phone', 'qq'])) })),
}).strict())
export type ManualCommissionFields = z.infer<typeof manualCommissionFieldsSchema>
export type ManualCommissionSave = z.infer<typeof saveManualCommissionSchema>
