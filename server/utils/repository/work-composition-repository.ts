import type Database from 'better-sqlite3'
import type { CompositionUsage, ImageComposition, ImageCompositions } from '../../../shared/schemas/image-composition'

export interface CompositionRow {
  workId: string
  assetId: string
  usage: CompositionUsage
  mode: 'contain' | 'crop'
  x: number | null
  y: number | null
  width: number | null
  height: number | null
}

export function workCompositionRows(sqlite: Database.Database, workId: string) {
  return sqlite.prepare('SELECT work_id AS workId, asset_id AS assetId, usage, mode, x, y, width, height FROM work_asset_compositions WHERE work_id = ?').all(workId) as CompositionRow[]
}

export function assetCompositions(sqlite: Database.Database, assetId: string): ImageCompositions {
  const rows = sqlite.prepare('SELECT usage, mode, x, y, width, height FROM work_asset_compositions WHERE asset_id = ?').all(assetId) as CompositionRow[]
  return Object.fromEntries(rows.map(row => [row.usage, row.mode === 'contain'
    ? { mode: 'contain' }
    : { mode: 'crop', rect: { x: row.x!, y: row.y!, width: row.width!, height: row.height! } }]))
}

export function putComposition(sqlite: Database.Database, workId: string, assetId: string, usage: CompositionUsage, value: ImageComposition | null) {
  sqlite.prepare('DELETE FROM work_asset_compositions WHERE work_id = ? AND asset_id = ? AND usage = ?').run(workId, assetId, usage)
  if (!value) return
  const rect = value.mode === 'crop' ? value.rect : null
  sqlite.prepare('INSERT INTO work_asset_compositions (work_id,asset_id,usage,mode,x,y,width,height) VALUES (?,?,?,?,?,?,?,?)')
    .run(workId, assetId, usage, value.mode, rect?.x ?? null, rect?.y ?? null, rect?.width ?? null, rect?.height ?? null)
}

/** The media editors replace associations; only restore crops of retained assets. */
export function restoreWorkCompositions(sqlite: Database.Database, rows: CompositionRow[]) {
  const insert = sqlite.prepare(`INSERT OR IGNORE INTO work_asset_compositions (work_id,asset_id,usage,mode,x,y,width,height)
    SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM work_assets WHERE work_id = ? AND asset_id = ?)`)
  for (const row of rows) insert.run(row.workId, row.assetId, row.usage, row.mode, row.x, row.y, row.width, row.height, row.workId, row.assetId)
}
