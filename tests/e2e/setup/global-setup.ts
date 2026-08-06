import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import {
  initializeAdmin,
  resetAdminPassword,
} from '../../../server/utils/service/auth'
import {
  E2E_ADMIN,
  E2E_DATABASE_FILE,
  E2E_RUN_DIRECTORY,
} from '../helpers/auth'
import {
  migrateFixtureDatabase,
  openFixtureDatabase,
} from '../helpers/fixture-db'
import { seedBundledWatermark } from '../../../server/utils/runner/watermark-seed'
import { FakeMediaStorage } from '../../helpers/fake-media-storage'

function resetE2EDatabase() {
  const runDirectory = resolve(E2E_RUN_DIRECTORY)
  if (
    dirname(runDirectory) !== resolve(tmpdir())
    || !basename(runDirectory).startsWith('fur-forge-e2e-')
    || resolve(E2E_DATABASE_FILE) !== resolve(runDirectory, 'database.db')
  ) {
    throw new Error('Refusing to reset an E2E database outside its run directory.')
  }

  for (const suffix of ['', '-shm', '-wal']) {
    rmSync(`${E2E_DATABASE_FILE}${suffix}`, { force: true })
  }
}

export default async function globalSetup() {
  resetE2EDatabase()
  migrateFixtureDatabase(E2E_DATABASE_FILE)
  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)

  try {
    await initializeAdmin(sqlite, {
      username: E2E_ADMIN.username,
      password: E2E_ADMIN.password,
    })
    // 重置为固定密码，同时清除可能残留的失败计数、锁定与既有 Session 版本。
    await resetAdminPassword(sqlite, {
      username: E2E_ADMIN.username,
      newPassword: E2E_ADMIN.password,
    })
    await seedBundledWatermark(
      sqlite,
      new FakeMediaStorage(),
      { appEnv: 'test' },
      { keyPrefix: 'test/e2e-watermark' },
    )
  }
  finally {
    sqlite.close()
  }
}
