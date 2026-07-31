import { migrateDatabase, resolveDatabaseFile } from '../server/utils/database'
import { loadRuntimeConfig } from '../server/utils/runtime-config'

const databaseFile = resolveDatabaseFile(loadRuntimeConfig())
const result = await migrateDatabase(databaseFile)

console.log(JSON.stringify({
  applied: result.applied,
  backupCreated: Boolean(result.backupFile),
  databaseFile,
}))
