import { existsSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { parseArgs } from 'node:util'
import { openDatabase, resolveDatabaseFile } from '../server/utils/database'
import { getPublicMediaCache } from '../server/utils/public-media-cache'
import {
  AliOssR3StageAObjectStore,
  R3StageAEsaCachePurger,
} from '../server/utils/r3-stage-a-remote-cleanup'
import {
  runR3StageACleanup,
} from '../server/utils/runner/r3-stage-a-retirement'
import { loadRuntimeConfig } from '../server/utils/runtime-config'

export interface R3StageACleanupCliOptions {
  args?: string[]
}

function applicationBackupCount(databaseFile: string) {
  const backupDirectory = join(dirname(databaseFile), 'backups')
  if (!existsSync(backupDirectory)) {
    return 0
  }
  return readdirSync(backupDirectory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.db'))
    .length
}

function assertRemoteScope(
  appEnv: 'production' | 'test',
  privateBucket: string,
  publicBucket: string,
  endpoint: string,
) {
  if (appEnv === 'production') return
  const endpointHost = new URL(endpoint).hostname.toLowerCase()
  if (
    !privateBucket.toLowerCase().includes('test')
    || !publicBucket.toLowerCase().includes('test')
    || !(
      endpointHost.includes('test')
      || endpointHost === '127.0.0.1'
      || endpointHost === 'localhost'
    )
  ) {
    throw new Error('Test OSS isolation is not proven; refusing R3-A cleanup.')
  }
}

export async function runR3StageACleanupCli(
  options: R3StageACleanupCliOptions = {},
) {
  const { values } = parseArgs({
    args: (options.args ?? process.argv.slice(2))
      .filter(argument => argument !== '--'),
    options: {
      confirm: { type: 'string' },
      'environment-prefix': { type: 'string' },
      execute: { type: 'boolean' },
    },
  })
  if (!values['environment-prefix']) {
    throw new Error('Pass --environment-prefix with the exact confirmed object scope.')
  }
  const config = loadRuntimeConfig()
  if (config.appEnv === 'development') {
    throw new Error('R3-A cleanup requires APP_ENV=test or APP_ENV=production.')
  }
  if (
    !config.ossPrivateBucket
    || !config.ossPublicBucket
    || !config.ossEndpoint
  ) {
    throw new Error('R3-A cleanup requires complete OSS configuration.')
  }
  assertRemoteScope(
    config.appEnv,
    config.ossPrivateBucket,
    config.ossPublicBucket,
    config.ossEndpoint,
  )
  const databaseFile = resolveDatabaseFile(config)
  const database = openDatabase(databaseFile)
  try {
    return await runR3StageACleanup({
      appEnv: config.appEnv,
      applicationBackups: applicationBackupCount(databaseFile),
      cache: new R3StageAEsaCachePurger(getPublicMediaCache()),
      confirmation: values.confirm,
      databaseAbsolute: isAbsolute(databaseFile),
      dryRun: values.execute !== true,
      endpointConfigured: true,
      environmentPrefix: values['environment-prefix'],
      mediaOrigin: config.mediaBaseUrl,
      privateBucketConfigured: true,
      publicBucketConfigured: true,
      sqlite: database.sqlite,
      store: new AliOssR3StageAObjectStore(config),
    })
  }
  finally {
    database.sqlite.close()
  }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  try {
    process.stdout.write(`${JSON.stringify(await runR3StageACleanupCli())}\n`)
  }
  catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  }
}
