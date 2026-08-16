import type Database from 'better-sqlite3'
import type {
  CommissionSubmissionStatus,
  CommissionUploadStatus,
  UploadFailureCode,
  UploadFailureStage,
} from '../../../shared/types/contracts'

export interface CommissionUploadRow {
  assetId: string | null
  completedAt: number | null
  consumedAt: number | null
  createdAt: number
  expectedBytes: number
  expectedContentMd5: string
  expectedContentType: 'image/jpeg' | 'image/png' | 'image/webp'
  expectedHeight: number
  expectedSha256: string
  expectedWidth: number
  expiresAt: number
  failureCode: UploadFailureCode | null
  failureStage: UploadFailureStage | null
  id: string
  privateObjectKey: string
  status: CommissionUploadStatus
  tokenDigest: string
  updatedAt: number
  version: number
}

export interface CommissionSubmissionRow {
  createdAt: number
  designAssetId: string
  handledAt: number | null
  handledBy: string | null
  heightCm: number
  id: string
  internalNote: string | null
  nickname: string
  species: string | null
  phoneCountryCode: '+86'
  phoneNumber: string
  qq: string
  receiptCode: string
  status: CommissionSubmissionStatus
  updatedAt: number
  version: number
  weightKgTenths: number
}

const uploadColumns = `
  id, token_digest AS tokenDigest,
  private_object_key AS privateObjectKey,
  expected_content_type AS expectedContentType,
  expected_bytes AS expectedBytes,
  expected_content_md5 AS expectedContentMd5,
  expected_sha256 AS expectedSha256,
  expected_width AS expectedWidth,
  expected_height AS expectedHeight,
  status, asset_id AS assetId,
  failure_code AS failureCode, failure_stage AS failureStage,
  version, created_at AS createdAt, expires_at AS expiresAt,
  completed_at AS completedAt, consumed_at AS consumedAt,
  updated_at AS updatedAt
`

export function findCommissionUpload(
  sqlite: Database.Database,
  id: string,
) {
  return sqlite.prepare(`
    SELECT ${uploadColumns}
    FROM commission_upload_sessions WHERE id = ?
  `).get(id) as CommissionUploadRow | undefined
}

export function insertCommissionUpload(
  sqlite: Database.Database,
  input: Omit<CommissionUploadRow,
    | 'assetId' | 'completedAt' | 'consumedAt'
    | 'failureCode' | 'failureStage' | 'status' | 'version'>,
) {
  sqlite.prepare(`
    INSERT INTO commission_upload_sessions (
      id, token_digest, private_object_key,
      expected_content_type, expected_bytes, expected_content_md5,
      expected_sha256, expected_width, expected_height,
      created_at, expires_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.tokenDigest,
    input.privateObjectKey,
    input.expectedContentType,
    input.expectedBytes,
    input.expectedContentMd5,
    input.expectedSha256,
    input.expectedWidth,
    input.expectedHeight,
    input.createdAt,
    input.expiresAt,
    input.updatedAt,
  )
}

export function acquireCommissionUploadValidation(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE commission_upload_sessions
    SET status = 'VALIDATING', version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'AWAITING_UPLOAD' AND version = ?
  `).run(now, id, expectedVersion).changes
}

export function failCommissionUpload(
  sqlite: Database.Database,
  id: string,
  failureCode: UploadFailureCode,
  failureStage: UploadFailureStage,
  now: number,
) {
  sqlite.prepare(`
    UPDATE commission_upload_sessions
    SET status = 'FAILED', failure_code = ?, failure_stage = ?,
        version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'VALIDATING' AND asset_id IS NULL
  `).run(failureCode, failureStage, now, id)
}

export function expireCommissionUpload(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE commission_upload_sessions
    SET status = 'EXPIRED', version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'AWAITING_UPLOAD' AND version = ?
  `).run(now, id, expectedVersion).changes
}

function submissionColumns(sqlite: Database.Database) {
  // 部署窗口内允许新应用先只读旧库，避免管理列表因 species 尚未扩列而整体 500；
  // 新投递仍要求 0042 完成后才可写入 species。
  const hasSpecies = (sqlite.pragma(
    'table_info(commission_submissions)',
  ) as { name: string }[]).some(column => column.name === 'species')
  return `
    id, receipt_code AS receiptCode, nickname,
    ${hasSpecies ? 'species' : 'NULL AS species'},
    phone_country_code AS phoneCountryCode,
    phone_number AS phoneNumber, qq,
    height_cm AS heightCm, weight_kg_tenths AS weightKgTenths,
    design_asset_id AS designAssetId, status,
    internal_note AS internalNote,
    handled_at AS handledAt, handled_by AS handledBy,
    version, created_at AS createdAt, updated_at AS updatedAt
  `
}

export function listCommissionSubmissionRows(
  sqlite: Database.Database,
  status?: CommissionSubmissionStatus,
) {
  return sqlite.prepare(`
    SELECT ${submissionColumns(sqlite)}
    FROM commission_submissions
    ${status ? 'WHERE status = ?' : ''}
    ORDER BY created_at DESC, id
  `).all(...(status ? [status] : [])) as CommissionSubmissionRow[]
}

export function findCommissionSubmission(
  sqlite: Database.Database,
  id: string,
) {
  return sqlite.prepare(`
    SELECT ${submissionColumns(sqlite)}
    FROM commission_submissions WHERE id = ?
  `).get(id) as CommissionSubmissionRow | undefined
}

export function updateCommissionSubmissionRow(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  input: {
    actorUserId: string
    internalNote: string | null
    status: CommissionSubmissionStatus
  },
  now: number,
) {
  return sqlite.prepare(`
    UPDATE commission_submissions
    SET status = ?, internal_note = ?,
        handled_at = CASE WHEN ? = 'pending' THEN NULL ELSE ? END,
        handled_by = CASE WHEN ? = 'pending' THEN NULL ELSE ? END,
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?
  `).run(
    input.status,
    input.internalNote,
    input.status,
    now,
    input.status,
    input.actorUserId,
    now,
    id,
    expectedVersion,
  ).changes
}
