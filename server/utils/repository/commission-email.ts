import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { commissionRecipientsSchema } from '../../../shared/schemas/commission-email'
import { ServiceError } from '../service-error'

export const EMAIL_LEASE_MS = 180_000
export const EMAIL_MAX_ATTEMPTS = 2
export interface CommissionEmailRow {
  id: string
  submission_id: string
  recipient: string
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'
  attempt_count: number
  next_attempt_at: number
  lease_token: string | null
  lease_expires_at: number | null
  transmitting_at: number | null
  last_error_code: 'AUTH' | 'REJECTED' | 'TOO_LARGE' | 'CONNECTION' | 'ATTACHMENT' | 'UNKNOWN' | null
  sent_at: number | null
}

export function commissionRecipients(sqlite: Database.Database) {
  const raw = sqlite.prepare(`SELECT commission_notification_recipients_json FROM site_content WHERE id = 'site'`).pluck().get()
  return commissionRecipientsSchema.parse(JSON.parse(String(raw)))
}

// Called inside the submission transaction. No network work belongs here.
export function enqueueCommissionEmails(sqlite: Database.Database, id: string, enabled: boolean, now: number) {
  const recipients = commissionRecipients(sqlite)
  const policy = !enabled ? 'disabled' : recipients.length ? 'enabled' : 'unconfigured'
  sqlite.prepare('UPDATE commission_submissions SET email_notification_policy = ? WHERE id = ?').run(policy, id)
  if (policy !== 'enabled') return
  const insert = sqlite.prepare(`INSERT INTO commission_email_notifications
    (id, submission_id, recipient, next_attempt_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
  for (const recipient of recipients) insert.run(randomUUID(), id, recipient, now, now, now)
}

export function commissionEmailRows(sqlite: Database.Database, id: string) {
  return sqlite.prepare('SELECT * FROM commission_email_notifications WHERE submission_id = ? ORDER BY created_at, rowid')
    .all(id) as CommissionEmailRow[]
}

export function commissionEmailSummary(sqlite: Database.Database, id: string) {
  // Keep the existing rolling-deployment read of pre-migration commissions available.
  if (!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'commission_email_notifications'").get()) return 'legacy'
  const rows = commissionEmailRows(sqlite, id)
  if (!rows.length) {
    const policy = sqlite.prepare('SELECT email_notification_policy FROM commission_submissions WHERE id = ?').pluck().get(id)
    return policy === 'disabled' || policy === 'unconfigured' ? policy : 'legacy'
  }
  if (rows.every(row => row.status === 'sent')) return 'sent'
  if (rows.some(row => row.status === 'sent')) return 'partial'
  if (rows.some(row => row.status === 'sending')) return 'sending'
  if (rows.some(row => row.status === 'pending')) return 'pending'
  return rows.some(row => row.status === 'failed') ? 'failed' : 'cancelled'
}

export function cancelRemovedCommissionEmails(sqlite: Database.Database, now = Date.now()) {
  sqlite.prepare(`UPDATE commission_email_notifications
    SET status = 'cancelled', lease_token = NULL, lease_expires_at = NULL, updated_at = ?
    WHERE status IN ('pending', 'sending', 'failed') AND transmitting_at IS NULL
      AND recipient NOT IN (SELECT value FROM json_each(
        (SELECT commission_notification_recipients_json FROM site_content WHERE id = 'site')))`)
    .run(now)
}

export function claimCommissionEmail(sqlite: Database.Database, now = Date.now()) {
  return sqlite.transaction(() => {
    // An interrupted transmission may already have arrived. Only an operator can decide to resend it.
    sqlite.prepare(`UPDATE commission_email_notifications
      SET status = CASE WHEN transmitting_at IS NOT NULL OR attempt_count >= ? THEN 'failed' ELSE 'pending' END,
      last_error_code = CASE WHEN transmitting_at IS NOT NULL THEN 'UNKNOWN' ELSE 'CONNECTION' END,
      lease_token = NULL, lease_expires_at = NULL, transmitting_at = NULL, updated_at = ?
      WHERE status = 'sending' AND lease_expires_at <= ?`).run(EMAIL_MAX_ATTEMPTS, now, now)
    // Old pending rows can have exhausted the new limit before this version was deployed.
    sqlite.prepare(`UPDATE commission_email_notifications SET status = 'failed', updated_at = ?
      WHERE status = 'pending' AND attempt_count >= ?`).run(now, EMAIL_MAX_ATTEMPTS)
    cancelRemovedCommissionEmails(sqlite, now)
    const row = sqlite.prepare(`SELECT n.* FROM commission_email_notifications n
      JOIN commission_submissions s ON s.id = n.submission_id
      WHERE n.status = 'pending' AND n.next_attempt_at <= ? AND s.email_deletion_pending = 0
      ORDER BY n.next_attempt_at, n.rowid LIMIT 1`).get(now) as CommissionEmailRow | undefined
    if (!row) return null
    const token = randomUUID()
    sqlite.prepare(`UPDATE commission_email_notifications SET status = 'sending', attempt_count = attempt_count + 1,
      lease_token = ?, lease_expires_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'`)
      .run(token, now + EMAIL_LEASE_MS, now, row.id)
    return { ...row, status: 'sending' as const, attempt_count: row.attempt_count + 1, lease_token: token }
  })()
}

