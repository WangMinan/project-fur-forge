import type Database from 'better-sqlite3'
import type { ManualCommissionFields } from '../../../shared/schemas/manual-commission'
import { findCommissionSubmission } from './commission-repository'

export function matchingCommissions(sqlite: Database.Database, phone: string | null, qq: string | null, excludeId?: string) {
  const ids = sqlite.prepare(`SELECT id FROM commission_submissions
    WHERE (phone_number = ? OR qq = ?) AND id != ? ORDER BY id`)
    .all(phone, qq, excludeId ?? '') as { id: string }[]
  return ids.map(({ id }) => findCommissionSubmission(sqlite, id)!)
}

export function manualRequest(sqlite: Database.Database, id: string) {
  return sqlite.prepare('SELECT * FROM commission_create_requests WHERE id = ?').get(id) as {
    actor_id: string, payload_hash: string | null, submission_id: string | null
  } | undefined
}

export function recordManualRequest(sqlite: Database.Database, id: string, actorId: string, payloadHash: string, submissionId: string) {
  sqlite.prepare('INSERT INTO commission_create_requests (id, actor_id, payload_hash, submission_id) VALUES (?, ?, ?, ?)')
    .run(id, actorId, payloadHash, submissionId)
}

export function writeManualCommission(sqlite: Database.Database, options: {
  id: string, actorId: string, receiptCode: string, expectedVersion?: number,
  fields: ManualCommissionFields, assetId: string | null, now: number,
}) {
  const { fields: f, now, actorId, id } = options
  const values = {
    id, nickname: f.nickname, channel: f.channel, channel_label: f.channelLabel,
    species: f.species, phone_number: f.phone?.number ?? null, qq: f.qq,
    other_contact: f.otherContact, height_cm: f.heightCm,
    weight_kg_tenths: f.weightKg === null ? null : Math.round(f.weightKg * 10),
    original_applied_on: f.originalAppliedOn, historical_handled_on: f.historicalHandledOn,
    status: f.status, internal_note: f.internalNote,
    offline_adult_confirmed: Number(f.offlineAdultConfirmed), offline_privacy_confirmed: Number(f.offlinePrivacyConfirmed),
    design_asset_id: options.assetId,
    handled_at: f.status === 'pending' ? null : now, handled_by: f.status === 'pending' ? null : actorId,
    updated_at: now,
  }
  if (options.expectedVersion === undefined) {
    const row = { ...values, origin: 'manual', receipt_code: options.receiptCode, created_at: now, created_by: actorId }
    sqlite.prepare(`INSERT INTO commission_submissions (${Object.keys(row).join(',')})
      VALUES (${Object.keys(row).map(key => `@${key}`).join(',')})`).run(row)
    return 1
  }
  // Keys come only from the fixed mapping above, never from request keys.
  return sqlite.prepare(`UPDATE commission_submissions SET ${Object.keys(values).filter(key => key !== 'id').map(key => `${key} = @${key}`).join(',')}, version = version + 1
    WHERE id = @id AND version = @version AND origin = 'manual' AND email_deletion_pending = 0`)
    .run({ ...values, version: options.expectedVersion }).changes
}

export function consumeManualUpload(sqlite: Database.Database, id: string, version: number, now: number) {
  return sqlite.prepare(`UPDATE commission_upload_sessions SET status = 'CONSUMED', consumed_at = ?, updated_at = ?, version = version + 1
    WHERE id = ? AND version = ? AND status = 'COMPLETED' AND retired_at IS NULL`).run(now, now, id, version).changes
}

export function retireManualImage(sqlite: Database.Database, assetId: string, now: number) {
  // Preserve the old asset/session until the existing expired-upload cleanup succeeds.
  return sqlite.prepare(`UPDATE commission_upload_sessions SET retired_at = ?, updated_at = ?, version = version + 1
    WHERE asset_id = ? AND status = 'CONSUMED' AND created_by IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM commission_submissions WHERE design_asset_id = ?)`)
    .run(now, now, assetId, assetId).changes
}

export function auditManualCommission(sqlite: Database.Database, auditId: string, actorId: string, id: string, now: number) {
  sqlite.prepare(`INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, result, created_at)
    VALUES (?, ?, 'COMMISSION_SUBMISSION_UPDATE', 'COMMISSION_SUBMISSION', ?, 'SUCCESS', ?)`)
    .run(auditId, actorId, id, now)
}
