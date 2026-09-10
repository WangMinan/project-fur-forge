import type Database from 'better-sqlite3'
import type { PublicSourceSetDto } from '../../../shared/types/contracts'
import type { RuntimeConfig } from '../runtime-config'
import { toPublicSourceSetDto } from './media-mapper'
import type { VariantRecord } from './media-mapper'
import { effectiveWorkUsage, mediaRecipeVersion, publicObjectKey, publicRecipeWidths, PUBLIC_RECIPE_VERSIONS, recipeIdentity } from './media-recipe'
import type { PublicMediaUsage } from './media-recipe'
import { processingSource, readyAssetSource } from './media-source'

export function publicWorkAssetSources(sqlite: Database.Database, assetId: string, requestedUsage: PublicMediaUsage,
  mediaBaseUrl = 'https://public-media.ditedog.com', appEnv: RuntimeConfig['appEnv'] = 'development'): PublicSourceSetDto | null {
  try {
    const asset = readyAssetSource(sqlite, assetId)
    const usage = asset.imageCompositionVersion ? effectiveWorkUsage(asset, requestedUsage) : requestedUsage
    let variants = sqlite.prepare(`SELECT id, storage_scope AS storageScope,status,object_key AS objectKey,width,height,format,
      input_sha256 AS inputSha256,internal_error_code AS internalErrorCode,media_role AS mediaRole,recipe_version AS recipeVersion,
      sha256,byte_size AS byteSize,usage FROM asset_variants WHERE asset_id=? AND usage=? AND storage_scope='PUBLIC' AND status='READY'
      AND length(sha256)=64 AND sha256 NOT GLOB '*[^0-9a-f]*' AND byte_size>0`).all(assetId, usage) as VariantRecord[]
    if (asset.imageCompositionVersion) {
      const source = processingSource(sqlite, asset)
      const fallback = asset.mimeType === 'image/png' ? 'png' : 'jpeg'
      const keys = new Set(publicRecipeWidths(usage).flatMap(width => ['webp', fallback].map(format =>
        publicObjectKey(asset, usage, width, recipeIdentity(asset, source, usage, width, format as 'webp' | 'png' | 'jpeg'), format as 'webp' | 'png' | 'jpeg'))))
      variants = variants.filter(variant => keys.has(variant.objectKey) && variant.recipeVersion === mediaRecipeVersion(usage))
      return toPublicSourceSetDto(variants, mediaBaseUrl, publicRecipeWidths(usage), appEnv)
    }
    for (const version of PUBLIC_RECIPE_VERSIONS) {
      try {
        const result = toPublicSourceSetDto(variants.filter(variant => variant.recipeVersion === version), mediaBaseUrl, publicRecipeWidths(usage), appEnv)
        if (usage === 'work-card' && [...result.webp, ...result.fallback].some(variant => variant.height !== Math.round(variant.width * 4 / 3))) continue
        return result
      }
      catch { /* Only a complete legacy source set may be used. */ }
    }
  }
  catch { /* A missing or not-ready source is not publicly usable. */ }
  return null
}
