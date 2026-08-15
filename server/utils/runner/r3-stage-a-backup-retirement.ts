import {
  existsSync,
  lstatSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path'
import Database from 'better-sqlite3'

export const R3_STAGE_A_BACKUP_CONFIRMATION = 'DELETE R3-A OLD APP BACKUPS'

type AppEnv = 'production' | 'test'

export function resolveR3StageABackupDirectory(
  appEnv: AppEnv,
  databaseFile: string,
) {
  return appEnv === 'production'
    ? resolve('/app/backups')
    : resolve(dirname(databaseFile), 'backups')
}

export function resolveR3StageABackupDirectories(
  appEnv: AppEnv,
  databaseFile: string,
) {
  return [...new Set([
    resolveR3StageABackupDirectory(appEnv, databaseFile),
    resolve(dirname(databaseFile), 'backups'),
  ])]
}

function applicationBackupFiles(directory: string, required: boolean) {
  if (!existsSync(directory)) {
    if (required) {
      throw new Error('Production app backup volume /app/backups is not mounted.')
    }
    return []
  }
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.db'))
    .map(entry => resolve(directory, entry.name))
}

export function countR3StageAApplicationBackups(
  appEnv: AppEnv,
  databaseFile: string,
) {
  return resolveR3StageABackupDirectories(appEnv, databaseFile)
    .reduce((count, directory, index) => count + applicationBackupFiles(
      directory,
      appEnv === 'production' && index === 0,
    ).length, 0)
}

function assertTestPath(path: string) {
  const root = resolve(tmpdir())
  const child = relative(root, path)
  if (child === '' || child.startsWith(`..${sep}`) || child === '..' || isAbsolute(child)) {
    throw new Error('R3-A test backup pruning requires system temporary paths.')
  }
}

function assertContractedDatabase(path: string, label: string) {
  if (!existsSync(path) || !lstatSync(path).isFile()) {
    throw new Error(`${label} is missing or is not a regular file.`)
  }
  const sqlite = new Database(path, { fileMustExist: true, readonly: true })
  try {
    if (sqlite.pragma('integrity_check', { simple: true }) !== 'ok') {
      throw new Error(`${label} integrity verification failed.`)
    }
    if ((sqlite.pragma('foreign_key_check') as unknown[]).length !== 0) {
      throw new Error(`${label} foreign-key verification failed.`)
    }
    const retiredTables = Number(sqlite.prepare(`
      SELECT COUNT(*) FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('updates', 'return_characters', 'return_photos')
    `).pluck().get() ?? 0)
    const schemaSql = String(sqlite.prepare(`
      SELECT COALESCE(group_concat(sql, ' '), '') FROM sqlite_master
      WHERE type IN ('table', 'trigger')
    `).pluck().get() ?? '').toLowerCase()
    const marker = Number(sqlite.prepare(`
      SELECT COUNT(*) FROM audit_logs
      WHERE action = 'R3_STAGE_A_OBJECT_CLEANUP' AND result = 'SUCCESS'
    `).pluck().get() ?? 0)
    const channels = JSON.parse(String(sqlite.prepare(`
      SELECT official_channels_json FROM site_content WHERE id = 'site'
    `).pluck().get() ?? 'null')) as unknown
    const platforms = Array.isArray(channels)
      ? channels.map(channel => (
          channel !== null && typeof channel === 'object' && 'platform' in channel
            ? (channel as { platform: unknown }).platform
            : null
        ))
      : []
    if (
      retiredTables !== 0
      || schemaSql.includes('return_photo')
      || schemaSql.includes('return-wall')
      || schemaSql.includes('return_character')
      || schemaSql.includes('contact_douyin')
      || marker < 1
      || JSON.stringify(platforms) !== JSON.stringify(['qq', 'qq_group'])
    ) {
      throw new Error(`${label} is not an R3-A contracted database.`)
    }
  }
  finally {
    sqlite.close()
  }
}

export interface R3StageABackupPruneOptions {
  activeDatabaseFile: string
  appEnv: AppEnv
  backupDirectories: string[]
  cleanBackupFile: string
  confirmation?: string
  dryRun?: boolean
  restoredDatabaseFile: string
}

export interface R3StageABackupPruneResult {
  counts: {
    applicationBackups: number
    deletedBackups: number
    oldBackups: number
  }
  dryRun: boolean
  environment: {
    appEnv: AppEnv
    backupDirectoriesAbsolute: true
    cleanBackupVerified: true
    restoredDatabaseVerified: true
  }
}

export function runR3StageABackupPrune(
  options: R3StageABackupPruneOptions,
): R3StageABackupPruneResult {
  const backupDirectories = options.backupDirectories.map(path => resolve(path))
  const cleanBackupFile = resolve(options.cleanBackupFile)
  const restoredDatabaseFile = resolve(options.restoredDatabaseFile)
  const activeDatabaseFile = resolve(options.activeDatabaseFile)
  const expectedDirectories = resolveR3StageABackupDirectories(
    options.appEnv,
    activeDatabaseFile,
  )
  if (
    options.backupDirectories.some(path => !isAbsolute(path))
    || !isAbsolute(options.cleanBackupFile)
    || !isAbsolute(options.restoredDatabaseFile)
    || !isAbsolute(options.activeDatabaseFile)
    || JSON.stringify(backupDirectories) !== JSON.stringify(expectedDirectories)
    || dirname(cleanBackupFile) !== expectedDirectories[0]
    || cleanBackupFile === restoredDatabaseFile
    || cleanBackupFile === activeDatabaseFile
    || restoredDatabaseFile === activeDatabaseFile
  ) {
    throw new Error('R3-A backup-prune scope is not proven.')
  }
  if (options.appEnv === 'test') {
    for (const directory of backupDirectories) assertTestPath(directory)
    assertTestPath(cleanBackupFile)
    assertTestPath(restoredDatabaseFile)
    assertTestPath(activeDatabaseFile)
  }

  assertContractedDatabase(cleanBackupFile, 'Clean backup')
  assertContractedDatabase(restoredDatabaseFile, 'Restored database')
  const backups = backupDirectories.flatMap((directory, index) => (
    applicationBackupFiles(
      directory,
      options.appEnv === 'test' || index === 0,
    )
  ))
  if (!backups.includes(cleanBackupFile)) {
    throw new Error('The verified clean backup is outside the application backup set.')
  }
  const oldBackups = backups.filter(path => path !== cleanBackupFile)
  const dryRun = options.dryRun !== false
  if (!dryRun && options.confirmation !== R3_STAGE_A_BACKUP_CONFIRMATION) {
    throw new Error(
      `Refusing backup deletion: pass --confirm "${R3_STAGE_A_BACKUP_CONFIRMATION}".`,
    )
  }
  if (!dryRun) {
    for (const path of oldBackups) {
      rmSync(path)
      rmSync(`${path}-shm`, { force: true })
      rmSync(`${path}-wal`, { force: true })
    }
    const remaining = backupDirectories.flatMap((directory, index) => (
      applicationBackupFiles(
        directory,
        options.appEnv === 'test' || index === 0,
      )
    ))
    if (remaining.length !== 1 || remaining[0] !== cleanBackupFile) {
      throw new Error('R3-A old application backup verification failed.')
    }
  }

  return {
    counts: {
      applicationBackups: backups.length,
      deletedBackups: dryRun ? 0 : oldBackups.length,
      oldBackups: oldBackups.length,
    },
    dryRun,
    environment: {
      appEnv: options.appEnv,
      backupDirectoriesAbsolute: true,
      cleanBackupVerified: true,
      restoredDatabaseVerified: true,
    },
  }
}
