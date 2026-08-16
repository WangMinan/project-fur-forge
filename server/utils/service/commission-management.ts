import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  commissionSubmissionDetailDtoSchema,
  commissionSubmissionListItemDtoSchema,
  commissionUploadSessionDtoSchema,
} from '../../../shared/schemas/commission'
import type {
  CommissionSubmissionDetailDto,
  CommissionSubmissionListItemDto,
  CommissionSubmissionStatus,
  CommissionUploadSessionDto,
  ConditionalPutDto,
} from '../../../shared/types/contracts'
import type { MediaStorage } from '../media-storage'
import type { RuntimeConfig } from '../runtime-config'
import { ServiceError } from '../service-error'
import {
  acquireCommissionUploadValidation,
  expireCommissionUpload,
  failCommissionUpload,
  findCommissionSubmission,
  findCommissionUpload,
  insertCommissionUpload,
  listCommissionSubmissionRows,
  updateCommissionSubmissionRow,
} from '../repository/commission-repository'
import type {
  CommissionSubmissionRow,
  CommissionUploadRow,
} from '../repository/commission-repository'
import {
  PrivateImageValidationError,
  verifyConditionalImageUpload,
} from './private-image-validation'

export const COMMISSION_UPLOAD_TTL_MS = 10 * 60 * 1_000

export interface CommissionUploadExpected {
  byteSize: number
  contentMd5: string
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
  height: number
  sha256: string
  width: number
}

interface CreateOptions {
  id?: string
  keyPrefix?: string
  now?: number
  objectToken?: string
  token?: string
}

const testRunId = randomBytes(8).toString('hex')

function environmentPrefix(environment: RuntimeConfig['appEnv']) {
  if (environment === 'test') {
    return `test/${testRunId}`
  }
  return environment === 'production' ? 'prod' : 'dev'
}

function extensionFor(contentType: CommissionUploadExpected['contentType']) {
  if (contentType === 'image/jpeg') {
    return 'jpg'
  }
  return contentType === 'image/png' ? 'png' : 'webp'
}

