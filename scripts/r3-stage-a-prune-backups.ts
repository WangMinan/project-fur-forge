import { parseArgs } from 'node:util'
import { resolveDatabaseFile } from '../server/utils/database'
import {
  resolveR3StageABackupDirectories,
  runR3StageABackupPrune,
} from '../server/utils/runner/r3-stage-a-backup-retirement'
import { loadRuntimeConfig } from '../server/utils/runtime-config'

export interface R3StageABackupPruneCliOptions {
  args?: string[]
}

export function runR3StageABackupPruneCli(
  options: R3StageABackupPruneCliOptions = {},
) {
  const { values } = parseArgs({
    args: (options.args ?? process.argv.slice(2))
      .filter(argument => argument !== '--'),
    options: {
      'clean-backup': { type: 'string' },
      confirm: { type: 'string' },
      execute: { type: 'boolean' },
      'restored-database': { type: 'string' },
    },
  })
  if (!values['clean-backup'] || !values['restored-database']) {
    throw new Error(
      'Usage: r3-stage-a-prune-backups --clean-backup <file.db> --restored-database <file.db>',
    )
  }
  const config = loadRuntimeConfig()
  if (config.appEnv === 'development') {
    throw new Error('R3-A backup pruning requires APP_ENV=test or APP_ENV=production.')
  }
  const databaseFile = resolveDatabaseFile(config)
  return runR3StageABackupPrune({
    activeDatabaseFile: databaseFile,
    appEnv: config.appEnv,
    backupDirectories: resolveR3StageABackupDirectories(config.appEnv, databaseFile),
    cleanBackupFile: values['clean-backup'],
    confirmation: values.confirm,
    dryRun: values.execute !== true,
    restoredDatabaseFile: values['restored-database'],
  })
}
