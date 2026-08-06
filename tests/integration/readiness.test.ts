import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  DATABASE_MIGRATIONS_FOLDER,
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import { evaluateReadiness } from '../../server/utils/readiness'

/**
 * T34-F6 readiness 严格迁移校验。
 *
 * readiness 不能只比较迁移数量：条数相同但 hash 或顺序不同的数据库必须报
 * 503。这里逐个构造负路径，并确认响应体不泄漏路径、SQL、Object Key 或栈。
 */

let directory: string
let databaseFile: string

function journalEntries() {
  return (JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: Array<{ tag: string, when: number }> }).entries
}

/** 复制前 N 个迁移到独立目录，模拟历史不同的数据库。 */
function partialMigrationsFolder(name: string, count: number) {
  const folder = resolve(directory, name)
  mkdirSync(resolve(folder, 'meta'), { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: unknown[] }
  for (const { tag } of journalEntries().slice(0, count)) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(
    resolve(folder, 'meta/_journal.json'),
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, count) }),
  )
  return folder
}

beforeEach(() => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-readiness-'))
  databaseFile = resolve(directory, 'studio.db')
})

afterEach(() => {
  rmSync(directory, { force: true, recursive: true })
})

describe('T34-F6 strict migration readiness', () => {
  it('reports ready for a correctly migrated database', async () => {
    await migrateDatabase(databaseFile)

    const result = evaluateReadiness({ databaseFile })

    expect(result).toEqual({
      ready: true,
      checks: {
        databaseOpen: true,
        migrationsCurrent: true,
        baselineRecords: true,
      },
    })
  })

  it('is unready when the database file does not exist', () => {
    const result = evaluateReadiness({
      databaseFile: resolve(directory, 'missing.db'),
    })

    expect(result.ready).toBe(false)
    expect(result.checks.databaseOpen).toBe(false)
  })

  it('is unready when migration count matches but a hash differs', async () => {
    await migrateDatabase(databaseFile)
    const sqlite = openDatabase(databaseFile).sqlite
    // 条数不变，只改一条历史记录的 hash。
    // drizzle 的 id 列是 SERIAL，SQLite 里恒为 NULL，因此用 rowid 定位。
    const first = sqlite.prepare(`
      SELECT rowid FROM __drizzle_migrations ORDER BY created_at, id LIMIT 1
    `).pluck().get()
    const tampered = sqlite.prepare(`
      UPDATE __drizzle_migrations SET hash = ? WHERE rowid = ?
    `).run('0'.repeat(64), first)
    expect(tampered.changes).toBe(1)
    const applied = Number(sqlite.prepare(`
      SELECT count(*) FROM __drizzle_migrations
    `).pluck().get())
    sqlite.close()
    expect(applied).toBe(journalEntries().length)

    const result = evaluateReadiness({ databaseFile })

    expect(result.ready).toBe(false)
    expect(result.checks.databaseOpen).toBe(true)
    expect(result.checks.migrationsCurrent).toBe(false)
  })

  it('is unready when migration count matches but the order differs', async () => {
    await migrateDatabase(databaseFile)
    const sqlite = openDatabase(databaseFile).sqlite
    const rows = sqlite.prepare(`
      SELECT rowid, created_at AS createdAt FROM __drizzle_migrations
      ORDER BY created_at, id LIMIT 2
    `).all() as Array<{ createdAt: number, rowid: number }>
    // 交换前两条的 created_at：条数与 hash 集合不变，顺序被破坏。
    const swap = sqlite.prepare(
      'UPDATE __drizzle_migrations SET created_at = ? WHERE rowid = ?',
    )
    expect(swap.run(rows[1]!.createdAt, rows[0]!.rowid).changes).toBe(1)
    expect(swap.run(rows[0]!.createdAt, rows[1]!.rowid).changes).toBe(1)
    sqlite.close()

    const result = evaluateReadiness({ databaseFile })

    expect(result.ready).toBe(false)
    expect(result.checks.migrationsCurrent).toBe(false)
  })

  it('is unready when migrations are pending', async () => {
    // 只应用前 12 个迁移的历史库。
    await migrateDatabase(databaseFile, {
      migrationsFolder: partialMigrationsFolder('pre-t34-migrations', 12),
    })

    const result = evaluateReadiness({ databaseFile })

    expect(result.ready).toBe(false)
    expect(result.checks.databaseOpen).toBe(true)
    expect(result.checks.migrationsCurrent).toBe(false)
  })

  it('is unready when a baseline singleton record is missing', async () => {
    await migrateDatabase(databaseFile)
    const sqlite = new Database(databaseFile)
    sqlite.pragma('foreign_keys = OFF')
    sqlite.prepare(`DELETE FROM site_content WHERE id = 'site'`).run()
    sqlite.close()

    const result = evaluateReadiness({ databaseFile })

    expect(result.ready).toBe(false)
    expect(result.checks.migrationsCurrent).toBe(true)
    expect(result.checks.baselineRecords).toBe(false)
  })

  it('never exposes paths, SQL, object keys or stacks in the result', async () => {
    await migrateDatabase(databaseFile)

    const serialized = JSON.stringify(evaluateReadiness({ databaseFile }))

    expect(serialized).not.toContain(directory)
    expect(serialized).not.toContain('studio.db')
    expect(serialized).not.toContain('SELECT')
    expect(serialized).not.toContain('__drizzle_migrations')
    expect(serialized).not.toMatch(/original|\.png|Error|at \w+ \(/u)
    // 结果结构只有布尔检查项。
    expect(Object.values(JSON.parse(serialized).checks)
      .every(value => typeof value === 'boolean')).toBe(true)
  })
})
