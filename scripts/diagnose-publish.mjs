// Diagnose: run the real publish media pipeline with wrapped storage to surface
// the underlying error that generateOne() swallows.
import { openDatabase } from '../server/utils/database.ts'
import { generatePublicVariants } from '../server/utils/media-recipe.ts'
import { AliOssMediaStorage } from '../server/utils/media-storage.ts'
import { getRuntimeConfig } from '../server/utils/runtime-config.ts'
import { ossErrorSummary } from './oss-preflight-core.mjs'

const WORK_ID = '018896d6-d4af-4e5e-be67-ef32ff613d23'

const config = getRuntimeConfig()
console.log('OSS runtime configuration loaded:', Boolean(
  config.ossPrivateBucket && config.ossPublicBucket && config.ossEndpoint,
))

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
    const label = name
    try {
      const result = await original(...args)
      console.log(`OK   ${label}`)
      return result
    }
    catch (error) {
      console.error(`FAIL ${label}`)
      console.error('  OSS error:', ossErrorSummary(error))
      throw error
    }
  }
}

const { sqlite } = openDatabase('.data/dev.db')
try {
  const photos = sqlite.prepare(`
    SELECT relation.asset_id AS assetId,
           count(variant.id) AS readyPublicVariants
    FROM work_assets AS relation
    LEFT JOIN asset_variants AS variant
      ON variant.asset_id = relation.asset_id
      AND variant.storage_scope = 'PUBLIC'
      AND variant.status = 'READY'
    WHERE relation.work_id = ? AND relation.role = 'studio_photo'
    GROUP BY relation.asset_id
    HAVING count(variant.id) < 12
    ORDER BY relation.position
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
