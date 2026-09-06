import { z } from 'zod'
import { apiSuccessSchema, resourceIdSchema } from './api'

export const notificationEmailSchema = z.string().trim().max(254).email()
  .refine(value => !/[\r\n]/u.test(value))
  .transform((value) => {
    const [local, domain] = value.split('@') as [string, string]
    return `${domain.toLowerCase() === 'qq.com' ? local.toLowerCase() : local}@${domain.toLowerCase()}`
  })

export const commissionRecipientsSchema = z.array(notificationEmailSchema)
  .refine(values => new Set(values).size === values.length, '收件邮箱不能重复')

export const smtpStatusSchema = z.enum(['ready', 'disabled', 'invalid'])
export const commissionEmailStatusSchema = z.enum([
  'legacy', 'disabled', 'unconfigured', 'pending', 'sending', 'sent', 'partial', 'failed', 'cancelled',
])
export const commissionEmailErrorSchema = z.enum([
  'AUTH', 'REJECTED', 'TOO_LARGE', 'CONNECTION', 'ATTACHMENT', 'UNKNOWN',
])
export const commissionEmailResponseSchema = apiSuccessSchema(z.object({
  smtpStatus: smtpStatusSchema,
  status: commissionEmailStatusSchema,
  deliveries: z.array(z.object({
    id: resourceIdSchema,
    recipient: notificationEmailSchema,
    status: z.enum(['pending', 'sending', 'sent', 'failed', 'cancelled']),
    attempts: z.number().int().nonnegative(),
    errorCode: commissionEmailErrorSchema.nullable(),
    sentAt: z.string().datetime().nullable(),
    retryable: z.boolean(),
  }).strict()),
}).strict())

export const retryCommissionEmailSchema = z.object({ notificationId: resourceIdSchema }).strict()
