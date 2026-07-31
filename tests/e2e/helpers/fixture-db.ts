import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

// Playwright 的 TS 加载器不接受 server/utils/database.ts 经由 runtime-config
// 引入的无属性 JSON import，因此 E2E 夹具在这里直接组装等价的 SQLite 连接与
// Drizzle 迁移。连接 PRAGMA 与 server/utils/database.ts 的 configureSqlite 一致。
const MIGRATIONS_FOLDER = resolve(
  process.cwd(),
  'server/database/migrations',
)

export function openFixtureDatabase(databaseFile: string) {
  const sqlite = new Database(databaseFile)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.pragma('synchronous = FULL')
  return sqlite
}

export function migrateFixtureDatabase(databaseFile: string) {
  const sqlite = openFixtureDatabase(databaseFile)

  try {
    migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_FOLDER })
  }
  finally {
    sqlite.close()
  }
}