function tokenDigest(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function assertToken(row: CommissionUploadRow, token: string) {
  const actual = Buffer.from(tokenDigest(token), 'hex')
  const expected = Buffer.from(row.tokenDigest, 'hex')
  if (
    actual.length !== expected.length
    || !timingSafeEqual(actual, expected)
  ) {
    throw new ServiceError(404, 'NOT_FOUND', 'Commission upload was not found.')
  }
}

function requireUpload(sqlite: Database.Database, id: string) {
  const row = findCommissionUpload(sqlite, id)
  if (!row) {
    throw new ServiceError(404, 'NOT_FOUND', 'Commission upload was not found.')
  }
  return row
}

function sessionDto(row: CommissionUploadRow): CommissionUploadSessionDto {
  return commissionUploadSessionDtoSchema.parse({
    uploadSessionId: row.id,
    status: row.status,
    version: row.version,
    failureCode: row.failureCode,
    failureStage: row.failureStage,
    assetId: row.assetId,
    createdAt: new Date(row.createdAt).toISOString(),
    expiresAt: new Date(row.expiresAt).toISOString(),
  })
}

export async function createCommissionUpload(
  sqlite: Database.Database,
  storage: MediaStorage,
  config: Pick<RuntimeConfig, 'appEnv'>,
  expected: CommissionUploadExpected,
  options: CreateOptions = {},
): Promise<{
  session: CommissionUploadSessionDto
  token: string
  upload: ConditionalPutDto
}> {
  const id = options.id ?? randomUUID()
  const token = options.token ?? randomBytes(32).toString('base64url')
  const objectToken = options.objectToken ?? randomBytes(24).toString('hex')
  const now = options.now ?? Date.now()
  const expiresAt = now + COMMISSION_UPLOAD_TTL_MS
  const prefix = options.keyPrefix ?? environmentPrefix(config.appEnv)
  const privateObjectKey = `${prefix}/commission/original/${id}/${objectToken}.${extensionFor(expected.contentType)}`
  let upload: ConditionalPutDto
  try {
    upload = await storage.signConditionalPut({
      contentMd5: expected.contentMd5,
      contentType: expected.contentType,
      expiresAt,
      objectKey: privateObjectKey,
      sha256: expected.sha256,
    })
  }
  catch {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Upload service is unavailable.')
  }

  try {
    insertCommissionUpload(sqlite, {
      id,
      tokenDigest: tokenDigest(token),
      privateObjectKey,
      expectedContentType: expected.contentType,
      expectedBytes: expected.byteSize,
      expectedContentMd5: expected.contentMd5,
      expectedSha256: expected.sha256,
      expectedWidth: expected.width,
      expectedHeight: expected.height,
      createdAt: now,
      expiresAt,
      updatedAt: now,
    })
  }
  catch {
    await storage.deletePrivate(privateObjectKey).catch(() => {})
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Upload session could not be created.')
  }
  return {
    session: sessionDto(requireUpload(sqlite, id)),
    token,
    upload,
  }
}

async function failAndClean(
  sqlite: Database.Database,
  storage: MediaStorage,
  row: CommissionUploadRow,
  error: PrivateImageValidationError,
  now: number,
): Promise<never> {
  failCommissionUpload(
    sqlite,
    row.id,
    error.failureCode,
    error.failureStage,
    now,
  )
  try {
    await storage.deletePrivate(row.privateObjectKey)
  }
  catch {
    sqlite.prepare(`
      UPDATE commission_upload_sessions
      SET failure_code = 'UPLOAD_CLEANUP_FAILED', failure_stage = 'CLEANUP',
          version = version + 1, updated_at = ?
      WHERE id = ? AND status = 'FAILED'
    `).run(now, row.id)
  }
  throw new ServiceError(400, 'VALIDATION_ERROR', 'Uploaded media validation failed.')
}

export async function completeCommissionUpload(
  sqlite: Database.Database,
  storage: MediaStorage,
  id: string,
  token: string,
  expectedVersion: number,
  now = Date.now(),
) {
  let row = requireUpload(sqlite, id)
  assertToken(row, token)
  if (row.status === 'COMPLETED') {
    return sessionDto(row)
  }
  if (row.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  if (row.status !== 'AWAITING_UPLOAD') {
    throw new ServiceError(409, 'CONFLICT', 'Commission upload cannot be completed.')
  }
  if (row.expiresAt <= now) {
    expireCommissionUpload(sqlite, id, expectedVersion, now)
    await storage.deletePrivate(row.privateObjectKey).catch(() => {})
    throw new ServiceError(409, 'CONFLICT', 'Commission upload has expired.')
  }
  if (acquireCommissionUploadValidation(
    sqlite,
    id,
    expectedVersion,
    now,
  ) !== 1) {
    throw new ServiceError(409, 'CONFLICT', 'Commission upload is already being validated.')
  }
  row = requireUpload(sqlite, id)
  let verified
  try {
    verified = await verifyConditionalImageUpload(storage, {
      byteSize: row.expectedBytes,
      contentMd5: row.expectedContentMd5,
      contentType: row.expectedContentType,
      height: row.expectedHeight,
      mediaRole: 'commission_design_reference',
      objectKey: row.privateObjectKey,
      sha256: row.expectedSha256,
      width: row.expectedWidth,
    })
  }
  catch (error) {
    return failAndClean(
      sqlite,
      storage,
      row,
      error instanceof PrivateImageValidationError
        ? error
        : new PrivateImageValidationError('UPLOAD_STORAGE_FAILURE', 'HEAD'),
      now,
    )
  }
  try {
    sqlite.transaction(() => {
      sqlite.prepare(`
        INSERT INTO assets (
          id, role, status, private_object_key, sha256, byte_size,
          mime_type, width, height, exif_orientation,
          fit_mode, created_at, updated_at
        ) VALUES (?, 'commission_design_reference', 'READY', ?, ?, ?, ?,
          ?, ?, ?, 'contain', ?, ?)
      `).run(
        row.id,
        row.privateObjectKey,
        row.expectedSha256,
        row.expectedBytes,
        row.expectedContentType,
        verified.width,
        verified.height,
        verified.orientation,
        now,
        now,
      )
      const completed = sqlite.prepare(`
        UPDATE commission_upload_sessions
        SET status = 'COMPLETED', asset_id = id, completed_at = ?,
            version = version + 1, updated_at = ?
        WHERE id = ? AND status = 'VALIDATING' AND version = ?
      `).run(now, now, id, row.version)
      if (completed.changes !== 1) {
        throw new Error('Commission upload completion lost its version.')
      }
    })()
  }
  catch {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Commission upload could not be persisted.')
  }
  return sessionDto(requireUpload(sqlite, id))
}

function listItem(row: CommissionSubmissionRow): CommissionSubmissionListItemDto {
  return commissionSubmissionListItemDtoSchema.parse({
    id: row.id,
    receiptCode: row.receiptCode,
    nickname: row.nickname,
    status: row.status,
    createdAt: new Date(row.createdAt).toISOString(),
    version: row.version,
  })
}

export function listCommissionSubmissions(
  sqlite: Database.Database,
  status?: CommissionSubmissionStatus,
) {
  return listCommissionSubmissionRows(sqlite, status).map(listItem)
}

export function getCommissionSubmissionDetail(
  sqlite: Database.Database,
  id: string,
): CommissionSubmissionDetailDto {
  const row = findCommissionSubmission(sqlite, id)
  if (!row) {
    throw new ServiceError(404, 'NOT_FOUND', 'Commission submission was not found.')
  }
  return commissionSubmissionDetailDtoSchema.parse({
    ...listItem(row),
    phone: {
      countryCode: row.phoneCountryCode,
      number: row.phoneNumber,
    },
    qq: row.qq,
    heightCm: row.heightCm,
    weightKg: row.weightKgTenths / 10,
    internalNote: row.internalNote,
    updatedAt: new Date(row.updatedAt).toISOString(),
    handledAt: row.handledAt === null
      ? null
      : new Date(row.handledAt).toISOString(),
    designReferencePreviewHref: `/api/admin/v1/commissions/${row.id}/design-reference`,
  })
}

export function updateCommissionSubmission(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  input: {
    actorUserId: string
    internalNote: string | null
    status: CommissionSubmissionStatus
  },
  now = Date.now(),
) {
  if (updateCommissionSubmissionRow(
    sqlite,
    id,
    expectedVersion,
    input,
    now,
  ) !== 1) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  sqlite.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, entity_type, entity_id, result, created_at
    ) VALUES (?, ?, 'COMMISSION_SUBMISSION_UPDATE', 'COMMISSION_SUBMISSION', ?, 'SUCCESS', ?)
  `).run(randomUUID(), input.actorUserId, id, now)
  return getCommissionSubmissionDetail(sqlite, id)
}

export async function getCommissionDesignReference(
  sqlite: Database.Database,
  storage: MediaStorage,
  submissionId: string,
) {
  const row = sqlite.prepare(`
    SELECT asset.private_object_key AS objectKey, asset.mime_type AS mimeType
    FROM commission_submissions AS submission
    JOIN assets AS asset ON asset.id = submission.design_asset_id
    WHERE submission.id = ?
      AND asset.role = 'commission_design_reference'
      AND asset.status = 'READY'
  `).get(submissionId) as { mimeType: string, objectKey: string } | undefined
  if (!row) {
    throw new ServiceError(404, 'NOT_FOUND', 'Commission design reference was not found.')
  }
  return {
    content: await storage.getPrivate(row.objectKey),
    mimeType: row.mimeType,
  }
}
