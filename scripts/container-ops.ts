/**
 * T34-F6 容器内运维入口。
 *
 * 同一镜像通过子命令提供全部运维操作。这个文件在镜像构建阶段被 bundle 成
 * 单个 JS，因此运行镜像里不需要 tsx 或任何开发工具链，也不会出现
 * "复制了 TypeScript 源码但没有执行器" 的情况。
 *
 * 危险操作保留显式确认参数，与本地脚本的保护一致。
 */
import { parseArgs } from 'node:util'

const COMMANDS = [
  'migrate',
  'init-admin',
  'reset-admin-password',
  'backup',
  'restore',
  'restore-verify',
  'preflight',
  'cleanup-expired-uploads',
  'commission-retention',
  'reconcile-site-display',
  'upgrade-site-display-v2',
  'recover-operations',
  'retire-legacy-public-media',
  'r3-stage-a-cleanup',
  'r3-stage-a-prune-backups',
] as const

type Command = typeof COMMANDS[number]

function usage(): never {
  process.stderr.write(
    `Usage: node ops.mjs <command> [options]\n\nCommands:\n${
      COMMANDS.map(command => `  ${command}`).join('\n')
    }\n`,
  )
  process.exit(2)
}

const [command, ...rest] = process.argv.slice(2)
if (!command || !COMMANDS.includes(command as Command)) {
  usage()
}

function argv() {
  return rest.filter(argument => argument !== '--')
}

