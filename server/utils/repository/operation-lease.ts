import {
  hostname,
} from 'node:os'
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { safeLog } from '../safe-log'

/**
 * T34-F5 长任务 lease / heartbeat / attempt 仓储层。
 *
 * 这一层只做 SQL 与条件更新（CAS），不含业务规则、不做 OSS 调用。
 * 各持久 operation 表共用同一套语句，由表名参数区分。
 *
 * 边界：
 * - 抢占在单条 UPDATE ... WHERE 内完成，两个 runner 不可能同时持有同一 lease；
 * - lease_owner 是进程实例标识，不含任何 Secret；
 * - 提交必须带 status/version/attempt/lease_owner 的 CAS，不能只按 id 更新；
 * - 失去 lease 后 runner 不得继续提交。
 */

export const OPERATION_LEASE_TTL_MS = 60_000
/** 心跳间隔取 TTL 的三分之一：一次漏更新不会立刻掉 lease。 */
export const OPERATION_HEARTBEAT_INTERVAL_MS = Math.floor(
  OPERATION_LEASE_TTL_MS / 3,
)

/**
 * 共用同一组 lease/heartbeat 列的 operation 表。
 * 表名是本模块内的字面量联合，不来自请求输入，因此拼接进 SQL 是安全的。
 */
export type OperationTable =
  | 'publication_operations'
  | 'site_display_reconcile_operations'

export type OperationRecoveryReason =
  | 'LEASE_EXPIRED'
  | 'STARTUP_SCAN'
  | 'ALREADY_COMMITTED'
  | 'NOT_RESUMABLE'

/** 终态：不再被抢占，也不参与启动恢复。 */
export const TERMINAL_OPERATION_STATUSES = ['DONE', 'FAILED'] as const

export interface OperationLease {
  attempt: number
  expiresAt: number
  operationId: string
  owner: string
  table: OperationTable
}

export interface LeasableOperationRow {
  attempt: number
  heartbeatAt: number | null
  id: string
  leaseExpiresAt: number | null
  leaseOwner: string | null
  status: string
  version: number
}

let instanceId: string | undefined

/**
 * 进程实例标识：主机名 + pid + 随机后缀。
 * 同一主机重启后 pid 可能复用，随机后缀保证旧 lease 不会被误认为自己持有。
 */
export function operationLeaseOwner() {
  instanceId ??= `${hostname()}/${process.pid}/${randomUUID().slice(0, 8)}`
  return instanceId
}

/** 仅供测试重置进程身份，模拟“新进程接管”。 */
export function resetOperationLeaseOwner(owner?: string) {
  instanceId = owner
}

const terminalList = TERMINAL_OPERATION_STATUSES.map(status => `'${status}'`)
  .join(', ')

const leaseColumns = `
  id, status, version, attempt,
  lease_owner AS leaseOwner,
  lease_expires_at AS leaseExpiresAt,
  heartbeat_at AS heartbeatAt
`

export function findLeasableOperation(
  sqlite: Database.Database,
  table: OperationTable,
  operationId: string,
) {
  return sqlite.prepare(`
    SELECT ${leaseColumns} FROM ${table} WHERE id = ?
  `).get(operationId) as LeasableOperationRow | undefined
}

/**
 * 事务内抢占 lease：只有非终态、且 lease 为空或已过期、或本进程已持有的任务能取得。
 * 成功时 attempt +1 并写入新的 owner/到期时间/心跳。
 *
 * 返回 null 表示任务处于终态，或 lease 仍被另一个活跃 runner 持有。
 */
export function claimOperationLease(
  sqlite: Database.Database,
  table: OperationTable,
  operationId: string,
  now = Date.now(),
  ttlMs = OPERATION_LEASE_TTL_MS,
): OperationLease | null {
  const owner = operationLeaseOwner()
  const expiresAt = now + ttlMs
  return sqlite.transaction((): OperationLease | null => {
    const claimed = sqlite.prepare(`
      UPDATE ${table}
      SET attempt = attempt + 1, lease_owner = ?, lease_expires_at = ?,
          heartbeat_at = ?, next_retry_at = NULL,
          version = version + 1, updated_at = ?
      WHERE id = ?
        AND status NOT IN (${terminalList})
        AND (
          lease_owner IS NULL
          OR lease_owner = ?
          OR lease_expires_at IS NULL
          OR lease_expires_at <= ?
        )
    `).run(owner, expiresAt, now, now, operationId, owner, now)
    if (claimed.changes !== 1) {
      return null
    }
    const row = findLeasableOperation(sqlite, table, operationId)!
    return {
      attempt: row.attempt,
      expiresAt,
      operationId,
      owner,
      table,
    }
  })()
}

