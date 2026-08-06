import {
  randomBytes,
  randomUUID,
} from 'node:crypto'
import type Database from 'better-sqlite3'
import { uploadSessionDtoSchema } from '../../../shared/schemas/upload'
import type {
  ConditionalPutDto,
  MediaRole,
  UploadFailureCode,
  UploadFailureStage,
  UploadOwner,
  UploadSessionDto,
  UploadSessionStatus,
} from '../../../shared/types/contracts'
import type { MediaStorage } from '../media-storage'
import type { RuntimeConfig } from '../runtime-config'
import { ServiceError } from '../service-error'

export const UPLOAD_SESSION_TTL_MS = 5 * 60 * 1_000

export interface UploadSessionRow {
  id: string
  ownerType: 'work' | 'site'
  ownerId: string
  ownerVersion: number
  mediaRole: MediaRole
  privateObjectKey: string
  expectedContentType: 'image/jpeg' | 'image/png' | 'image/webp'
  expectedBytes: number
  expectedContentMd5: string
  expectedSha256: string
  expectedWidth: number
  expectedHeight: number
  createdBy: string
  status: UploadSessionStatus
  assetId: string | null
  version: number
  failureCode: UploadFailureCode | null
  failureStage: UploadFailureStage | null
  createdAt: number
  expiresAt: number
  updatedAt: number
}

export interface CreateUploadSessionInput {
  owner: UploadOwner
  mediaRole: MediaRole
  expected: {
    contentType: 'image/jpeg' | 'image/png' | 'image/webp'
    byteSize: number
    contentMd5: string
    sha256: string
    width: number
    height: number
  }
}

interface UploadSessionOptions {
  id?: string
  keyPrefix?: string
  now?: number
  objectToken?: string
}

const selectUploadSession = `
  SELECT
    id,
    owner_type AS ownerType,
    owner_id AS ownerId,
    owner_version AS ownerVersion,
    media_role AS mediaRole,
    private_object_key AS privateObjectKey,
    expected_content_type AS expectedContentType,
    expected_bytes AS expectedBytes,
    expected_content_md5 AS expectedContentMd5,
    expected_sha256 AS expectedSha256,
    expected_width AS expectedWidth,
    expected_height AS expectedHeight,
    created_by AS createdBy,
    status,
    asset_id AS assetId,
    version,
    failure_code AS failureCode,
    failure_stage AS failureStage,
    created_at AS createdAt,
    expires_at AS expiresAt,
    updated_at AS updatedAt
  FROM upload_sessions
`

const processTestRunId = randomBytes(8).toString('hex')

function keyPrefixFor(environment: RuntimeConfig['appEnv']) {
  if (environment === 'test') {
    return `test/${processTestRunId}`
  }
  return environment === 'production' ? 'prod' : 'dev'
}

function extensionFor(contentType: CreateUploadSessionInput['expected']['contentType']) {
  if (contentType === 'image/jpeg') {
    return 'jpg'
  }
  return contentType === 'image/png' ? 'png' : 'webp'
}

export function uploadSessionDto(row: UploadSessionRow): UploadSessionDto {
  return uploadSessionDtoSchema.parse({
    uploadSessionId: row.id,
    owner: {
      type: row.ownerType,
      id: row.ownerId,
    },
    ownerVersion: row.ownerVersion,
    mediaRole: row.mediaRole,
    expected: {
      contentType: row.expectedContentType,
      byteSize: row.expectedBytes,
      contentMd5: row.expectedContentMd5,
      sha256: row.expectedSha256,
      width: row.expectedWidth,
      height: row.expectedHeight,
    },
    createdBy: row.createdBy,
    status: row.status,
    version: row.version,
    failureCode: row.failureCode,
    failureStage: row.failureStage,
    assetId: row.assetId,
    createdAt: new Date(row.createdAt).toISOString(),
    expiresAt: new Date(row.expiresAt).toISOString(),
  })
}

export function findUploadSession(sqlite: Database.Database, id: string) {
  return sqlite.prepare(`${selectUploadSession} WHERE id = ?`)
    .get(id) as UploadSessionRow | undefined
}

