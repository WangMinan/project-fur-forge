import type Database from 'better-sqlite3'

export const OPERATION_LEASE_MS = 5 * 60 * 1_000
export const OPERATION_HEARTBEAT_MS = 20 * 1_000

const PUBLICATION_ACTIVE = [
  'PREPARING_SOURCE',
  'GENERATING_PUBLIC',
  'APPLYING_WATERMARK',
  'VERIFYING_PUBLIC',
  'COMMITTING',
  'CLEANING_PUBLIC',
] as const

const WATERMARK_ACTIVE = [
  'GENERATING_PUBLIC',
  'VERIFYING_PUBLIC',
  'SWITCHING_PROFILE',
  'CLEANING_PUBLIC',
] as const

export function leaseExpiresAt(now = Date.now()) {
  return now + OPERATION_LEASE_MS
}

function placeholders(values: readonly string[]) {
  return values.map(() => '?').join(', ')
}

export function heartbeatPublicationOperation(
  sqlite: Database.Database,
  operationId: string,
  now = Date.now(),
) {
  sqlite.prepare(`
    UPDATE publication_operations
    SET heartbeat_at = ?, lease_expires_at = ?
    WHERE id = ? AND status IN (${placeholders(PUBLICATION_ACTIVE)})
  `).run(now, leaseExpiresAt(now), operationId, ...PUBLICATION_ACTIVE)
}

export function heartbeatWatermarkOperation(
  sqlite: Database.Database,
  operationId: string,
  now = Date.now(),
) {
  sqlite.prepare(`
    UPDATE watermark_operations
    SET heartbeat_at = ?, lease_expires_at = ?
    WHERE id = ? AND status IN (${placeholders(WATERMARK_ACTIVE)})
  `).run(now, leaseExpiresAt(now), operationId, ...WATERMARK_ACTIVE)
}

function heartbeatTimer(beat: () => void) {
  beat()
  const timer = setInterval(beat, OPERATION_HEARTBEAT_MS)
  timer.unref()
  return () => clearInterval(timer)
}

export function startPublicationHeartbeat(
  sqlite: Database.Database,
  operationId: string,
) {
  return heartbeatTimer(() => heartbeatPublicationOperation(sqlite, operationId))
}

export function startWatermarkHeartbeat(
  sqlite: Database.Database,
  operationId: string,
) {
  return heartbeatTimer(() => heartbeatWatermarkOperation(sqlite, operationId))
}

export function recoverExpiredOperations(
  sqlite: Database.Database,
  now = Date.now(),
) {
  const publication = sqlite.prepare(`
    UPDATE publication_operations
    SET status = 'FAILED',
        failure_stage = status,
        internal_error_code = 'OPERATION_INTERRUPTED',
        internal_error_message = 'Operation lease expired after process interruption.',
        completed_at = ?, updated_at = ?, version = version + 1
    WHERE status IN (${placeholders(PUBLICATION_ACTIVE)})
      AND lease_expires_at <= ?
  `).run(now, now, ...PUBLICATION_ACTIVE, now)

  const watermark = sqlite.prepare(`
    UPDATE watermark_operations
    SET status = 'FAILED',
        failure_stage = status,
        internal_error_code = 'OPERATION_INTERRUPTED',
        completed_at = ?, updated_at = ?, version = version + 1
    WHERE status IN (${placeholders(WATERMARK_ACTIVE)})
      AND lease_expires_at <= ?
  `).run(now, now, ...WATERMARK_ACTIVE, now)

  return {
    publication: publication.changes,
    watermark: watermark.changes,
  }
}
