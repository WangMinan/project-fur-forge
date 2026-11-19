import type Database from 'better-sqlite3'
import { commissionEmailResponseSchema } from '../../../shared/schemas/commission-email'
import { getRuntimeConfig } from '../runtime-config'
import { smtpConfiguration } from '../smtp-config'
import { commissionEmailRows, commissionEmailSummary, commissionRecipients, retryCommissionEmail } from '../repository/commission-email'
import { findCommissionSubmission } from '../repository/commission-repository'
import { ServiceError } from '../service-error'

export function getCommissionEmails(sqlite: Database.Database, id: string) {
  const submission = findCommissionSubmission(sqlite, id)
  if (!submission) throw new ServiceError(404, 'NOT_FOUND', 'Commission submission was not found.')
  if (submission.origin === 'manual') return commissionEmailResponseSchema.shape.data.parse({ smtpStatus: 'disabled', status: 'not_applicable', deliveries: [] })
  const recipients = commissionRecipients(sqlite)
  const smtpStatus = smtpConfiguration(getRuntimeConfig()).status
  const deleting = sqlite.prepare('SELECT email_deletion_pending FROM commission_submissions WHERE id = ?').pluck().get(id)
  return commissionEmailResponseSchema.shape.data.parse({
    smtpStatus,
    status: commissionEmailSummary(sqlite, id),
    deliveries: commissionEmailRows(sqlite, id).map(row => ({
      id: row.id, recipient: row.recipient, status: row.status, attempts: row.attempt_count,
      errorCode: row.last_error_code, sentAt: row.sent_at === null ? null : new Date(row.sent_at).toISOString(),
      retryable: !deleting && smtpStatus === 'ready' && row.status === 'failed' && recipients.includes(row.recipient),
    })),
  })
}

export function requestCommissionEmailRetry(sqlite: Database.Database, submissionId: string, id: string) {
  if (findCommissionSubmission(sqlite, submissionId)?.origin === 'manual') throw new ServiceError(409, 'CONFLICT', 'Manual commissions do not use email.')
  if (smtpConfiguration(getRuntimeConfig()).status !== 'ready') {
    throw new ServiceError(409, 'CONFLICT', 'SMTP configuration is unavailable.')
  }
  retryCommissionEmail(sqlite, submissionId, id)
  return getCommissionEmails(sqlite, submissionId)
}
