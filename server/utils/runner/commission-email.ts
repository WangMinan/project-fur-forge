import nodemailer from 'nodemailer'
import type { SendMailOptions } from 'nodemailer'
import type Database from 'better-sqlite3'
import type { MediaStorage } from '../media-storage'
import type { RuntimeConfig } from '../runtime-config'
import { smtpConfiguration } from '../smtp-config'
import { findCommissionSubmission } from '../repository/commission-repository'
import {
  beginCommissionEmailTransmission,
  claimCommissionEmail,
  finishCommissionEmail,
  renewCommissionEmailLease,
} from '../repository/commission-email'
import type { CommissionEmailRow } from '../repository/commission-email'
import { getCommissionDesignReference } from '../service/commission-management'

export function smtpFailure(error: unknown) {
  const value = error as { code?: string, responseCode?: number }
  if (value?.code === 'EAUTH') return { code: 'AUTH' as const, temporary: false }
  if (value?.responseCode === 552) return { code: 'TOO_LARGE' as const, temporary: false }
  if (value?.responseCode && value.responseCode >= 500) return { code: 'REJECTED' as const, temporary: false }
  if ((value?.responseCode && value.responseCode >= 400)
    || ['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKET', 'EDNS'].includes(value?.code ?? '')) {
    return { code: 'CONNECTION' as const, temporary: true }
  }
  return { code: 'UNKNOWN' as const, temporary: false }
}

export function commissionMail(sqlite: Database.Database, row: CommissionEmailRow, config: RuntimeConfig,
  attachment: { content: Buffer, mimeType: string }): SendMailOptions {
  const submission = findCommissionSubmission(sqlite, row.submission_id)
  const smtp = smtpConfiguration(config).transport
  if (!submission || !smtp) throw new Error('Notification is unavailable.')
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[attachment.mimeType]
  if (!extension) throw new Error('Attachment type is invalid.')
  return {
    from: { name: '有点小狗工作室', address: smtp.from },
    to: row.recipient,
    messageId: `<commission-${row.id}@${smtp.from.split('@')[1]}>`,
    subject: `【有点小狗】收到新的自设委托，请及时处理`,
    text: [
      '收到新的自设委托，完整资料如下：',
      `投递编号：${submission.receiptCode}`,
      `提交时间：${new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'medium' }).format(submission.createdAt)}（北京时间）`,
      `称呼：${submission.nickname}`, `物种：${submission.species ?? '未填写'}`,
      `手机号：${submission.phoneCountryCode} ${submission.phoneNumber}`, `QQ：${submission.qq}`,
      `身高：${submission.heightCm} cm`, `体重：${submission.weightKgTenths / 10} kg`,
      `后台详情（需登录）：${config.adminBaseUrl}/admin/commissions/${submission.id}`,
      '', '附件为本次投递的原始设定图。',
    ].join('\n'),
    attachments: [{ filename: `${submission.receiptCode}.${extension}`, content: attachment.content, contentType: attachment.mimeType }],
    disableFileAccess: true,
    disableUrlAccess: true,
  }
}

export async function sendCommissionMail(config: RuntimeConfig, mail: SendMailOptions) {
  const smtp = smtpConfiguration(config).transport
  if (!smtp || config.appEnv === 'test') throw new Error('Real SMTP delivery is disabled.')
  const transport = nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.secure, requireTLS: true,
    auth: { user: smtp.user, pass: smtp.password },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
    logger: false, debug: false,
    disableFileAccess: true, disableUrlAccess: true,
  })
  try {
    return await transport.sendMail(mail)
  }
  finally { transport.close() }
}

export async function deliverNextCommissionEmail(options: {
  sqlite: Database.Database
  storage: MediaStorage
  config: RuntimeConfig
  send?: (mail: SendMailOptions) => Promise<unknown>
  now?: () => number
}) {
  if (smtpConfiguration(options.config).status !== 'ready') return false
  const now = options.now ?? Date.now
  const row = claimCommissionEmail(options.sqlite, now())
  if (!row) return false
  // A slow but live SMTP transfer must retain ownership until its socket finishes.
  const heartbeat = setInterval(() => {
    try {
      renewCommissionEmailLease(options.sqlite, row, now())
    }
    catch { /* A transient busy database is retried at the next heartbeat. */ }
  }, 30_000)
  try {
    let mail: SendMailOptions
    try {
      mail = commissionMail(options.sqlite, row, options.config,
        await getCommissionDesignReference(options.sqlite, options.storage, row.submission_id))
    }
    catch {
      finishCommissionEmail(options.sqlite, row, { code: 'ATTACHMENT', temporary: true }, now())
      return true
    }
    if (!beginCommissionEmailTransmission(options.sqlite, row, now())) return true
    try {
      await (options.send ?? (mail => sendCommissionMail(options.config, mail)))(mail)
      finishCommissionEmail(options.sqlite, row, null, now())
    }
    catch (error) {
      finishCommissionEmail(options.sqlite, row, smtpFailure(error), now())
    }
    return true
  }
  finally { clearInterval(heartbeat) }
}