export function beginCommissionEmailTransmission(sqlite: Database.Database, row: CommissionEmailRow, now = Date.now()) {
  return sqlite.prepare(`UPDATE commission_email_notifications SET transmitting_at = ?, updated_at = ?
    WHERE id = ? AND status = 'sending' AND lease_token = ? AND lease_expires_at > ?
      AND recipient IN (SELECT value FROM json_each((SELECT commission_notification_recipients_json FROM site_content WHERE id = 'site')))
      AND EXISTS (SELECT 1 FROM commission_submissions WHERE id = submission_id AND email_deletion_pending = 0)`)
    .run(now, now, row.id, row.lease_token, now).changes === 1
}

export function renewCommissionEmailLease(sqlite: Database.Database, row: CommissionEmailRow, now = Date.now()) {
  sqlite.prepare(`UPDATE commission_email_notifications SET lease_expires_at = ?
    WHERE id = ? AND status = 'sending' AND lease_token = ?`)
    .run(now + EMAIL_LEASE_MS, row.id, row.lease_token)
}

export function finishCommissionEmail(sqlite: Database.Database, row: CommissionEmailRow,
  error: { code: NonNullable<CommissionEmailRow['last_error_code']>, temporary: boolean } | null, now = Date.now()) {
  const retry = error?.temporary && row.attempt_count < EMAIL_MAX_ATTEMPTS
  sqlite.prepare(`UPDATE commission_email_notifications SET status = ?, last_error_code = ?,
    next_attempt_at = ?, sent_at = ?, lease_token = NULL, lease_expires_at = NULL, transmitting_at = NULL, updated_at = ?
    WHERE id = ? AND status = 'sending' AND lease_token = ?`)
    .run(error ? retry ? 'pending' : 'failed' : 'sent', error?.code ?? null,
      now + 60_000, error ? null : now, now, row.id, row.lease_token)
  cancelRemovedCommissionEmails(sqlite, now)
}

export function retryCommissionEmail(sqlite: Database.Database, submissionId: string, id: string, now = Date.now()) {
  const updated = sqlite.prepare(`UPDATE commission_email_notifications SET status = 'pending', attempt_count = 0,
    last_error_code = NULL, next_attempt_at = ?, updated_at = ?
    WHERE id = ? AND submission_id = ? AND status = 'failed'
      AND recipient IN (SELECT value FROM json_each((SELECT commission_notification_recipients_json FROM site_content WHERE id = 'site')))
      AND EXISTS (SELECT 1 FROM commission_submissions WHERE id = submission_id AND email_deletion_pending = 0)`)
    .run(now, now, id, submissionId)
  if (!updated.changes) throw new ServiceError(409, 'CONFLICT', 'Notification cannot be retried.')
}

// A persistent fence also protects deletion via a separate one-shot process.
export function fenceCommissionEmailsForDeletion(sqlite: Database.Database, id: string, now = Date.now()) {
  sqlite.transaction(() => {
    const active = sqlite.prepare(`SELECT 1 FROM commission_email_notifications WHERE submission_id = ?
      AND status = 'sending' AND transmitting_at IS NOT NULL AND lease_expires_at > ?`).get(id, now)
    if (active) throw new ServiceError(409, 'CONFLICT', 'Notification is being sent; retry deletion later.', 'COMMISSION_DELETE_BLOCKED')
    sqlite.prepare('UPDATE commission_submissions SET email_deletion_pending = 1 WHERE id = ?').run(id)
    sqlite.prepare(`UPDATE commission_email_notifications SET status = 'cancelled', lease_token = NULL,
      lease_expires_at = NULL, transmitting_at = NULL, updated_at = ? WHERE submission_id = ? AND status != 'sent'`).run(now, id)
  })()
}