export function requireUploadSession(sqlite: Database.Database, id: string) {
  const row = findUploadSession(sqlite, id)
  if (!row) {
    throw new ServiceError(404, 'NOT_FOUND', 'Upload session was not found.')
  }
  return row
}

export function assertUploadSessionVersion(row: UploadSessionRow, expectedVersion: number) {
  if (row.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
}

export function assertUploadOwner(
  sqlite: Database.Database,
  owner: UploadOwner,
  mediaRole: MediaRole,
) {
  if (owner.type === 'site') {
    const validRole = owner.id === 'home'
      ? mediaRole.startsWith('home_hero_')
      : owner.id === 'branding' && mediaRole === 'watermark_logo'
    if (!validRole) {
      throw new ServiceError(400, 'VALIDATION_ERROR', 'Media role does not match owner.')
    }
    const current = sqlite.prepare(owner.id === 'home' ? `
      SELECT version FROM site_content WHERE id = 'site'
    ` : `
      SELECT version FROM site_branding WHERE id = 'site'
    `).pluck().get()
    const version = current === undefined ? 0 : Number(current)
    if (version !== owner.expectedVersion) {
      throw new ServiceError(409, 'CONFLICT', 'Owner version is stale.')
    }
    return
  }

  if (!['design_sheet', 'studio_photo'].includes(mediaRole)) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Media role does not match owner.')
  }
  const work = sqlite.prepare(`
    SELECT version, purpose FROM works WHERE id = ?
  `).get(owner.id) as { version: number, purpose: string } | undefined
  if (!work) {
    throw new ServiceError(404, 'NOT_FOUND', 'Owner was not found.')
  }
  if (work.version !== owner.expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Owner version is stale.')
  }
  if (mediaRole === 'design_sheet' && work.purpose !== 'adoption') {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Design sheets require an adoption work.')
  }
}

async function cleanupExactObject(
  sqlite: Database.Database,
  storage: MediaStorage,
  row: UploadSessionRow,
  now: number,
) {
  try {
    await storage.deletePrivate(row.privateObjectKey)
    return true
  }
  catch {
    sqlite.prepare(`
      UPDATE upload_sessions
      SET
        status = 'FAILED',
        failure_code = 'UPLOAD_CLEANUP_FAILED',
        failure_stage = 'CLEANUP',
        version = version + 1,
        updated_at = ?
      WHERE id = ? AND asset_id IS NULL
    `).run(now, row.id)
    return false
  }
}

export async function createUploadSession(
  sqlite: Database.Database,
  storage: MediaStorage,
  config: Pick<RuntimeConfig, 'appEnv'>,
  actorUserId: string,
  input: CreateUploadSessionInput,
  options: UploadSessionOptions = {},
): Promise<{ session: UploadSessionDto, upload: ConditionalPutDto }> {
  assertUploadOwner(sqlite, input.owner, input.mediaRole)
  const id = options.id ?? randomUUID()
  const now = options.now ?? Date.now()
  const expiresAt = now + UPLOAD_SESSION_TTL_MS
  const prefix = options.keyPrefix ?? keyPrefixFor(config.appEnv)
  const objectToken = options.objectToken ?? randomBytes(24).toString('hex')
  const privateObjectKey = `${prefix}/original/${id}/${objectToken}.${extensionFor(input.expected.contentType)}`
  let upload: ConditionalPutDto

  try {
    upload = await storage.signConditionalPut({
      contentMd5: input.expected.contentMd5,
      contentType: input.expected.contentType,
      expiresAt,
      objectKey: privateObjectKey,
      sha256: input.expected.sha256,
    })
  }
  catch {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Upload service is unavailable.')
  }

  try {
    sqlite.prepare(`
      INSERT INTO upload_sessions (
        id, owner_type, owner_id, owner_version, media_role,
        private_object_key, expected_content_type, expected_bytes,
        expected_content_md5, expected_sha256, expected_width,
        expected_height, created_by, created_at, expires_at, updated_at
      ) VALUES (
        @id, @ownerType, @ownerId, @ownerVersion, @mediaRole,
        @privateObjectKey, @expectedContentType, @expectedBytes,
        @expectedContentMd5, @expectedSha256, @expectedWidth,
        @expectedHeight, @createdBy, @createdAt, @expiresAt, @updatedAt
      )
    `).run({
      id,
      ownerType: input.owner.type,
      ownerId: input.owner.id,
      ownerVersion: input.owner.expectedVersion,
      mediaRole: input.mediaRole,
      privateObjectKey,
      expectedContentType: input.expected.contentType,
      expectedBytes: input.expected.byteSize,
      expectedContentMd5: input.expected.contentMd5,
      expectedSha256: input.expected.sha256,
      expectedWidth: input.expected.width,
      expectedHeight: input.expected.height,
      createdBy: actorUserId,
      createdAt: now,
      expiresAt,
      updatedAt: now,
    })
  }
  catch (error) {
    if (String(error).includes('upload session owner is stale')) {
      throw new ServiceError(409, 'CONFLICT', 'Owner version is stale.')
    }
    throw error
  }

  return {
    session: uploadSessionDto(requireUploadSession(sqlite, id)),
    upload,
  }
}

