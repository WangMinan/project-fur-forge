import { createHash, randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  commissionDeletionResultDtoSchema,
  commissionRetentionCandidateDtoSchema,
} from '../../../shared/schemas/commission'
import type {
  CommissionDeletionBlocker,
  CommissionDeletionResultDto,
  CommissionRetentionCandidateDto,
} from '../../../shared/types/contracts'
import type { R3StageAObjectStore } from '../runner/r3-stage-a-retirement'
import {
  deleteCommissionTargetRows,
  findCommissionDeletionTarget,
  insertCommissionDeletionFailureAudit,
  listCommissionRetentionRows,
} from '../repository/commission-repository'
import type { CommissionDeletionTarget } from '../repository/commission-repository'
import { ServiceError } from '../service-error'

const HALF_YEAR_MS = 183 * 24 * 60 * 60 * 1_000
const deletionLocks = new Set<string>()

function digestId(id: string) {
  return createHash('sha256').update(id).digest('hex').slice(0, 16)
}

function maskReceipt(receiptCode: string) {
  return `${receiptCode.slice(0, 3)}…${receiptCode.slice(-3)}`
}

export function assertCommissionDeletionUnlocked(id: string) {
  if (deletionLocks.has(id)) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Commission deletion is already in progress.',
      'COMMISSION_DELETE_IN_PROGRESS',
    )
  }
}

export function listCommissionRetentionCandidates(
  sqlite: Database.Database,
  now = Date.now(),
): CommissionRetentionCandidateDto[] {
  return listCommissionRetentionRows(sqlite, now - HALF_YEAR_MS).map(row => (
    commissionRetentionCandidateDtoSchema.parse({
      submissionIdDigest: digestId(row.id),
      maskedReceiptCode: maskReceipt(row.receiptCode),
      status: row.status,
      createdAt: new Date(row.createdAt).toISOString(),
      handledAt: row.handledAt === null
        ? null
        : new Date(row.handledAt).toISOString(),
      reason: row.status === 'rejected'
        ? 'REJECTED_READY_FOR_DELETION'
        : 'STALE_PENDING_REVIEW',
    })
  ))
}

interface InternalDeletionPlan {
  dto: CommissionDeletionResultDto
  objectKeys: string[]
  target: CommissionDeletionTarget | null
}

function emptyResult(status: 'already_deleted' | 'blocked' | 'deleted' | 'ready') {
  return commissionDeletionResultDtoSchema.parse({
    status,
    databaseRows: {
      assets: 0,
      auditRelations: 0,
      submissions: 0,
      uploadSessions: 0,
      variants: 0,
    },
    privateObjects: {
      current: 0,
      deleteMarkers: 0,
      keys: 0,
      versions: 0,
    },
    blockers: [],
  })
}

function referenceCount(target: CommissionDeletionTarget) {
  return Object.values(target.references).reduce((total, value) => total + value, 0)
}

