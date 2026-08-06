import Database from 'better-sqlite3'
import {
  DATABASE_MIGRATIONS_FOLDER,
  migrationState,
  resolveDatabaseFile,
} from '../database'
import { getRuntimeConfig } from '../runtime-config'
import { safeLog } from '../safe-log'

export type ReadinessCheck =
  | 'baselineRecords'
  | 'databaseOpen'
  | 'migrationsCurrent'

export interface ReadinessResult {
  checks: Record<ReadinessCheck, boolean>
  ready: boolean
}

/**
 * T34-F6 readiness：数据库可打开、迁移历史严格匹配、必要基础记录存在。
 *
 * 迁移检查复用 `migrationState`（与 `assertDatabaseMigrated` 和恢复校验同一
 * 实现）：同时比较数量、顺序、created_at/folderMillis 与 hash。只比较数量会
 * 让"迁移条数相同但历史不同"的数据库错误地报告 ready。
 *
 * 刻意不探测远端 OSS：readiness 会被反复调用，昂贵的外部探测放在 preflight
 * 与启动阶段。失败细节只进脱敏日志，响应体不含路径、SQL、Secret 或异常栈。
 */
export function evaluateReadiness(options: {
  /** 仅测试传入：避免为了切换数据库而给运行配置加可重置的生产接口。 */
  databaseFile?: string
} = {}): ReadinessResult {
  const checks: Record<ReadinessCheck, boolean> = {
    databaseOpen: false,
    migrationsCurrent: false,
    baselineRecords: false,
  }

  let sqlite: Database.Database | undefined
  try {
    const databaseFile = options.databaseFile
      ?? resolveDatabaseFile(getRuntimeConfig())
    sqlite = new Database(databaseFile, {
      fileMustExist: true,
      readonly: true,
    })
    checks.databaseOpen = true

    // complete = 历史逐条匹配（顺序 + folderMillis + hash）且数量一致。
    checks.migrationsCurrent = migrationState(
      sqlite,
      DATABASE_MIGRATIONS_FOLDER,
    ).complete

    // 基础记录：单例站点内容与品牌行必须已由迁移种入。
    const siteContent = sqlite.prepare(`
      SELECT count(*) FROM site_content WHERE id = 'site'
    `).pluck().get()
    const siteBranding = sqlite.prepare(`
      SELECT count(*) FROM site_branding WHERE id = 'site'
    `).pluck().get()
    checks.baselineRecords = Number(siteContent) === 1
      && Number(siteBranding) === 1
  }
  catch (error) {
    safeLog('warn', 'Readiness check failed.', {
      errorName: (error as { name?: unknown }).name,
    })
  }
  finally {
    sqlite?.close()
  }

  return {
    checks,
    ready: Object.values(checks).every(Boolean),
  }
}
