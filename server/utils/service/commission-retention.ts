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
  claimCommissionDeletionTarget,
  COMMISSION_DELETION_HEARTBEAT_MS,
  deleteCommissionTargetRows,
  findCommissionDeletionTarget,
  holdsCommissionDeletionLease,
  insertCommissionDeletionFailureAudit,
  listCommissionRetentionRows,
  releaseCommissionDeletionLease,
  renewCommissionDeletionLease,
} from '../repository/commission-repository'
import type { CommissionDeletionLease, CommissionDeletionTarget } from '../repository/commission-repository'
import { ServiceError } from '../service-error'
import { safeLog } from '../safe-log'

import { fenceCommissionEmailsForDeletion } from '../repository/commission-email'

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
  const initial = findCommissionDeletionTarget(options.sqlite, options.identifier)
  if (!initial) return emptyResult('already_deleted')
  const id = initial.submission.id
  assertCommissionDeletionUnlocked(id)
  deletionLocks.add(id)
  const startedAt = Date.now()
  const now = () => (options.now ?? startedAt) + Date.now() - startedAt
  let lease: CommissionDeletionLease | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let completed = false
  try {
    const plan = await buildDeletionPlan(
      options.sqlite,
      options.objectStore,
      id,
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
    const target = plan.target
    const claimed = options.sqlite.transaction(() => {
      const acquired = claimCommissionDeletionTarget(options.sqlite, target, now())
      if (!acquired) {
        throw new ServiceError(409, 'CONFLICT', 'Commission changed or deletion is already in progress.', 'COMMISSION_DELETE_BLOCKED')
      }
      fenceCommissionEmailsForDeletion(options.sqlite, id, now())
      return acquired
    }).immediate()
    lease = claimed
    const claimedTarget = { ...target, submission: { ...target.submission, version: claimed.version } }
    let lost = false
    const ownershipError = () => new ServiceError(409, 'CONFLICT', 'Commission deletion ownership has changed.', 'COMMISSION_DELETE_IN_PROGRESS')
    const assertOwner = () => {
      if (lost || !renewCommissionDeletionLease(options.sqlite, claimed, now())) {
        lost = true
        throw ownershipError()
      }
    }
    timer = setInterval(() => {
      try { assertOwner() }
      catch { lost = true }
    }, COMMISSION_DELETION_HEARTBEAT_MS)
    timer.unref()
    const submissionIdDigest = digestId(plan.target.submission.id)
    try {
      for (const key of plan.objectKeys) {
        assertOwner()
        await options.objectStore.deleteAll('private', key)
        assertOwner()
      }
      for (const key of plan.objectKeys) {
        assertOwner()
        const remaining = await options.objectStore.inspect('private', key)
        assertOwner()
        if (remaining.current
          || remaining.versions > 0
          || remaining.deleteMarkers > 0) {
          throw new Error('Commission object deletion did not converge.')
        }
      }
      deleteCommissionTargetRows(options.sqlite, claimedTarget, {
        actorUserId: options.actorUserId,
        auditId: randomUUID(),
        deletedAt: now(),
        submissionIdDigest,
      })
      completed = true
    }
    catch {
      let owned: boolean | undefined
      try {
        options.sqlite.transaction(() => {
          owned = holdsCommissionDeletionLease(options.sqlite, claimed, now())
          if (owned && !lost) insertCommissionDeletionFailureAudit(options.sqlite, {
            actorUserId: options.actorUserId,
            auditId: randomUUID(),
            createdAt: now(),
            submissionIdDigest,
          })
        }).immediate()
      }
      catch {
        // The original failure remains authoritative; never expose DB details.
      }
      if (lost || owned === false) throw ownershipError()
      throw new ServiceError(500, 'INTERNAL_ERROR', 'Commission deletion failed safely.')
    }
    return commissionDeletionResultDtoSchema.parse({
      ...plan.dto,
      status: 'deleted',
    })
  }
  finally {
    clearInterval(timer)
    if (lease && !completed) {
      try { releaseCommissionDeletionLease(options.sqlite, lease) }
      catch (error) {
        // An unavailable DB leaves an expiring lease, not a replacement for the original error.
        safeLog('warn', 'Commission deletion lease release failed.', { errorName: (error as Error)?.name })
      }
    }
    deletionLocks.delete(id)
  }
}
