import {
  assertDatabaseMigrated,
  openDatabase,
  resolveDatabaseFile,
} from '../server/utils/database'
import { AliOssMediaStorage } from '../server/utils/media-storage'
import {
  loadRuntimeConfig,
} from '../server/utils/runtime-config'
import { seedBundledWatermark } from '../server/utils/watermark-seed'

const config = loadRuntimeConfig()
const databaseFile = resolveDatabaseFile(config)
assertDatabaseMigrated(databaseFile)
const database = openDatabase(databaseFile)

try {
  const result = await seedBundledWatermark(
    database.sqlite,
    new AliOssMediaStorage(config),
    config,
  )
  console.log(JSON.stringify(result))
}
catch (error) {
  throw new Error('Watermark initialization failed.', { cause: error })
}
finally {
  database.sqlite.close()
}
