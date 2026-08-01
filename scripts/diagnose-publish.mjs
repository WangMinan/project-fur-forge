// Diagnose: run the real publish media pipeline with wrapped storage to surface
// the underlying error that generateOne() swallows.
import { openDatabase } from '../server/utils/database.ts'
import { generatePublicVariants } from '../server/utils/media-recipe.ts'
import { AliOssMediaStorage } from '../server/utils/media-storage.ts'
import { getRuntimeConfig } from '../server/utils/runtime-config.ts'

const WORK_ID = '018896d6-d4af-4e5e-be67-ef32ff613d23'

const config = getRuntimeConfig()
console.log('mediaBaseUrl:', config.mediaBaseUrl)
console.log('ossUploadBaseUrl:', config.ossUploadBaseUrl)
console.log('publicBucket:', config.ossPublicBucket)

const storage = new AliOssMediaStorage(config)
for (const name of [
  'putPrivateConditional',
  'headPrivate',
  'processPrivateToPublic',
  'headPublic',
  'imageInfoPublic',
  'getPublicAnonymous',
  'deletePublic',
]) {
  const original = storage[name].bind(storage)
  storage[name] = async (...args) => {
    const label = name === 'processPrivateToPublic'
      ? `${name} ${JSON.stringify(args[0])}`
      : `${name} ${args[0]}`
    try {
      const result = await original(...args)
      console.log(`OK   ${label}`)
      return result
    }
    catch (error) {
      console.error(`FAIL ${label}`)
      console.error('  underlying error:', error)
      throw error
    }
  }
}

const { sqlite } = openDatabase('.data/dev.db')
try {
  const photos = sqlite.prepare(`
    SELECT asset_id AS assetId FROM work_assets
    WHERE work_id = ? AND role = 'studio_photo' ORDER BY position
  `).all(WORK_ID)
  for (const photo of photos) {
    console.log(`\n=== generatePublicVariants for asset ${photo.assetId} ===`)
    try {
      const variants = await generatePublicVariants(
        sqlite,
        storage,
        photo.assetId,
        ['work-card', 'detail'],
      )
      console.log('generated', variants.length, 'variants')
      break
    }
    catch (error) {
      console.error('generatePublicVariants threw:', error?.message ?? error)
      break
    }
  }
}
finally {
  sqlite.close()
}
