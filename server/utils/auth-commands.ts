import {
  initializeAdmin,
  resetAdminPassword,
} from './auth'
import {
  migrateDatabase,
  openDatabase,
  resolveDatabaseFile,
} from './database'
import type { RuntimeConfig } from './runtime-config'

export const RESET_CONFIRMATION = 'RESET_SINGLE_ADMIN_PASSWORD'

async function withMigratedDatabase<T>(
  config: RuntimeConfig,
  action: (sqlite: ReturnType<typeof openDatabase>['sqlite']) => Promise<T>,
) {
  const databaseFile = resolveDatabaseFile(config)
  await migrateDatabase(databaseFile)
  const database = openDatabase(databaseFile)

  try {
    return await action(database.sqlite)
  }
  finally {
    database.sqlite.close()
  }
}

export function initializeAdminCommand(
  config: RuntimeConfig,
  input: {
    username: string
    password: string
  },
) {
  return withMigratedDatabase(config, sqlite =>
    initializeAdmin(sqlite, input))
}

export function resetAdminPasswordCommand(
  config: RuntimeConfig,
  input: {
    username: string
    password: string
    confirmation: string
  },
) {
  if (input.confirmation !== RESET_CONFIRMATION) {
    throw new Error(
      `Reset requires --confirm ${RESET_CONFIRMATION}.`,
    )
  }

  return withMigratedDatabase(config, sqlite =>
    resetAdminPassword(sqlite, {
      username: input.username,
      newPassword: input.password,
    }))
}