async function buildDeletionPlan(
  sqlite: Database.Database,
  objectStore: R3StageAObjectStore,
  identifier: string,
  allowNonRejected = false,
): Promise<InternalDeletionPlan> {
  const target = findCommissionDeletionTarget(sqlite, identifier)
  if (!target) {
    return { dto: emptyResult('already_deleted'), objectKeys: [], target: null }
  }
  const blockers: CommissionDeletionBlocker[] = []
  if (target.submission.status !== 'rejected' && !allowNonRejected) {
    blockers.push('STATUS_NOT_REJECTED')
  }
  if (!target.asset
    || target.asset.id !== target.submission.designAssetId
    || target.asset.role !== 'commission_design_reference') {
    blockers.push('ASSET_RELATION_INVALID')
  }
  if (target.sessions.length !== 1) {
    blockers.push('UPLOAD_SESSION_RELATION_INVALID')
  }
  if (target.variants.some(variant => (
    variant.storageScope !== 'PRIVATE'
    || variant.mediaRole !== 'commission_design_reference'
  ))) {
    blockers.push('PRIVATE_VARIANT_INVALID')
  }
  if (referenceCount(target) > 0) {
    blockers.push('EXTERNAL_REFERENCE_FOUND')
  }

  const objectKeys = [...new Set([
    ...(target.asset ? [target.asset.objectKey] : []),
    ...target.sessions.map(session => session.objectKey),
    ...target.variants.map(variant => variant.objectKey),
  ])]
  const privateObjects = {
    current: 0,
    deleteMarkers: 0,
    keys: objectKeys.length,
    versions: 0,
  }
  try {
    for (const key of objectKeys) {
      const inspected = await objectStore.inspect('private', key)
      privateObjects.current += inspected.current ? 1 : 0
      privateObjects.deleteMarkers += inspected.deleteMarkers
      privateObjects.versions += inspected.versions
    }
  }
  catch {
    blockers.push('STORAGE_INSPECTION_FAILED')
  }

  const uniqueBlockers = [...new Set(blockers)]
  return {
    dto: commissionDeletionResultDtoSchema.parse({
      status: uniqueBlockers.length === 0 ? 'ready' : 'blocked',
      databaseRows: {
        assets: target.asset ? 1 : 0,
        auditRelations: target.auditRows,
        submissions: 1,
        uploadSessions: target.sessions.length,
        variants: target.variants.length,
      },
      privateObjects,
      blockers: uniqueBlockers,
    }),
    objectKeys,
    target,
  }
}

export async function previewCommissionDeletion(options: {
  allowNonRejected?: boolean
  identifier: string
  objectStore: R3StageAObjectStore
  sqlite: Database.Database
}) {
  return (await buildDeletionPlan(
    options.sqlite,
    options.objectStore,
    options.identifier,
    options.allowNonRejected,
  )).dto
}

export async function executeCommissionDeletion(options: {
  actorUserId: string | null
  allowNonRejected?: boolean
  identifier: string
  now?: number
  objectStore: R3StageAObjectStore
  sqlite: Database.Database
}) {
  assertCommissionDeletionUnlocked(options.identifier)
  deletionLocks.add(options.identifier)
  const now = options.now ?? Date.now()
  try {
    const plan = await buildDeletionPlan(
      options.sqlite,
      options.objectStore,
      options.identifier,
      options.allowNonRejected,
    )
    if (!plan.target) {
      return plan.dto
    }
    if (plan.dto.status !== 'ready') {
      throw new ServiceError(
        409,
        'CONFLICT',
        'Commission deletion is blocked.',
        'COMMISSION_DELETE_BLOCKED',
      )
    }
    const submissionIdDigest = digestId(plan.target.submission.id)
    try {
      for (const key of plan.objectKeys) {
        await options.objectStore.deleteAll('private', key)
      }
      for (const key of plan.objectKeys) {
        const remaining = await options.objectStore.inspect('private', key)
        if (remaining.current
          || remaining.versions > 0
          || remaining.deleteMarkers > 0) {
          throw new Error('Commission object deletion did not converge.')
        }
      }
      deleteCommissionTargetRows(options.sqlite, plan.target, {
        actorUserId: options.actorUserId,
        auditId: randomUUID(),
        deletedAt: now,
        submissionIdDigest,
      })
    }
    catch {
      try {
        insertCommissionDeletionFailureAudit(options.sqlite, {
          actorUserId: options.actorUserId,
          auditId: randomUUID(),
          createdAt: now,
          submissionIdDigest,
        })
      }
      catch {
        // The original failure remains authoritative; never expose DB details.
      }
      throw new ServiceError(500, 'INTERNAL_ERROR', 'Commission deletion failed safely.')
    }
    return commissionDeletionResultDtoSchema.parse({
      ...plan.dto,
      status: 'deleted',
    })
  }
  finally {
    deletionLocks.delete(options.identifier)
  }
}
