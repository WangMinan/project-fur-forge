import type Database from 'better-sqlite3'
import { imageCompositionsSchema } from '../../../shared/schemas/image-composition'
import type { CompositionUsage, ImageCompositions } from '../../../shared/schemas/image-composition'
import { allowedCompositionUsages, compositionError, fitCrop } from '../../../shared/utils/image-composition'
import { putComposition, workCompositionRows } from '../repository/work-composition-repository'
import { ServiceError } from '../service-error'

export function beginCompositionEdit(sqlite: Database.Database, workId: string, edits: ReadonlyArray<{ compositions?: ImageCompositions | undefined }>) {
  if (edits.some(edit => Object.keys(edit.compositions ?? {}).length > 0)) {
    const version = sqlite.prepare('SELECT image_composition_version FROM works WHERE id = ?').pluck().get(workId)
    if (version === 0) {
      const photos = sqlite.prepare(`SELECT r.asset_id AS assetId, a.width, a.height, r.focal_x AS focalX, r.focal_y AS focalY,
        r.crop_x AS x, r.crop_y AS y, r.crop_width AS cropWidth, r.crop_height AS cropHeight
        FROM work_assets r JOIN assets a ON a.id=r.asset_id WHERE r.work_id=? AND r.role='studio_photo'
        AND r.is_primary=1`).all(workId) as Array<{
        assetId: string, width: number, height: number, focalX: number, focalY: number, x: number, y: number, cropWidth: number, cropHeight: number
      }>
      const gravity = (value: number) => value < 1 / 3 ? 0 : value > 2 / 3 ? 1 : 0.5
      for (const photo of photos) {
        const rect = fitCrop(photo.width, photo.height, 3 / 4, { x: photo.x, y: photo.y, width: photo.cropWidth, height: photo.cropHeight }, gravity(photo.focalX), gravity(photo.focalY))
        putComposition(sqlite, workId, photo.assetId, 'home-featured', { mode: 'crop', rect })
        putComposition(sqlite, workId, photo.assetId, 'work-catalog', { mode: 'crop', rect: fitCrop(photo.width, photo.height, 4 / 5, rect) })
      }
      sqlite.prepare('UPDATE works SET image_composition_version=1 WHERE id=?').run(workId)
    }
  }
  return workCompositionRows(sqlite, workId)
}

export function saveAssetCompositions(sqlite: Database.Database, workId: string, assetId: string, input?: ImageCompositions) {
  if (input === undefined) return
  const parsed = imageCompositionsSchema.safeParse(input)
  if (!parsed.success) throw new ServiceError(400, 'VALIDATION_ERROR', '构图配置无效')
  const asset = sqlite.prepare(`SELECT a.role,a.width,a.height FROM assets a JOIN work_assets r ON r.asset_id=a.id WHERE r.work_id=? AND a.id=?`).get(workId, assetId) as { role: string, width: number, height: number } | undefined
  if (!asset) throw new ServiceError(400, 'VALIDATION_ERROR', '图片不属于当前作品')
  for (const [key, value] of Object.entries(parsed.data)) {
    const usage = key as CompositionUsage
    const error = !allowedCompositionUsages(asset.role).includes(usage) ? '图片不支持此构图用途'
      : value ? compositionError(asset.role, usage, value, asset.width, asset.height) : null
    if (error) throw new ServiceError(400, 'VALIDATION_ERROR', error, error.includes('选区过小') ? 'MEDIA_SOURCE_TOO_SMALL' : 'VALIDATION_FAILED')
    putComposition(sqlite, workId, assetId, usage, value ?? null)
  }
}
