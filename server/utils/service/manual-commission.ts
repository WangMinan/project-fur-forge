import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type Database from 'better-sqlite3'
import { commissionConflictQuerySchema, createManualCommissionSchema, updateManualCommissionSchema } from '../../../shared/schemas/manual-commission'
import type { ManualCommissionSave } from '../../../shared/schemas/manual-commission'
import { findCommissionSubmission, findCommissionUpload } from '../repository/commission-repository'
import { auditManualCommission, consumeManualUpload, manualRequest, matchingCommissions, recordManualRequest, retireManualImage, writeManualCommission } from '../repository/manual-commission'
import { getRuntimeConfig } from '../runtime-config'
import { ServiceError } from '../service-error'
import { assertCommissionUploadToken, commissionListItem, getCommissionSubmissionDetail } from './commission-management'
import { assertCommissionDeletionUnlocked } from './commission-retention'

const fallbackConfirmationSecret = randomBytes(32)

function signature(value: unknown) {
  return createHmac('sha256', getRuntimeConfig().sessionSecret ?? fallbackConfirmationSecret).update(JSON.stringify(value)).digest('hex')
}
function sameSignature(a: string | null, b: string) {
  return a !== null && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
function invalid() { return new ServiceError(400, 'VALIDATION_ERROR', 'Commission fields are invalid.') }

export function manualCommissionConflicts(sqlite: Database.Database, actorId: string, input: unknown) {
  const parsed = commissionConflictQuerySchema.safeParse(input)
  if (!parsed.success) throw invalid()
  const { phone, qq, excludeId } = parsed.data
  const rows = matchingCommissions(sqlite, phone?.number ?? null, qq, excludeId)
  return {
    confirmation: signature(['commission-conflict', actorId, phone, qq, excludeId ?? null, rows.map(row => [row.id, row.version])]),
    matches: rows.map(row => ({ ...commissionListItem(sqlite, row), reasons: [
      ...(phone && row.phoneNumber === phone.number ? ['phone' as const] : []),
      ...(qq && row.qq === qq ? ['qq' as const] : []),
    ] })),
  }
}

function assertConflicts(sqlite: Database.Database, actorId: string, input: ManualCommissionSave, excludeId?: string) {
  const result = manualCommissionConflicts(sqlite, actorId, { phone: input.fields.phone, qq: input.fields.qq, excludeId })
  if (result.matches.length && !sameSignature(input.conflictConfirmation, result.confirmation)) {
    throw new ServiceError(409, 'CONFLICT', 'Review matching applications before saving.', 'COMMISSION_CONTACT_CONFLICT')
  }
}

function uploadedAsset(sqlite: Database.Database, actorId: string, input: ManualCommissionSave, now: number) {
  if (!input.upload) return null
  const row = findCommissionUpload(sqlite, input.upload.id)
  if (!row) throw new ServiceError(404, 'NOT_FOUND', 'Upload was not found.')
  assertCommissionUploadToken(row, input.upload.token, actorId)
  if (row.status !== 'COMPLETED' || row.version !== input.upload.version || row.expiresAt <= now || !row.assetId) {
    throw new ServiceError(409, 'CONFLICT', 'Upload must be completed again.', 'UPLOAD_SESSION_EXPIRED')
  }
  return row.assetId
}

export function createManualCommission(sqlite: Database.Database, actorId: string, raw: unknown, now = Date.now()) {
  const parsed = createManualCommissionSchema.safeParse(raw)
  if (!parsed.success) throw invalid()
  const input = parsed.data
  const hash = createHash('sha256').update(JSON.stringify(['commission-create', input.requestId, input.fields, input.upload ?? null])).digest('hex')
  return sqlite.transaction(() => {
    const previous = manualRequest(sqlite, input.requestId)
    if (previous) {
      if (previous.actor_id !== actorId) throw new ServiceError(403, 'FORBIDDEN', 'Request is unavailable.')
      if (!previous.submission_id) throw new ServiceError(409, 'CONFLICT', 'Application has been deleted.', 'COMMISSION_REQUEST_DELETED')
      if (!sameSignature(previous.payload_hash, hash)) throw new ServiceError(409, 'CONFLICT', 'Start a new recording operation.', 'COMMISSION_REQUEST_REUSED')
      return getCommissionSubmissionDetail(sqlite, previous.submission_id)
    }
    assertConflicts(sqlite, actorId, input)
    const assetId = uploadedAsset(sqlite, actorId, input, now)
    const id = randomUUID()
    let receiptCode: string
    do { receiptCode = `DD-${randomBytes(6).toString('hex').toUpperCase()}` }
    while (sqlite.prepare('SELECT 1 FROM commission_submissions WHERE receipt_code = ?').get(receiptCode))
    writeManualCommission(sqlite, { id, receiptCode, actorId, fields: input.fields, assetId, now })
    if (input.upload && consumeManualUpload(sqlite, input.upload.id, input.upload.version, now) !== 1) throw invalid()
    recordManualRequest(sqlite, input.requestId, actorId, hash, id)
    auditManualCommission(sqlite, randomUUID(), actorId, id, now)
    return getCommissionSubmissionDetail(sqlite, id)
  }).immediate()
}

export function updateManualCommission(sqlite: Database.Database, actorId: string, id: string, raw: unknown, now = Date.now()) {
  const parsed = updateManualCommissionSchema.safeParse(raw)
  if (!parsed.success) throw invalid()
  const input = parsed.data
  assertCommissionDeletionUnlocked(id)
  return sqlite.transaction(() => {
    const row = findCommissionSubmission(sqlite, id)
    if (!row) throw new ServiceError(404, 'NOT_FOUND', 'Commission was not found.')
    if (row.origin !== 'manual') throw new ServiceError(403, 'FORBIDDEN', 'Website application fields cannot be edited.')
    if (row.version !== input.expectedVersion) throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
    if (row.phoneNumber !== (input.fields.phone?.number ?? null) || row.qq !== input.fields.qq) assertConflicts(sqlite, actorId, input, id)
    const assetId = input.upload === undefined ? row.designAssetId : uploadedAsset(sqlite, actorId, input, now)
    if (writeManualCommission(sqlite, { id, receiptCode: row.receiptCode, actorId, fields: input.fields, assetId, expectedVersion: input.expectedVersion, now }) !== 1) {
      throw new ServiceError(409, 'CONFLICT', 'Commission changed or deletion is in progress.', 'VERSION_CONFLICT')
    }
    if (input.upload && consumeManualUpload(sqlite, input.upload.id, input.upload.version, now) !== 1) throw invalid()
    if (row.designAssetId && row.designAssetId !== assetId && retireManualImage(sqlite, row.designAssetId, now) !== 1) {
      throw new ServiceError(409, 'CONFLICT', 'Previous image cannot be safely retired.')
    }
    auditManualCommission(sqlite, randomUUID(), actorId, id, now)
    return getCommissionSubmissionDetail(sqlite, id)
  }).immediate()
}
