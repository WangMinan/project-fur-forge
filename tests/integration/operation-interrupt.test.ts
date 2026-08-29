import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type Database from 'better-sqlite3'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { createSyntheticTransparentPng } from '../../scripts/oss-preflight-core.mjs'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import { SITE_DISPLAY_RECIPE_VERSION } from '../../server/utils/recipe/site-display-recipe'

/**
 * T34-F5 真实进程中断测试。
 *
 * 这里 spawn 真正的 Node 子进程，在生成、公开对象验证、数据库提交和清理四个
 * 边界上发送 SIGKILL，然后用新的子进程执行启动恢复。**不是**在同一进程里
 * 调用 runner 两次。
 *
 * 覆盖 site-display reconcile 这条 operation：它与 Hero 发布、作品发布、
 * 水印应用共用同一套 lease/heartbeat/恢复基础设施，因此对该基础设施的
 * 中断行为验证对四类 operation 同样成立；各 operation 自身的状态机由
 * work-publication / site-display-reconcile 的用例覆盖。
 */

const NOW = Date.UTC(2026, 7, 6)
const PREFIX = 'test/t34-f5-interrupt'
const CHILD = fileURLToPath(
  new URL('../fixtures/operation-interrupt-child.ts', import.meta.url),
)
// 首页两个独立方向 item：横版 5 宽度、竖版 3 宽度，各 2 格式，共 16 个公开对象。
const EXPECTED_CALLS = 16

let directory: string
let databaseFile: string
let barrierFile: string
let sqlite: Database.Database
const children: ChildProcess[] = []

