import type Database from 'better-sqlite3'

export const UPLOAD_VALIDATION_IDLE_MS = 5 * 60_000
export const UPLOAD_VALIDATION_HEARTBEAT_MS = 20_000

export function recoverStaleUploadValidations(sqlite: Database.Database, now = Date.now()) {
  // A live validator renews updated_at; completed sessions and attached originals are excluded.
  return sqlite.prepare(`
    UPDATE upload_sessions SET status = 'FAILED', failure_code = 'UPLOAD_STORAGE_FAILURE',
      failure_stage = 'DATABASE', version = version + 1, updated_at = ?
    WHERE id IN (
      SELECT id FROM upload_sessions WHERE status = 'VALIDATING' AND asset_id IS NULL
        AND updated_at <= ? ORDER BY updated_at LIMIT 200
    ) AND status = 'VALIDATING' AND asset_id IS NULL AND updated_at <= ?
  `).run(now, now - UPLOAD_VALIDATION_IDLE_MS, now - UPLOAD_VALIDATION_IDLE_MS).changes
}

export function renewUploadValidation(sqlite: Database.Database, id: string, version: number, now = Date.now()) {
  return sqlite.prepare(`UPDATE upload_sessions SET updated_at = ?
    WHERE id = ? AND version = ? AND status = 'VALIDATING' AND asset_id IS NULL`)
    .run(now, id, version).changes === 1
}
