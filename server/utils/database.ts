import {
  existsSync,
  mkdirSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
} from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import type { RuntimeConfig } from './runtime-config'
import { getRuntimeConfig } from './runtime-config'

export const DATABASE_BUSY_TIMEOUT_MS = 5_000
export const DEVELOPMENT_DATABASE_FILE = '.data/dev.db'
export const PRODUCTION_DATABASE_FILE = '/app/data/studio.db'
export const DATABASE_MIGRATIONS_FOLDER = resolve(
  process.cwd(),
  'server/database/migrations',
)

export class DatabaseConfigurationError extends Error {
  override name = 'DatabaseConfigurationError'
}

function isInside(parent: string, child: string) {
  const path = relative(parent, child)
  return path !== ''
    && !path.startsWith('..')
    && !isAbsolute(path)
}

export function resolveDatabaseFile(
  config: Pick<RuntimeConfig, 'appEnv' | 'databaseFile'>,
  cwd = process.cwd(),
  temporaryRoot = tmpdir(),
) {
  if (config.databaseFile === ':memory:') {
    throw new DatabaseConfigurationError(
      'Application databases must use a durable file.',
    )
  }

  if (config.appEnv === 'production') {
    if (config.databaseFile.replaceAll('\\', '/') !== PRODUCTION_DATABASE_FILE) {
      throw new DatabaseConfigurationError(
        `Production DATABASE_FILE must be ${PRODUCTION_DATABASE_FILE}.`,
      )
    }

    return PRODUCTION_DATABASE_FILE
  }

  const databaseFile = resolve(cwd, config.databaseFile)

  if (config.appEnv === 'development') {
    if (databaseFile !== resolve(cwd, DEVELOPMENT_DATABASE_FILE)) {
      throw new DatabaseConfigurationError(
        `Development DATABASE_FILE must be ${DEVELOPMENT_DATABASE_FILE}.`,
      )
    }

    return databaseFile
  }

  const resolvedTemporaryRoot = resolve(temporaryRoot)

  if (
    !isAbsolute(config.databaseFile)
    || extname(databaseFile).toLowerCase() !== '.db'
    || !isInside(resolvedTemporaryRoot, databaseFile)
  ) {
    throw new DatabaseConfigurationError(
      'Test DATABASE_FILE must be an absolute .db path inside the system temporary directory.',
    )
  }

  return databaseFile
}

export function readSqlitePragmas(sqlite: Database.Database) {
  return {
    busyTimeout: sqlite.pragma('busy_timeout', { simple: true }) as number,
    foreignKeys: sqlite.pragma('foreign_keys', { simple: true }) as number,
    journalMode: sqlite.pragma('journal_mode', { simple: true }) as string,
    synchronous: sqlite.pragma('synchronous', { simple: true }) as number,
  }
}

function configureSqlite(sqlite: Database.Database) {
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma(`busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS}`)
  sqlite.pragma('synchronous = FULL')

  const pragmas = readSqlitePragmas(sqlite)

  if (
    pragmas.journalMode.toLowerCase() !== 'wal'
    || pragmas.foreignKeys !== 1
    || pragmas.busyTimeout !== DATABASE_BUSY_TIMEOUT_MS
    || pragmas.synchronous !== 2
  ) {
    throw new DatabaseConfigurationError(
      'SQLite PRAGMA verification failed.',
    )
  }
}

export function openDatabase(databaseFile: string) {
  mkdirSync(dirname(databaseFile), { recursive: true })
  const sqlite = new Database(databaseFile)

  try {
    configureSqlite(sqlite)
  }
  catch (error) {
    sqlite.close()
    throw error
  }

  return {
    databaseFile,
    orm: drizzle(sqlite),
    sqlite,
  }
}

export type DatabaseHandle = ReturnType<typeof openDatabase>

function migrationState(
  sqlite: Database.Database,
  migrationsFolder: string,
) {
  const migrations = readMigrationFiles({ migrationsFolder })
  const tableExists = sqlite.prepare(`
    SELECT 1
    FROM sqlite_master
    WHERE type = 'table' AND name = '__drizzle_migrations'
  `).pluck().get() === 1
  const latestApplied = tableExists
    ? sqlite.prepare(`
        SELECT created_at
        FROM __drizzle_migrations
        ORDER BY created_at DESC
        LIMIT 1
      `).pluck().get() as number | undefined
    : undefined

  return {
    migrations,
    pending: migrations.filter(
      migration => latestApplied === undefined
        || migration.folderMillis > Number(latestApplied),
    ),
  }
}

function backupName(databaseFile: string, now: Date) {
  const stamp = now.toISOString().replaceAll(/[:.]/g, '-')
  return resolve(
    dirname(databaseFile),
    'backups',
    `pre-migrate-${stamp}.db`,
  )
}

async function backupOpenDatabase(
  sqlite: Database.Database,
  outputFile: string,
) {
  mkdirSync(dirname(outputFile), { recursive: true })

  if (existsSync(outputFile)) {
    throw new Error('Backup destination already exists.')
  }

  await sqlite.backup(outputFile)
  const backup = new Database(outputFile, { readonly: true })

  try {
    const integrity = backup.pragma('integrity_check', {
      simple: true,
    })

    if (integrity !== 'ok') {
      throw new Error('Backup integrity check failed.')
    }
  }
  finally {
    backup.close()
  }

  return outputFile
}

export async function backupDatabase(
  databaseFile: string,
  outputFile: string,
) {
  const sourceFile = resolve(databaseFile)
  const destinationFile = resolve(outputFile)

  if (sourceFile === destinationFile) {
    throw new Error('Backup destination must differ from the source database.')
  }

  if (!existsSync(sourceFile) || statSync(sourceFile).size === 0) {
    throw new Error('Backup source database does not exist or is empty.')
  }

  const database = openDatabase(sourceFile)

  try {
    return await backupOpenDatabase(database.sqlite, destinationFile)
  }
  finally {
    database.sqlite.close()
  }
}

export async function migrateDatabase(
  databaseFile: string,
  options: {
    migrationsFolder?: string
    now?: Date
  } = {},
) {
  const migrationsFolder = options.migrationsFolder
    ?? DATABASE_MIGRATIONS_FOLDER
  const existed = existsSync(databaseFile) && statSync(databaseFile).size > 0
  const database = openDatabase(databaseFile)

  try {
    const before = migrationState(database.sqlite, migrationsFolder)
    const backupFile = existed && before.pending.length > 0
      ? await backupOpenDatabase(
          database.sqlite,
          backupName(databaseFile, options.now ?? new Date()),
        )
      : undefined

    migrate(database.orm, { migrationsFolder })

    return {
      applied: before.pending.length,
      backupFile,
    }
  }
  finally {
    database.sqlite.close()
  }
}

let applicationDatabase: DatabaseHandle | undefined

export function getDatabase() {
  const databaseFile = resolveDatabaseFile(getRuntimeConfig())

  if (
    applicationDatabase
    && applicationDatabase.databaseFile !== databaseFile
  ) {
    throw new DatabaseConfigurationError(
      'Database configuration changed after startup.',
    )
  }

  applicationDatabase ??= openDatabase(databaseFile)
  return applicationDatabase
}

export function closeDatabase() {
  applicationDatabase?.sqlite.close()
  applicationDatabase = undefined
}
