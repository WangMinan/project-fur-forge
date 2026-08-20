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

export interface CommissionRetentionRow {
  createdAt: number
  handledAt: number | null
  id: string
  receiptCode: string
  status: CommissionSubmissionStatus
}

export function listCommissionRetentionRows(
  sqlite: Database.Database,
  pendingCreatedBefore: number,
) {
  return sqlite.prepare(`
    SELECT id, receipt_code AS receiptCode, status,
           created_at AS createdAt, handled_at AS handledAt
    FROM commission_submissions
    WHERE status = 'rejected'
       OR (status = 'pending' AND created_at <= ?)
    ORDER BY CASE status WHEN 'rejected' THEN 0 ELSE 1 END,
             COALESCE(handled_at, created_at), id
  `).all(pendingCreatedBefore) as CommissionRetentionRow[]
}

export interface CommissionDeletionVariantRow {
  id: string
  mediaRole: string
  objectKey: string
  storageScope: string
}

export interface CommissionDeletionTarget {
  asset: {
    id: string
    objectKey: string
    role: string
  } | null
  auditRows: number
  references: Record<string, number>
  sessions: {
    id: string
    objectKey: string
  }[]
  submission: {
    designAssetId: string
    id: string
    receiptCode: string
    status: CommissionSubmissionStatus
    version: number
  }
  variants: CommissionDeletionVariantRow[]
}

export function findCommissionDeletionTarget(
  sqlite: Database.Database,
  identifier: string,
): CommissionDeletionTarget | null {
  const submission = sqlite.prepare(`
    SELECT id, receipt_code AS receiptCode, design_asset_id AS designAssetId,
           status, version
    FROM commission_submissions
    WHERE id = ? OR receipt_code = ?
  `).get(identifier, identifier) as CommissionDeletionTarget['submission'] | undefined
  if (!submission) {
    return null
  }
  const asset = sqlite.prepare(`
    SELECT id, role, private_object_key AS objectKey
    FROM assets WHERE id = ?
  `).get(submission.designAssetId) as CommissionDeletionTarget['asset'] | undefined
  const sessions = sqlite.prepare(`
    SELECT id, private_object_key AS objectKey
    FROM commission_upload_sessions WHERE asset_id = ?
  `).all(submission.designAssetId) as CommissionDeletionTarget['sessions']
  const variants = sqlite.prepare(`
    SELECT id, media_role AS mediaRole, object_key AS objectKey,
           storage_scope AS storageScope
    FROM asset_variants WHERE asset_id = ? ORDER BY id
  `).all(submission.designAssetId) as CommissionDeletionVariantRow[]
  const variantIds = variants.map(variant => variant.id)
  const count = (sql: string, ...params: unknown[]) => Number(
    sqlite.prepare(sql).pluck().get(...params) ?? 0,
  )
  const references = {
    adminUploads: count('SELECT count(*) FROM upload_sessions WHERE asset_id = ?', submission.designAssetId),
    heroItems: count('SELECT count(*) FROM site_hero_items WHERE asset_id = ?', submission.designAssetId),
    heroSlides: count(`
      SELECT count(*) FROM site_hero_slides
      WHERE landscape_asset_id = ? OR portrait_asset_id = ?
    `, submission.designAssetId, submission.designAssetId),
    officialChannels: count(`
      SELECT count(*) FROM site_content
      WHERE instr(official_channels_json, ?) > 0
    `, submission.designAssetId),
    otherCommissionSubmissions: count(`
      SELECT count(*) FROM commission_submissions
      WHERE design_asset_id = ? AND id != ?
    `, submission.designAssetId, submission.id),
    publicationOperations: count(`
      SELECT count(*) FROM publication_operations
      WHERE entity_id IN (${[submission.id, submission.designAssetId, ...sessions.map(session => session.id)]
        .map(() => '?').join(',')})
    `, submission.id, submission.designAssetId, ...sessions.map(session => session.id)),
    variantDependants: variantIds.length === 0
      ? 0
      : count(`
          SELECT count(*) FROM asset_variants
          WHERE source_variant_id IN (${variantIds.map(() => '?').join(',')})
            AND asset_id != ?
        `, ...variantIds, submission.designAssetId),
    watermarkProfiles: count('SELECT count(*) FROM watermark_profiles WHERE source_asset_id = ?', submission.designAssetId),
    workAssets: count('SELECT count(*) FROM work_assets WHERE asset_id = ?', submission.designAssetId),
  }
  return {
    asset: asset ?? null,
    auditRows: count(`
      SELECT count(*) FROM audit_logs
      WHERE entity_type = 'COMMISSION_SUBMISSION' AND entity_id = ?
    `, submission.id),
    references,
    sessions,
    submission,
    variants,
  }
}

export function deleteCommissionTargetRows(
  sqlite: Database.Database,
  target: CommissionDeletionTarget,
  input: {
    actorUserId: string | null
    auditId: string
    deletedAt: number
    submissionIdDigest: string
  },
) {
  return sqlite.transaction(() => {
    const current = sqlite.prepare(`
      SELECT design_asset_id AS designAssetId, status, version
      FROM commission_submissions WHERE id = ?
    `).get(target.submission.id) as {
      designAssetId: string
      status: CommissionSubmissionStatus
      version: number
    } | undefined
    if (!current
      || current.designAssetId !== target.submission.designAssetId
      || current.status !== target.submission.status
      || current.version !== target.submission.version) {
      throw new Error('Commission deletion target changed.')
    }
    sqlite.prepare(`
      DELETE FROM audit_logs
      WHERE entity_type = 'COMMISSION_SUBMISSION' AND entity_id = ?
    `).run(target.submission.id)
    if (sqlite.prepare('DELETE FROM commission_submissions WHERE id = ?')
      .run(target.submission.id).changes !== 1) {
      throw new Error('Commission submission deletion failed.')
    }
    if (sqlite.prepare('DELETE FROM commission_upload_sessions WHERE asset_id = ?')
      .run(target.submission.designAssetId).changes !== 1) {
      throw new Error('Commission upload deletion failed.')
    }
    sqlite.prepare('DELETE FROM asset_variants WHERE asset_id = ?')
      .run(target.submission.designAssetId)
    if (sqlite.prepare(`
      DELETE FROM assets
      WHERE id = ? AND role = 'commission_design_reference'
    `).run(target.submission.designAssetId).changes !== 1) {
      throw new Error('Commission asset deletion failed.')
    }
    sqlite.prepare(`
      INSERT INTO audit_logs (
        id, actor_user_id, action, entity_type, entity_id, result, created_at
      ) VALUES (?, ?, 'COMMISSION_DATA_DELETE',
        'COMMISSION_SUBMISSION_DIGEST', ?, 'SUCCESS', ?)
    `).run(
      input.auditId,
      input.actorUserId,
      input.submissionIdDigest,
      input.deletedAt,
    )
  })()
}

export function insertCommissionDeletionFailureAudit(
  sqlite: Database.Database,
  input: {
    actorUserId: string | null
    auditId: string
    createdAt: number
    submissionIdDigest: string
  },
) {
  sqlite.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, entity_type, entity_id, result, created_at
    ) VALUES (?, ?, 'COMMISSION_DATA_DELETE',
      'COMMISSION_SUBMISSION_DIGEST', ?, 'FAILURE', ?)
  `).run(
    input.auditId,
    input.actorUserId,
    input.submissionIdDigest,
    input.createdAt,
  )
}