/**
 * 心跳：延长本进程持有的 lease。返回 false 表示 lease 已被别人接管或任务已终结，
 * 调用方必须立即停止后续提交。
 */
export function heartbeatOperationLease(
  sqlite: Database.Database,
  lease: OperationLease,
  now = Date.now(),
  ttlMs = OPERATION_LEASE_TTL_MS,
) {
  const expiresAt = now + ttlMs
  const beat = sqlite.prepare(`
    UPDATE ${lease.table}
    SET heartbeat_at = ?, lease_expires_at = ?, updated_at = ?
    WHERE id = ? AND lease_owner = ? AND attempt = ?
      AND status NOT IN (${terminalList})
  `).run(now, expiresAt, now, lease.operationId, lease.owner, lease.attempt)
  if (beat.changes === 1) {
    lease.expiresAt = expiresAt
    return true
  }
  safeLog('warn', 'Operation lease was lost before heartbeat.', {
    attempt: lease.attempt,
    operationId: lease.operationId,
    table: lease.table,
  })
  return false
}

/** 本进程是否仍持有 lease；提交前必须确认。 */
export function holdsOperationLease(
  sqlite: Database.Database,
  lease: OperationLease,
) {
  const row = findLeasableOperation(sqlite, lease.table, lease.operationId)
  return Boolean(
    row
    && row.leaseOwner === lease.owner
    && row.attempt === lease.attempt
    && !(TERMINAL_OPERATION_STATUSES as readonly string[]).includes(row.status),
  )
}

/**
 * lease CAS 断言：在提交事务内调用。
 * 抛错让外层事务回滚，避免失去 lease 的 runner 覆盖接管者的结果。
 */
export function assertOperationLease(
  sqlite: Database.Database,
  lease: OperationLease,
) {
  if (!holdsOperationLease(sqlite, lease)) {
    throw new Error('Operation lease is no longer held.')
  }
}

/** 释放 lease：任务进入终态或转交时清空 owner，便于后续接管与观察。 */
export function releaseOperationLease(
  sqlite: Database.Database,
  lease: OperationLease,
  now = Date.now(),
) {
  sqlite.prepare(`
    UPDATE ${lease.table}
    SET lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
    WHERE id = ? AND lease_owner = ?
  `).run(now, lease.operationId, lease.owner)
}

export function setOperationRecoveryReason(
  sqlite: Database.Database,
  table: OperationTable,
  operationId: string,
  reason: OperationRecoveryReason,
  now = Date.now(),
) {
  sqlite.prepare(`
    UPDATE ${table}
    SET recovery_reason = ?, updated_at = ? WHERE id = ?
  `).run(reason, now, operationId)
}

/**
 * 启动恢复候选：非终止任务，且 lease 为空或已过期。
 * 仍被活跃 runner 持有心跳的任务不在候选内，避免抢走正在推进的工作。
 */
export function findRecoverableOperations(
  sqlite: Database.Database,
  table: OperationTable,
  now = Date.now(),
  limit = 50,
) {
  return sqlite.prepare(`
    SELECT ${leaseColumns} FROM ${table}
    WHERE status NOT IN (${terminalList})
      AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
    ORDER BY started_at
    LIMIT ?
  `).all(now, limit) as LeasableOperationRow[]
}

/**
 * 无法安全续做时转为明确可恢复失败。
 * 只在非终态上生效，因此重复调用幂等；失败原因用于运维观察，不进公开响应。
 */
export function failUnrecoverableOperation(
  sqlite: Database.Database,
  table: OperationTable,
  operationId: string,
  stage: string,
  code: string,
  reason: OperationRecoveryReason,
  now = Date.now(),
) {
  const failed = sqlite.prepare(`
    UPDATE ${table}
    SET status = 'FAILED', failure_stage = ?, internal_error_code = ?,
        recovery_reason = ?, lease_owner = NULL, lease_expires_at = NULL,
        version = version + 1, updated_at = ?, completed_at = ?
    WHERE id = ? AND status NOT IN (${terminalList})
  `).run(stage, code, reason, now, now, operationId)
  return failed.changes === 1
}
