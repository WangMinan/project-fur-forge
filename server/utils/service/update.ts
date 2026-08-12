import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { adminUpdateDtoSchema } from '../../../shared/schemas/update'
import type {
  AdminUpdateDto,
  UpdateFields,
} from '../../../shared/types/contracts'
import {
  deleteUpdateRow,
  findUpdate,
  insertUpdate,
  insertUpdateAuditLog,
  listUpdates,
  publishUpdateRow,
  type UpdateRow,
  unpublishUpdateRow,
  updateUpdateRow,
} from '../repository/update-repository'
import { ServiceError } from '../service-error'

function toAdminUpdate(row: UpdateRow): AdminUpdateDto {
  return adminUpdateDtoSchema.parse({
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    publicationStatus: row.publicationStatus,
    publishedAt: row.publishedAt === null
      ? null
      : new Date(row.publishedAt).toISOString(),
    version: row.version,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  })
}

function requireUpdate(sqlite: Database.Database, id: string) {
  const row = findUpdate(sqlite, id)
  if (!row) {
    throw new ServiceError(
      404,
      'NOT_FOUND',
      'Update was not found.',
      'RESOURCE_NOT_FOUND',
    )
  }
  return row
}

function audit(
  sqlite: Database.Database,
  actorUserId: string,
  action: string,
  updateId: string,
  now: number,
) {
  insertUpdateAuditLog(sqlite, {
    action,
    actorUserId,
    id: randomUUID(),
    updateId,
  }, now)
}

function assertVersion(row: UpdateRow, expectedVersion: number) {
  if (row.version !== expectedVersion) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Resource version is stale.',
      'VERSION_CONFLICT',
    )
  }
}

function assertChanged(changes: number) {
  if (changes !== 1) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Resource version is stale.',
      'VERSION_CONFLICT',
    )
  }
}

export function listAdminUpdates(sqlite: Database.Database) {
  return listUpdates(sqlite).map(toAdminUpdate)
}

export function getAdminUpdate(sqlite: Database.Database, id: string) {
  return toAdminUpdate(requireUpdate(sqlite, id))
}

export function createUpdate(
  sqlite: Database.Database,
  input: UpdateFields,
  actorUserId: string,
  now = Date.now(),
) {
  const id = randomUUID()
  sqlite.transaction(() => {
    insertUpdate(sqlite, { ...input, id }, now)
    audit(sqlite, actorUserId, 'UPDATE_CREATE', id, now)
  })()
  return getAdminUpdate(sqlite, id)
}

export function editUpdate(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  input: UpdateFields,
  actorUserId: string,
  now = Date.now(),
) {
  const current = requireUpdate(sqlite, id)
  assertVersion(current, expectedVersion)
  sqlite.transaction(() => {
    assertChanged(updateUpdateRow(sqlite, id, expectedVersion, input, now))
    audit(sqlite, actorUserId, 'UPDATE_EDIT', id, now)
  })()
  return getAdminUpdate(sqlite, id)
}

export function publishUpdate(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  const current = requireUpdate(sqlite, id)
  assertVersion(current, expectedVersion)
  if (current.publicationStatus === 'published') {
    throw new ServiceError(409, 'CONFLICT', 'Update is already published.')
  }
  sqlite.transaction(() => {
    assertChanged(publishUpdateRow(sqlite, id, expectedVersion, now))
    audit(sqlite, actorUserId, 'UPDATE_PUBLISH', id, now)
  })()
  return getAdminUpdate(sqlite, id)
}

export function unpublishUpdate(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  const current = requireUpdate(sqlite, id)
  assertVersion(current, expectedVersion)
  if (current.publicationStatus !== 'published') {
    throw new ServiceError(409, 'CONFLICT', 'Update is not published.')
  }
  sqlite.transaction(() => {
    assertChanged(unpublishUpdateRow(sqlite, id, expectedVersion, now))
    audit(sqlite, actorUserId, 'UPDATE_UNPUBLISH', id, now)
  })()
  return getAdminUpdate(sqlite, id)
}

export function deleteUpdate(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  const current = requireUpdate(sqlite, id)
  assertVersion(current, expectedVersion)
  sqlite.transaction(() => {
    assertChanged(deleteUpdateRow(sqlite, id, expectedVersion))
    audit(sqlite, actorUserId, 'UPDATE_DELETE', id, now)
  })()
  return { id }
}