export async function getUploadSession(
  sqlite: Database.Database,
  storage: MediaStorage,
  id: string,
  now = Date.now(),
) {
  let row = requireUploadSession(sqlite, id)
  if (row.status === 'AWAITING_UPLOAD' && row.expiresAt <= now) {
    sqlite.prepare(`
      UPDATE upload_sessions
      SET status = 'EXPIRED', version = version + 1, updated_at = ?
      WHERE id = ? AND status = 'AWAITING_UPLOAD' AND version = ?
    `).run(now, row.id, row.version)
    row = requireUploadSession(sqlite, id)
    await cleanupExactObject(sqlite, storage, row, now)
    row = requireUploadSession(sqlite, id)
  }
  return uploadSessionDto(row)
}

export async function cancelUploadSession(
  sqlite: Database.Database,
  storage: MediaStorage,
  id: string,
  expectedVersion: number,
  now = Date.now(),
) {
  const row = requireUploadSession(sqlite, id)
  assertUploadSessionVersion(row, expectedVersion)
  if (row.status === 'COMPLETED' || row.status === 'VALIDATING') {
    throw new ServiceError(409, 'CONFLICT', 'Upload session cannot be cancelled.')
  }
  if (!['CANCELLED', 'EXPIRED'].includes(row.status)) {
    sqlite.prepare(`
      UPDATE upload_sessions
      SET
        status = 'CANCELLED', failure_code = NULL, failure_stage = NULL,
        version = version + 1, updated_at = ?
      WHERE id = ? AND version = ? AND asset_id IS NULL
    `).run(now, id, expectedVersion)
  }
  const updated = requireUploadSession(sqlite, id)
  if (!await cleanupExactObject(sqlite, storage, updated, now)) {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Upload cleanup failed.')
  }
  return uploadSessionDto(requireUploadSession(sqlite, id))
}

export async function retryUploadSession(
  sqlite: Database.Database,
  storage: MediaStorage,
  config: Pick<RuntimeConfig, 'appEnv'>,
  actorUserId: string,
  id: string,
  expectedVersion: number,
  now = Date.now(),
) {
  let row = requireUploadSession(sqlite, id)
  assertUploadSessionVersion(row, expectedVersion)
  if (row.status === 'AWAITING_UPLOAD' && row.expiresAt <= now) {
    await getUploadSession(sqlite, storage, id, now)
    row = requireUploadSession(sqlite, id)
  }
  if (!['FAILED', 'CANCELLED', 'EXPIRED'].includes(row.status)) {
    throw new ServiceError(409, 'CONFLICT', 'Upload session is not retryable.')
  }
  if (!await cleanupExactObject(sqlite, storage, row, now)) {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Upload cleanup failed.')
  }

  return createUploadSession(
    sqlite,
    storage,
    config,
    actorUserId,
    {
      owner: {
        type: row.ownerType,
        id: row.ownerId,
        expectedVersion: row.ownerVersion,
      } as UploadOwner,
      mediaRole: row.mediaRole,
      expected: {
        contentType: row.expectedContentType,
        byteSize: row.expectedBytes,
        contentMd5: row.expectedContentMd5,
        sha256: row.expectedSha256,
        width: row.expectedWidth,
        height: row.expectedHeight,
      },
    },
    { now },
  )
}
