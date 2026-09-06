import { z } from 'zod'
import { notificationEmailSchema } from '../../shared/schemas/commission-email'
import type { RuntimeConfig } from './runtime-config'

const smtpSchema = z.object({
  host: z.string().trim().min(1).max(253).regex(/^[a-zA-Z0-9.-]+$/u),
  port: z.coerce.number().int().pipe(z.union([z.literal(465), z.literal(587)])),
  secure: z.union([z.boolean(), z.enum(['true', 'false'])]).transform(value => value === true || value === 'true'),
  user: notificationEmailSchema,
  password: z.string().min(1).max(256),
  from: notificationEmailSchema,
}).refine(value => value.secure === (value.port === 465) && value.from === value.user)

export function smtpConfiguration(config: Pick<RuntimeConfig,
  'smtpEnabled' | 'smtpHost' | 'smtpPort' | 'smtpSecure' | 'smtpUser' | 'smtpPassword' | 'smtpFrom'>) {
  if (config.smtpEnabled === undefined || config.smtpEnabled === ''
    || config.smtpEnabled === false || config.smtpEnabled === 'false') {
    return { status: 'disabled' as const, transport: null }
  }
  const parsed = smtpSchema.safeParse({
    host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure,
    user: config.smtpUser, password: config.smtpPassword, from: config.smtpFrom,
  })
  if ((config.smtpEnabled !== true && config.smtpEnabled !== 'true') || !parsed.success) {
    return { status: 'invalid' as const, transport: null }
  }
  return { status: 'ready' as const, transport: parsed.data }
}
