import type Database from 'better-sqlite3'
import {
  heartbeatOperationLease,
  OPERATION_HEARTBEAT_INTERVAL_MS,
} from '../repository/operation-lease'
import type { OperationLease } from '../repository/operation-lease'

export interface OperationLeaseHeartbeat {
  assertActive: () => void
  heartbeat: () => void
}

function leaseHeartbeatError() {
  return new Error('Operation lease was lost during asynchronous work.')
}

/**
 * 在 runner 的长异步阶段持续续租。
 *
 * 定时心跳只记录 lease 丢失；调用方在每个不可取消的外部副作用完成后调用
 * `assertActive`，从而在写入进度或开始下一个副作用前停止。业务时间仍由 runner
 * 显式传入，心跳时间则始终使用真实墙钟时间。
 */
export async function withOperationLeaseHeartbeat<T>(
  sqlite: Database.Database,
  lease: OperationLease,
  task: (heartbeat: OperationLeaseHeartbeat) => Promise<T>,
): Promise<T> {
  let failure: Error | null = null

  const assertActive = () => {
    if (failure) {
      throw failure
    }
  }
  const heartbeat = () => {
    assertActive()
    try {
      if (!heartbeatOperationLease(sqlite, lease)) {
        failure = leaseHeartbeatError()
      }
    }
    catch (error) {
      failure = error instanceof Error ? error : leaseHeartbeatError()
    }
    assertActive()
  }

  heartbeat()
  const timer = setInterval(() => {
    try {
      heartbeat()
    }
    catch {
      // task 在下一个显式边界抛出同一个失败；timer 回调不能产生未处理异常。
    }
  }, OPERATION_HEARTBEAT_INTERVAL_MS)
  timer.unref()

  try {
    let result: T
    try {
      result = await task({ assertActive, heartbeat })
    }
    catch (error) {
      assertActive()
      throw error
    }
    heartbeat()
    return result
  }
  finally {
    clearInterval(timer)
  }
}
