import Database from 'better-sqlite3'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import {
  DATABASE_MIGRATIONS_FOLDER,
  resolveDatabaseFile,
} from './database'
import { getRuntimeConfig } from './runtime-config'
import { safeLog } from './safe-log'

export type ReadinessCheck =
  | 'baselineRecords'
  | 'databaseOpen'
  | 'migrationsCurrent'

export interface ReadinessResult {
  checks: Record<ReadinessCheck, boolean>
  ready: boolean
}

/**
 * T34-F6 readiness：真正检查数据库可打开、迁移版本匹配、必要基础记录存在。
 *
 * 刻意不探测远端 OSS：readiness 会被反复调用，昂贵的外部探测放在 preflight
 * 与启动阶段。失败细节只进脱敏日志，响应体不含路径、SQL、Secret 或异常栈。
 */
export function evaluateReadiness(): ReadinessResult {
  const checks: Record<ReadinessCheck, boolean> = {
    databaseOpen: false,
    migrationsCurrent: false,
    baselineRecords: false,
  }

  let sqlite: Database.Database | undefined
  try {
    const databaseFile = resolveDatabaseFile(getRuntimeConfig())
    sqlite = new Database(databaseFile, {
      fileMustExist: true,
      readonly: true,
    })
    checks.databaseOpen = true

    const expected = readMigrationFiles({
      migrationsFolder: DATABASE_MIGRATIONS_FOLDER,
    })
    const appliedCount = Number(sqlite.prepare(`
      SELECT count(*) FROM __drizzle_migrations
    `).pluck().get())
    checks.migrationsCurrent = appliedCount === expected.length

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
