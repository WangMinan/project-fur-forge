import { randomUUID } from 'node:crypto'
import {
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import {
  claimOperationLease,
  findRecoverableOperations,
  failUnrecoverableOperation,
  heartbeatOperationLease,
  holdsOperationLease,
  OPERATION_LEASE_TTL_MS,
  operationLeaseOwner,
  releaseOperationLease,
  resetOperationLeaseOwner,
} from '../../server/utils/operation-lease'
import {
  recoverPendingOperations,
  registerOperationResumer,
} from '../../server/utils/operation-recovery'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const NOW = Date.UTC(2026, 7, 6)
const WORK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

let directory: string
let sqlite: Database.Database

function insertOperation(status = 'GENERATING_PUBLIC') {
  const id = randomUUID()
  sqlite.prepare(`
    INSERT INTO publication_operations (
      id, operation_type, entity_type, entity_id, requested_version,
      status, started_at, updated_at
    ) VALUES (?, 'PUBLISH', 'WORK', ?, 1, ?, ?, ?)
  `).run(id, WORK_ID, status, NOW, NOW)
  return id
}

function row(id: string) {
  return sqlite.prepare(`
    SELECT status, attempt, lease_owner AS leaseOwner,
           lease_expires_at AS leaseExpiresAt, heartbeat_at AS heartbeatAt,
           recovery_reason AS recoveryReason, version
    FROM publication_operations WHERE id = ?
  `).get(id) as {
    attempt: number
    heartbeatAt: number | null
    leaseExpiresAt: number | null
    leaseOwner: string | null
    recoveryReason: string | null
    status: string
    version: number
  }
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-lease-'))
  const databaseFile = resolve(directory, 'studio.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  resetOperationLeaseOwner()
})

afterEach(() => {
  sqlite.close()
  resetOperationLeaseOwner()
  rmSync(directory, { force: true, recursive: true })
})

describe('operation lease, heartbeat and recovery', () => {
  it('claims a free lease, increments attempt and records the process owner', () => {
    const id = insertOperation()
    expect(row(id).attempt).toBe(0)

    const lease = claimOperationLease(sqlite, 'publication_operations', id, NOW)

    expect(lease).toMatchObject({
      attempt: 1,
      operationId: id,
      owner: operationLeaseOwner(),
    })
    const claimed = row(id)
    expect(claimed.attempt).toBe(1)
    expect(claimed.leaseOwner).toBe(operationLeaseOwner())
    expect(claimed.leaseExpiresAt).toBe(NOW + OPERATION_LEASE_TTL_MS)
    expect(claimed.heartbeatAt).toBe(NOW)
    // lease owner 是进程实例标识，不是任何 Secret。
    expect(claimed.leaseOwner).not.toMatch(/secret|token|key/iu)
  })

  it('refuses a second runner while the lease is live, and allows takeover after expiry', () => {
    const id = insertOperation()
    const first = claimOperationLease(sqlite, 'publication_operations', id, NOW)!

    // 另一个进程实例：同一 operation 不能被两个 runner 同时接管。
    resetOperationLeaseOwner('other-host/999/deadbeef')
    expect(claimOperationLease(sqlite, 'publication_operations', id, NOW))
      .toBeNull()
    expect(row(id).leaseOwner).toBe(first.owner)

    // lease 过期后才允许接管，且 attempt 递增。
    const takeover = claimOperationLease(
      sqlite,
      'publication_operations',
      id,
      NOW + OPERATION_LEASE_TTL_MS + 1,
    )
    expect(takeover).toMatchObject({ attempt: 2, owner: 'other-host/999/deadbeef' })
    // 原持有者立即失去 lease，不得继续提交。
    expect(holdsOperationLease(sqlite, first)).toBe(false)
    expect(heartbeatOperationLease(sqlite, first, NOW + OPERATION_LEASE_TTL_MS + 2))
      .toBe(false)
  })

  it('never claims a terminal operation', () => {
    for (const status of ['DONE', 'FAILED']) {
      const id = randomUUID()
      sqlite.prepare(`
        INSERT INTO publication_operations (
          id, operation_type, entity_type, entity_id, requested_version,
          status, internal_error_code, failure_stage, started_at, updated_at
        ) VALUES (?, 'PUBLISH', 'WORK', ?, 1, ?, ?, ?, ?, ?)
      `).run(
        id,
        WORK_ID,
        status,
        status === 'FAILED' ? 'PUBLICATION_FAILED' : null,
        status === 'FAILED' ? 'COMMITTING' : null,
        NOW,
        NOW,
      )
      expect(claimOperationLease(sqlite, 'publication_operations', id, NOW))
        .toBeNull()
    }
  })

  it('extends the lease on heartbeat and carries operation id, attempt and owner', () => {
    const id = insertOperation()
    const lease = claimOperationLease(sqlite, 'publication_operations', id, NOW)!

    expect(heartbeatOperationLease(sqlite, lease, NOW + 5_000)).toBe(true)

    const beaten = row(id)
    expect(beaten.heartbeatAt).toBe(NOW + 5_000)
    expect(beaten.leaseExpiresAt).toBe(NOW + 5_000 + OPERATION_LEASE_TTL_MS)
    expect(beaten.attempt).toBe(lease.attempt)
    expect(beaten.leaseOwner).toBe(lease.owner)
  })

  it('releases the lease so the operation can be taken over again', () => {
    const id = insertOperation()
    const lease = claimOperationLease(sqlite, 'publication_operations', id, NOW)!

    releaseOperationLease(sqlite, lease, NOW + 1_000)

    expect(row(id).leaseOwner).toBeNull()
    resetOperationLeaseOwner('third-host/7/aaaaaaaa')
    expect(claimOperationLease(sqlite, 'publication_operations', id, NOW + 2_000))
      .toMatchObject({ attempt: 2 })
  })

  it('lists only non-terminal operations whose lease is absent or expired', () => {
    const free = insertOperation()
    const held = insertOperation()
    claimOperationLease(sqlite, 'publication_operations', held, NOW)

    const live = findRecoverableOperations(sqlite, 'publication_operations', NOW)
    expect(live.map(entry => entry.id)).toEqual([free])

    const afterExpiry = findRecoverableOperations(
      sqlite,
      'publication_operations',
      NOW + OPERATION_LEASE_TTL_MS + 1,
    )
    expect(afterExpiry.map(entry => entry.id).sort())
      .toEqual([free, held].sort())
  })

  it('turns an unrecoverable operation into an explicit recoverable failure once', () => {
    const id = insertOperation()

    expect(failUnrecoverableOperation(
      sqlite,
      'publication_operations',
      id,
      'GENERATING_PUBLIC',
      'PUBLICATION_INTERRUPTED',
      'NOT_RESUMABLE',
      NOW,
    )).toBe(true)

    expect(row(id)).toMatchObject({
      status: 'FAILED',
      recoveryReason: 'NOT_RESUMABLE',
      leaseOwner: null,
    })
    // 幂等：已终态的记录不再被改写。
    expect(failUnrecoverableOperation(
      sqlite,
      'publication_operations',
      id,
      'COMMITTING',
      'OTHER_CODE',
      'STARTUP_SCAN',
      NOW + 1,
    )).toBe(false)
    expect(row(id).recoveryReason).toBe('NOT_RESUMABLE')
  })

  it('resumes leased operations at startup and fails the ones that cannot continue', async () => {
    const resumable = insertOperation()
    const stuck = insertOperation()
    // 上一个进程持有过 lease 后被杀：lease 已过期。
    claimOperationLease(sqlite, 'publication_operations', resumable, NOW)
    claimOperationLease(sqlite, 'publication_operations', stuck, NOW)
    resetOperationLeaseOwner('restarted-host/1/cafebabe')

    const resumed: string[] = []
    registerOperationResumer({
      table: 'publication_operations',
      matches: (_sqlite, operationId) =>
        operationId === resumable || operationId === stuck,
      failure: () => ({
        stage: 'GENERATING_PUBLIC',
        code: 'PUBLICATION_INTERRUPTED',
      }),
      resume: async (_sqlite, _storage, operationId) => {
        if (operationId === stuck) {
          throw new Error('cannot continue safely')
        }
        resumed.push(operationId)
        sqlite.prepare(`
          UPDATE publication_operations
          SET status = 'DONE', lease_owner = NULL, lease_expires_at = NULL,
              version = version + 1, updated_at = ?, completed_at = ?
          WHERE id = ?
        `).run(NOW, NOW, operationId)
      },
    })

    const summary = await recoverPendingOperations({
      sqlite,
      storage: new FakeMediaStorage(),
      now: NOW + OPERATION_LEASE_TTL_MS + 1,
    })

    expect(resumed).toEqual([resumable])
    expect(summary.resumed).toBeGreaterThanOrEqual(1)
    expect(summary.failed).toBeGreaterThanOrEqual(1)
    expect(row(resumable).status).toBe('DONE')
    // 不能安全续做的任务转为明确失败，因此不会永久阻塞新操作。
    expect(row(stuck)).toMatchObject({
      status: 'FAILED',
      recoveryReason: 'NOT_RESUMABLE',
    })
    expect(findRecoverableOperations(
      sqlite,
      'publication_operations',
      NOW + OPERATION_LEASE_TTL_MS + 2,
    )).toEqual([])
  })
})
