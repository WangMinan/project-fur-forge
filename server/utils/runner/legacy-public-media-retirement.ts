import { setTimeout as delay } from 'node:timers/promises'
import type Database from 'better-sqlite3'
import type { MediaStorage } from '../media-storage'
import type { PublicMediaCache } from '../public-media-cache'
import { edgePurgeUrlsForObjectKeys } from './public-media-purge'
import { generatePublicVariants, workAssetPublicUsages } from '../recipe/media-recipe'
import { checkWorkPublication } from './work-publication'

export const LEGACY_PUBLIC_MEDIA_CONFIRMATION = 'RETIRE LEGACY PUBLIC MEDIA'
interface PublishedAssetRow {
  assetId: string
  primary: number
  role: 'adoption_cover' | 'design_sheet' | 'studio_photo'
  workId: string
}

function publishedAssets(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT relation.work_id AS workId, relation.asset_id AS assetId,
           relation.role, relation.is_primary AS "primary"
    FROM work_assets AS relation
    JOIN works AS work ON work.id = relation.work_id
    WHERE work.publication_status = 'published'
    ORDER BY relation.work_id, relation.role, relation.position
  `).all() as PublishedAssetRow[]
}

function legacyRows(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT id, object_key AS objectKey
    FROM asset_variants
    WHERE storage_scope = 'PUBLIC'
      AND recipe_version IN ('recipe-v1', 'recipe-v2', 'recipe-v3')
    ORDER BY object_key
  `).all() as Array<{ id: string, objectKey: string }>
}

function missingObject(error: unknown) {
  const candidate = error as { code?: unknown, status?: unknown }
  return candidate.code === 'NoSuchKey' || candidate.status === 404
}

async function purgeKeys(cache: PublicMediaCache, keys: readonly string[]) {
  if (!cache.enabled || keys.length === 0) {
    return 0
  }
  let purged = 0
  for (let start = 0; start < keys.length; start += 1_000) {
    const urls = edgePurgeUrlsForObjectKeys(cache, keys.slice(start, start + 1_000))
    const taskId = await cache.purgeExactFiles(urls)
    let missingCount = 0
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const status = await cache.describeExactFilePurge(taskId, urls)
      if (status === 'Complete') {
        purged += urls.length
        break
      }
      if (status === 'Failed') {
        throw new Error('Legacy public media purge failed.')
      }
      missingCount = status === 'Missing' ? missingCount + 1 : 0
      if (missingCount >= 3) {
        throw new Error('Legacy public media purge task was not found.')
      }
      if (attempt === 19) {
        throw new Error('Legacy public media purge timed out.')
      }
      await delay(2_000)
    }
  }
  return purged
}

export async function retireLegacyPublicMedia(options: {
  cache: PublicMediaCache
  confirmation?: string
  execute?: boolean
  now?: number
  sqlite: Database.Database
  storage: MediaStorage
}) {
  const assets = publishedAssets(options.sqlite)
  const rowsBefore = legacyRows(options.sqlite)
  const plan = {
    legacyVariantCount: rowsBefore.length,
    publishedAssetCount: assets.length,
    publishedWorkCount: new Set(assets.map(row => row.workId)).size,
  }
  if (!options.execute) {
    return { ...plan, executed: false, purgedFileCount: 0 }
  }
  if (options.confirmation !== LEGACY_PUBLIC_MEDIA_CONFIRMATION) {
    throw new Error(`Refusing to execute without --confirm "${LEGACY_PUBLIC_MEDIA_CONFIRMATION}".`)
  }

  const primaryByWork = new Set(
    assets.filter(row => row.role === 'studio_photo' && row.primary === 1)
      .map(row => row.workId),
  )
  for (const row of assets) {
    await generatePublicVariants(
      options.sqlite,
      options.storage,
      row.assetId,
      workAssetPublicUsages(row.role, row.primary === 1, primaryByWork.has(row.workId)),
      options.now ?? Date.now(),
    )
  }
  for (const workId of new Set(assets.map(row => row.workId))) {
    if (checkWorkPublication(options.sqlite, workId).missingVariantCount !== 0) {
      throw new Error('Current public media recipe verification failed.')
    }
  }

  const rows = legacyRows(options.sqlite)
  for (const row of rows) {
    try {
      await options.storage.deletePublic(row.objectKey)
    }
    catch (error) {
      if (!missingObject(error)) {
        throw error
      }
    }
  }
  const purgedFileCount = await purgeKeys(options.cache, rows.map(row => row.objectKey))
  options.sqlite.transaction(() => {
    const remove = options.sqlite.prepare('DELETE FROM asset_variants WHERE id = ?')
    rows.forEach(row => remove.run(row.id))
  })()
  return { ...plan, executed: true, purgedFileCount }
}