async function run() {
  const { loadRuntimeConfig } = await import('../server/utils/runtime-config')
  const config = loadRuntimeConfig()

  switch (command as Command) {
    case 'migrate': {
      const { migrateDatabase, resolveDatabaseFile } = await import('../server/utils/database')
      const databaseFile = resolveDatabaseFile(config)
      const result = await migrateDatabase(databaseFile)
      return {
        applied: result.applied,
        backupCreated: Boolean(result.backupFile),
        databaseFile,
      }
    }

    case 'init-admin': {
      const { initializeAdminCommand } = await import('../server/utils/service/auth-commands')
      const { readAdminCredentials } = await import('./auth-input')
      const { password, username } = await readAdminCredentials('Admin password: ')
      const result = await initializeAdminCommand(config, { username, password })
      return {
        created: result.created,
        id: result.id,
        username: result.username,
      }
    }

    case 'reset-admin-password': {
      const { values } = parseArgs({
        args: argv(),
        options: { confirm: { type: 'string' } },
      })
      const {
        RESET_CONFIRMATION,
        resetAdminPasswordCommand,
      } = await import('../server/utils/service/auth-commands')
      // 与本地 pnpm auth:reset-password 相同的显式确认。
      if (values.confirm !== RESET_CONFIRMATION) {
        throw new Error(
          `Refusing to reset: pass --confirm ${RESET_CONFIRMATION}`,
        )
      }
      const { readAdminCredentials } = await import('./auth-input')
      const { password, username } = await readAdminCredentials('New admin password: ')
      const result = await resetAdminPasswordCommand(config, {
        confirmation: values.confirm,
        username,
        password,
      })
      return { username: result.username }
    }

    case 'backup': {
      const { values } = parseArgs({
        args: argv(),
        options: { output: { short: 'o', type: 'string' } },
      })
      if (!values.output) {
        throw new Error('Usage: backup --output <new-backup.db>')
      }
      const { backupDatabase, resolveDatabaseFile } = await import('../server/utils/database')
      const databaseFile = resolveDatabaseFile(config)
      return {
        databaseFile,
        outputFile: await backupDatabase(databaseFile, values.output),
      }
    }

    case 'restore':
    case 'restore-verify': {
      const { values } = parseArgs({
        args: argv(),
        options: {
          backup: { short: 'b', type: 'string' },
          output: { short: 'o', type: 'string' },
        },
      })
      if (!values.backup || !values.output) {
        throw new Error('Usage: restore --backup <file.db> --output <target.db>')
      }
      const { resolveDatabaseFile, restoreDatabase } = await import('../server/utils/database')
      // restoreDatabase 本身会校验完整性、外键与迁移一致性；
      // restore-verify 与 restore 共用同一校验路径，只是语义上强调只验证。
      const outputFile = await restoreDatabase(values.backup, values.output, {
        activeDatabaseFile: resolveDatabaseFile(config),
      })
      return { outputFile, verified: true }
    }

    case 'preflight': {
      // OSS 凭据与双 Bucket 的昂贵探测放在这里，不放在 readiness。
      // oss-preflight.mjs 已是独立可执行 JS，直接以子进程运行，
      // 不为它虚构一个不存在的导出。
      const { spawnSync } = await import('node:child_process')
      const { fileURLToPath } = await import('node:url')
      const { dirname, resolve } = await import('node:path')
      const here = dirname(fileURLToPath(import.meta.url))
      const result = spawnSync(
        process.execPath,
        [resolve(here, 'oss-preflight.mjs'), ...argv()],
        { stdio: 'inherit' },
      )
      if (result.status !== 0) {
        throw new Error(`OSS preflight failed with exit code ${result.status}.`)
      }
      return { preflight: 'passed' }
    }

    case 'cleanup-expired-uploads': {
      const { values } = parseArgs({
        args: argv(),
        allowNegative: true,
        options: {
          'dry-run': { type: 'boolean' },
          limit: { type: 'string' },
        },
      })
      const { cleanupExpiredUploads } = await import('../server/utils/runner/upload-cleanup')
      return await cleanupExpiredUploads({
        dryRun: values['dry-run'] !== false,
        limit: values.limit ? Number(values.limit) : undefined,
      })
    }

    case 'commission-retention': {
      const { runCommissionRetentionCli } = await import('./commission-retention')
      return await runCommissionRetentionCli(argv())
    }

    case 'reconcile-site-display':
    case 'upgrade-site-display-v2': {
      // 旧命令保留兼容；新命令明确表达将既有站点媒体升级到当前 v2 配方。
      const { parseSiteDisplayUpgradeArgs } = await import('./site-display-upgrade-options')
      const { reconcileSiteDisplay } = await import('../server/utils/runner/site-display-reconcile')
      return await reconcileSiteDisplay(parseSiteDisplayUpgradeArgs(argv()))
    }

    case 'recover-operations': {
      // T34-F5：手动触发一次启动恢复扫描，用于运维确认卡住的长任务。
      const { getDatabase } = await import('../server/utils/database')
      const { getMediaStorage } = await import('../server/utils/media-storage')
      await import('../server/utils/runner/home-management')
      await import('../server/utils/runner/site-display-reconcile')
      await import('../server/utils/runner/work-publication')
      const { recoverPendingOperations } = await import('../server/utils/runner/operation-recovery')
      return await recoverPendingOperations({
        sqlite: getDatabase().sqlite,
        storage: getMediaStorage(),
      })
    }

    case 'retire-legacy-public-media': {
      const { values } = parseArgs({
        args: argv(),
        options: {
          confirm: { type: 'string' },
          execute: { type: 'boolean', default: false },
        },
      })
      const { getDatabase } = await import('../server/utils/database')
      const { getMediaStorage } = await import('../server/utils/media-storage')
      const { getPublicMediaCache } = await import('../server/utils/public-media-cache')
      const { retireLegacyPublicMedia } = await import('../server/utils/runner/legacy-public-media-retirement')
      return await retireLegacyPublicMedia({
        cache: getPublicMediaCache(),
        confirmation: values.confirm,
        execute: values.execute,
        sqlite: getDatabase().sqlite,
        storage: getMediaStorage(),
      })
    }

    case 'r3-stage-a-cleanup': {
      const { runR3StageACleanupCli } = await import('./r3-stage-a-cleanup')
      return await runR3StageACleanupCli({ args: argv() })
    }

    case 'r3-stage-a-prune-backups': {
      const { runR3StageABackupPruneCli } = await import('./r3-stage-a-prune-backups')
      return runR3StageABackupPruneCli({ args: argv() })
    }
  }
}

try {
  process.stdout.write(`${JSON.stringify(await run())}\n`)
}
catch (error) {
  // 只输出消息，不输出栈，避免把路径写进容器日志。
  process.stderr.write(`${(error as Error).message}\n`)
  process.exit(1)
}
