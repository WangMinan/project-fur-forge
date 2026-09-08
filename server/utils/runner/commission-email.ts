import nodemailer from 'nodemailer'
import type { SendMailOptions } from 'nodemailer'
import type Database from 'better-sqlite3'
import { createConnection } from 'node:net'
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
import { safeLog } from '../safe-log'

const SMTP_TIMEOUT_MS = 600_000

// Abort the wait as well as the socket: attachment reads and test senders can still be pending.
async function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work
  let onAbort: () => void = () => {}
  try {
    return await Promise.race([work, new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(signal.reason)
      signal.addEventListener('abort', onAbort, { once: true })
      if (signal.aborted) onAbort()
    })])
  }
  finally { signal.removeEventListener('abort', onAbort) }
}

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

export async function sendCommissionMail(config: RuntimeConfig, mail: SendMailOptions, signal?: AbortSignal) {
  signal?.throwIfAborted()
  const smtp = smtpConfiguration(config).transport
  if (!smtp || config.appEnv === 'test') throw new Error('Real SMTP delivery is disabled.')
  const transport = nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.secure, requireTLS: true,
    auth: { user: smtp.user, pass: smtp.password },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: SMTP_TIMEOUT_MS, greetingTimeout: SMTP_TIMEOUT_MS, socketTimeout: SMTP_TIMEOUT_MS,
    // SMTPTransport.close() only releases auth resources. Own an abortable TCP socket;
    // Nodemailer still performs and verifies TLS (implicit TLS on 465, STARTTLS on 587).
    getSocket: (_options, callback) => {
      const socket = createConnection({ host: smtp.host, port: smtp.port, signal })
      const timer = setTimeout(() => socket.destroy(Object.assign(new Error('SMTP connection timed out.'), { code: 'ETIMEDOUT' })), SMTP_TIMEOUT_MS)
      const fail = (error: Error) => { clearTimeout(timer); callback(error) }
      socket.once('error', fail)
      socket.once('connect', () => {
        clearTimeout(timer)
        socket.removeListener('error', fail)
        callback(null, { connection: socket })
      })
      socket.once('close', () => clearTimeout(timer))
    },
    logger: false, debug: false,
    disableFileAccess: true, disableUrlAccess: true,
  })
  try {
    return await abortable(transport.sendMail(mail), signal)
  }
  finally { transport.close() }
}

export async function deliverNextCommissionEmail(options: {
  sqlite: Database.Database
  storage: MediaStorage
  config: RuntimeConfig
  send?: (mail: SendMailOptions) => Promise<unknown>
  now?: () => number
  signal?: AbortSignal
}) {
  if (options.signal?.aborted || smtpConfiguration(options.config).status !== 'ready') return false
  const now = options.now ?? Date.now
  const row = claimCommissionEmail(options.sqlite, now())
  if (!row) return false
  const startedAt = now()
  let phase: 'attachment' | 'smtp' = 'attachment'
  // A slow but live SMTP transfer must retain ownership until its socket finishes.
  const heartbeat = setInterval(() => {
    try {
      renewCommissionEmailLease(options.sqlite, row, now())
    }
    catch { /* A transient busy database is retried at the next heartbeat. */ }
  }, 30_000)
  try {
    const attachment = await abortable(
      getCommissionDesignReference(options.sqlite, options.storage, row.submission_id), options.signal,
    )
    options.signal?.throwIfAborted()
    const mail = commissionMail(options.sqlite, row, options.config, attachment)
    if (!beginCommissionEmailTransmission(options.sqlite, row, now())) return true
    phase = 'smtp'
    await abortable((options.send ?? (mail => sendCommissionMail(options.config, mail, options.signal)))(mail), options.signal)
    finishCommissionEmail(options.sqlite, row, null, now())
    safeLog('info', 'Commission notification completed.', { attempts: row.attempt_count, elapsedMs: now() - startedAt })
    return true
  }
  catch (error) {
    const stopped = options.signal?.aborted === true
    const failure = phase === 'attachment'
      ? { code: 'ATTACHMENT' as const, temporary: true }
      : stopped ? { code: 'UNKNOWN' as const, temporary: false } : smtpFailure(error)
    finishCommissionEmail(options.sqlite, row, failure, now())
    safeLog('warn', 'Commission notification incomplete.', {
      attempts: row.attempt_count, elapsedMs: now() - startedAt, phase,
      reason: stopped ? 'shutdown' : failure.code,
    })
    return true
  }
  finally { clearInterval(heartbeat) }
}