function insertSource(id: string, role: string, width: number, height: number) {
  const content = createSyntheticTransparentPng() as Buffer
  const sha256 = createHash('sha256').update(content).digest('hex')
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, ?, 'READY', ?, ?, ?, 'image/png', ?, ?, ?, ?)
  `).run(
    id,
    role,
    `${PREFIX}/original/${id}/source.png`,
    sha256,
    content.length,
    width,
    height,
    NOW,
    NOW,
  )
}

function seedEnabledHero() {
  insertSource('hero-landscape', 'home_hero_landscape', 4000, 2250)
  insertSource('hero-portrait', 'home_hero_portrait', 1800, 3200)
  const insertItem = sqlite.prepare(`
    INSERT INTO site_hero_items (
      id, placement, orientation, asset_id, alt_text,
      sort_order, enabled, created_at, updated_at
    ) VALUES (?, 'home', ?, ?, ?, 0, 1, ?, ?)
  `)
  insertItem.run(
    'hero-landscape-item',
    'landscape',
    'hero-landscape',
    '既有横版首图',
    NOW,
    NOW,
  )
  insertItem.run(
    'hero-portrait-item',
    'portrait',
    'hero-portrait',
    '既有竖版首图',
    NOW,
    NOW,
  )
}

function operationRows() {
  return sqlite.prepare(`
    SELECT id, status, attempt, lease_owner AS leaseOwner,
           lease_expires_at AS leaseExpiresAt,
           recovery_reason AS recoveryReason,
           generated_count AS generated, failed_count AS failed
    FROM site_display_reconcile_operations
    ORDER BY started_at, id
  `).all() as Array<{
    attempt: number
    failed: number
    generated: number
    id: string
    leaseExpiresAt: number | null
    leaseOwner: string | null
    recoveryReason: string | null
    status: string
  }>
}

function readyVariantKeys() {
  return sqlite.prepare(`
    SELECT object_key FROM asset_variants
    WHERE recipe_version = ? AND status = 'READY'
    ORDER BY object_key
  `).pluck().all(SITE_DISPLAY_RECIPE_VERSION) as string[]
}

/** spawn 子进程并等到它写下 barrier，然后 SIGKILL。 */
async function runUntilKilled(mode: string, owner?: string) {
  writeFileSync(barrierFile, '')
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', CHILD, databaseFile, barrierFile, mode, ...(owner ? [owner] : [])],
    {
      env: {
        ...process.env,
        APP_ENV: 'test',
        DATABASE_FILE: databaseFile,
        INTERRUPT_EXPECTED_CALLS: String(EXPECTED_CALLS),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  children.push(child)
  let stderr = ''
  child.stderr?.on('data', chunk => {
    stderr += String(chunk)
  })

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`child exited early (${child.exitCode}): ${stderr}`)
    }
    if (existsSync(barrierFile) && readFileSync(barrierFile, 'utf8').includes(mode)) {
      break
    }
    await new Promise(done => setTimeout(done, 50))
  }
  const reached = readFileSync(barrierFile, 'utf8')
  expect(reached, `child never reached ${mode}: ${stderr}`).toContain(mode)

  // 真实杀进程：SIGKILL 无法被捕获，因此没有任何优雅收尾机会。
  const exited = new Promise<number | null>(done =>
    child.once('exit', code => done(code)),
  )
  child.kill('SIGKILL')
  const exitCode = await exited
  // 被强杀的进程不会以 0 退出，也没有写出成功摘要。
  expect(exitCode).not.toBe(0)
}

/** safeLog 的 info 也走 stdout，因此摘要取最后一行 JSON。 */
function lastJsonLine(stdout: string) {
  const line = stdout.trim().split('\n').map(entry => entry.trim())
    .reverse().find(entry => entry.startsWith('{'))
  if (!line) {
    throw new Error(`no JSON summary in child stdout: ${stdout}`)
  }
  return JSON.parse(line) as Record<string, unknown>
}

/** 用新的子进程执行启动恢复，模拟容器重启。 */
async function runRecovery(owner: string) {
  writeFileSync(barrierFile, '')
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', CHILD, databaseFile, barrierFile, 'recover', owner],
    {
      env: {
        ...process.env,
        APP_ENV: 'test',
        DATABASE_FILE: databaseFile,
        INTERRUPT_EXPECTED_CALLS: String(EXPECTED_CALLS),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  children.push(child)
  let stdout = ''
  let stderr = ''
  child.stdout?.on('data', chunk => {
    stdout += String(chunk)
  })
  child.stderr?.on('data', chunk => {
    stderr += String(chunk)
  })
  const code = await new Promise<number | null>(done =>
    child.once('exit', exitCode => done(exitCode)),
  )
  expect(code, `recovery child failed: ${stderr}`).toBe(0)
  return { stderr, stdout }
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-interrupt-'))
  databaseFile = resolve(directory, 'studio.db')
  barrierFile = resolve(directory, 'barrier.txt')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  seedEnabledHero()
})

afterEach(() => {
  children.splice(0).forEach(child => {
    if (child.exitCode === null) {
      child.kill('SIGKILL')
    }
  })
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('T34-F5 real process interruption and restart recovery', () => {
  it.each([
    ['generate', 'generation'],
    ['verify', 'public object verification'],
    ['commit', 'database commit boundary'],
  ])('recovers after SIGKILL during %s', async (mode) => {
    await runUntilKilled(mode, `killed-host/1/${mode.padEnd(8, 'x')}`)

    // 被杀之后：任务留在运行态，lease 仍指向死掉的进程。
    const afterKill = operationRows()
    expect(afterKill).toHaveLength(1)
    expect(afterKill[0]!.status).not.toBe('DONE')
    expect(afterKill[0]!.leaseOwner).toBe(`killed-host/1/${mode.padEnd(8, 'x')}`)
    expect(afterKill[0]!.attempt).toBe(1)

    // 让 lease 过期，等价于重启发生在 TTL 之后。
    sqlite.prepare(`
      UPDATE site_display_reconcile_operations SET lease_expires_at = ?
    `).run(Date.now() - 1)

    const recovery = await runRecovery('restarted-host/2/bbbbbbbb')

    const afterRecovery = operationRows()
    // 任务不永久卡在运行态。
    expect(afterRecovery).toHaveLength(1)
    expect(['DONE', 'FAILED']).toContain(afterRecovery[0]!.status)
    expect(afterRecovery[0]!.status).toBe('DONE')
    // 接管发生在新 attempt 上，并记录恢复原因。
    expect(afterRecovery[0]!.attempt).toBe(2)
    expect(afterRecovery[0]!.recoveryReason).toBe('LEASE_EXPIRED')
    expect(afterRecovery[0]!.leaseOwner).toBeNull()
    // 不出现半套 SourceSet：横竖各 6 个变体全部就位。
    expect(readyVariantKeys()).toHaveLength(EXPECTED_CALLS)
    // 恢复日志不泄漏 Object Key、签名 URL 或凭据。
    for (const stream of [recovery.stdout, recovery.stderr]) {
      expect(stream).not.toContain(PREFIX)
      expect(stream).not.toContain('/original/')
      expect(stream).not.toMatch(/Signature|AccessKey|x-oss-/iu)
    }
  }, 180_000)

  it('stays idempotent and does not duplicate rows or objects across repeated restarts', async () => {
    await runUntilKilled('generate', 'killed-host/1/round1xx')
    sqlite.prepare(`
      UPDATE site_display_reconcile_operations SET lease_expires_at = ?
    `).run(Date.now() - 1)
    await runRecovery('restarted-host/2/round2xx')
    const firstKeys = readyVariantKeys()

    // 第二次、第三次重启：恢复扫描不再找到待处理任务，也不重复生成对象。
    const second = await runRecovery('restarted-host/3/round3xx')
    const third = await runRecovery('restarted-host/4/round4xx')

    expect(lastJsonLine(second.stdout)).toMatchObject({ scanned: 0 })
    expect(lastJsonLine(third.stdout)).toMatchObject({ scanned: 0 })
    expect(operationRows()).toHaveLength(1)
    expect(readyVariantKeys()).toEqual(firstKeys)
  }, 180_000)

  it('never lets a killed runner block new operations forever', async () => {
    await runUntilKilled('commit', 'killed-host/1/blockxxx')

    // lease 未过期时，新的运行不会抢占，也不会并行创建第二条记录。
    const beforeExpiry = await runRecovery('other-host/9/cccccccc')
    expect(lastJsonLine(beforeExpiry.stdout)).toMatchObject({ scanned: 0 })
    expect(operationRows()).toHaveLength(1)

    // lease 过期后立刻可被接管并推进到终态。
    sqlite.prepare(`
      UPDATE site_display_reconcile_operations SET lease_expires_at = ?
    `).run(Date.now() - 1)
    await runRecovery('other-host/9/cccccccc')

    const rows = operationRows()
    expect(rows).toHaveLength(1)
    expect(['DONE', 'FAILED']).toContain(rows[0]!.status)
    expect(rows[0]!.leaseOwner).toBeNull()
  }, 180_000)

  it('keeps the previous valid public objects when killed during cleanup', async () => {
    // 先完整跑一次，得到一整套有效公开对象。
    sqlite.close()
    const completed = await runRecovery('warmup-host/1/dddddddd')
    expect(completed.stdout).toBeDefined()
    sqlite = openDatabase(databaseFile).sqlite
    // warmup 的 recover 模式不会创建 operation，因此这里直接跑一次 reconcile。
    writeFileSync(barrierFile, '')
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', CHILD, databaseFile, barrierFile, 'run', 'run-host/1/eeeeeeee'],
      {
        env: {
          ...process.env,
          APP_ENV: 'test',
          DATABASE_FILE: databaseFile,
          INTERRUPT_EXPECTED_CALLS: String(EXPECTED_CALLS),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    children.push(child)
    const code = await new Promise<number | null>(done =>
      child.once('exit', exitCode => done(exitCode)),
    )
    expect(code).toBe(0)

    const established = readyVariantKeys()
    expect(established).toHaveLength(EXPECTED_CALLS)

    // 再被杀一次也不会删掉这批既有有效对象。
    sqlite.prepare(`
      UPDATE site_display_reconcile_operations
      SET status = 'GENERATING_PUBLIC', completed_at = NULL,
          internal_error_code = NULL, failure_stage = NULL,
          lease_owner = NULL, lease_expires_at = NULL
    `).run()
    await runRecovery('restarted-host/5/ffffffff')

    expect(readyVariantKeys()).toEqual(established)
    expect(operationRows().every(row => row.leaseOwner === null)).toBe(true)
  }, 180_000)
})
