import {
  assertDatabaseMigrated,
  getDatabase,
  resolveDatabaseFile,
} from '../../utils/database'
import { getRuntimeConfig } from '../../utils/runtime-config'

export default defineEventHandler(() => {
  const config = getRuntimeConfig()
  assertDatabaseMigrated(resolveDatabaseFile(config))
  const sqlite = getDatabase().sqlite
  const siteReady = sqlite.prepare(`
    SELECT 1 FROM site_content WHERE id = 'site'
  `).pluck().get() === 1
  if (!siteReady) {
    throw createError({ statusCode: 503, statusMessage: 'Site data is not ready.' })
  }
  return {
    status: 'ok',
    check: 'ready',
    service: 'project-fur-paws',
  }
})
