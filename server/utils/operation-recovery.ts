import type Database from 'better-sqlite3'
import type { MediaStorage } from './media-storage'
import {
  failUnrecoverableOperation,
  findRecoverableOperations,
  setOperationRecoveryReason,
} from './operation-lease'
import type { OperationTable } from './operation-lease'
import { safeLog } from './safe-log'

/**
 * T34-F5 启动恢复。
 *
 * 在 runtime/database 配置之后运行，扫描非终止 operation：
 * - lease 已过期 → 视为上一个进程被杀，尝试安全续做；
 * - 数据库业务状态已经是目标状态 → 标记 ALREADY_COMMITTED 并收尾；
 * - 不能安全续做 → 转为明确可恢复失败（FAILED + recovery_reason），
 *   这样运行态任务不会永久阻塞新操作。
 *
 * 并发受限：一次只推进少量任务，避免重启瞬间打满 OSS。
 * 日志只写 id/attempt/状态，不写 Object Key、签名 URL 或凭据。
 */

export const RECOVERY_CONCURRENCY = 2
export const RECOVERY_SCAN_LIMIT = 50

export interface RecoveryOutcome {
  operationId: string
  outcome: 'resumed' | 'failed' | 'skipped'
  table: OperationTable
}

export interface RecoverySummary {
  failed: number
  resumed: number
  scanned: number
  skipped: number
}

/** 每类 operation 的续做策略由拥有它的模块提供，避免 recovery 反向依赖业务细节。 */
export interface OperationResumer {
  /** 不能续做时写入的失败阶段与错误码。 */
  failure: (row: { id: string, status: string }) => {
    code: string
    stage: string
  }
  /** 返回 false 表示这条记录不属于本 resumer。 */
  matches: (sqlite: Database.Database, operationId: string) => boolean
  /** 尝试续做；抛错视为不可续做。 */
  resume: (
    sqlite: Database.Database,
    storage: MediaStorage,
    operationId: string,
    now: number,
  ) => Promise<void>
  table: OperationTable
}

const resumers: OperationResumer[] = []

/** 由各 runner 模块在导入时注册，保持 recovery 与业务模块单向依赖。 */
export function registerOperationResumer(resumer: OperationResumer) {
  if (!resumers.some(existing => existing === resumer)) {
    resumers.push(resumer)
  }
}

export function registeredOperationResumers() {
  return [...resumers]
}

async function inBatches<T>(
  items: readonly T[],
  size: number,
  handler: (item: T) => Promise<void>,
) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(handler))
  }
}

export async function recoverPendingOperations(options: {
  now?: number
  sqlite: Database.Database
  storage: MediaStorage
}): Promise<RecoverySummary> {
  const { sqlite, storage } = options
  const now = options.now ?? Date.now()
  const summary: RecoverySummary = {
    scanned: 0,
    resumed: 0,
    failed: 0,
    skipped: 0,
  }

  const tables = [
    ...new Set(resumers.map(resumer => resumer.table)),
  ] as OperationTable[]

  for (const table of tables) {
    const rows = findRecoverableOperations(
      sqlite,
      table,
      now,
      RECOVERY_SCAN_LIMIT,
    )
    summary.scanned += rows.length
    const candidates = resumers.filter(resumer => resumer.table === table)

    await inBatches(rows, RECOVERY_CONCURRENCY, async (row) => {
      const resumer = candidates.find(entry => entry.matches(sqlite, row.id))
      if (!resumer) {
        summary.skipped += 1
        return
      }
      setOperationRecoveryReason(
        sqlite,
        table,
        row.id,
        row.leaseOwner ? 'LEASE_EXPIRED' : 'STARTUP_SCAN',
        now,
      )
      try {
        await resumer.resume(sqlite, storage, row.id, now)
        summary.resumed += 1
        safeLog('info', 'Recovered pending operation after restart.', {
          attempt: row.attempt,
          operationId: row.id,
          table,
        })
      }
      catch (error) {
        const failure = resumer.failure(row)
        const changed = failUnrecoverableOperation(
          sqlite,
          table,
          row.id,
          failure.stage,
          failure.code,
          'NOT_RESUMABLE',
          now,
        )
        if (changed) {
          summary.failed += 1
        }
        else {
          summary.skipped += 1
        }
        safeLog('warn', 'Pending operation could not be resumed.', {
          attempt: row.attempt,
          errorName: (error as { name?: unknown }).name,
          operationId: row.id,
          table,
        })
      }
    })
  }

  safeLog('info', 'Operation recovery scan finished.', { ...summary })
  return summary
}
