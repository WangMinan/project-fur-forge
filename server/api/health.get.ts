import { assertDatabaseMigrated, getDatabase, resolveDatabaseFile } from '../utils/database'
import { getRuntimeConfig } from '../utils/runtime-config'

export default defineEventHandler(() => {
  const config = getRuntimeConfig()
  assertDatabaseMigrated(resolveDatabaseFile(config))
  getDatabase().sqlite.prepare('SELECT 1').get()
  return { status: 'ok', check: 'ready', service: 'project-fur-paws' }
})
