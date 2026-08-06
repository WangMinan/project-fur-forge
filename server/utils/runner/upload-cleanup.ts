import type Database from 'better-sqlite3'
import { getDatabase } from '../database'
import { getMediaStorage } from '../media-storage'
import type { MediaStorage } from '../media-storage'
import { safeLog } from '../safe-log'

/**
 * T34-F5 过期上传会话主动清扫。
 *
 * 安全边界：
 * - 只处理已过期且未完成的会话（AWAITING_UPLOAD 过期、FAILED、CANCELLED、EXPIRED）；
 * - **基于数据库记录逐个删除精确 Object Key**，绝不使用宽泛 prefix delete；
 * - 永久原图（COMPLETED 会话已转为 asset）不在扫描范围内；
 * - 幂等：重复运行不会重复计数已清理的会话；
 * - 单个对象删除失败只记录失败原因并继续，可重试。
 */
export interface UploadCleanupResult {
  deletedObjects: number
  dryRun: boolean
  failed: number
  scanned: number
}

interface ExpiredSessionRow {
  id: string
  privateObjectKey: string
  status: string
}

const CLEANABLE_STATUSES = ['AWAITING_UPLOAD', 'FAILED', 'CANCELLED', 'EXPIRED']

export function findExpiredUploadSessions(
  sqlite: Database.Database,
  now: number,
  limit: number,
) {
  const placeholders = CLEANABLE_STATUSES.map(() => '?').join(', ')
  return sqlite.prepare(`
    SELECT id, private_object_key AS privateObjectKey, status
    FROM upload_sessions
    WHERE status IN (${placeholders})
      AND expires_at <= ?
      AND asset_id IS NULL
      AND cleaned_at IS NULL
    ORDER BY expires_at
    LIMIT ?
  `).all(...CLEANABLE_STATUSES, now, limit) as ExpiredSessionRow[]
}

export async function cleanupExpiredUploads(options: {
  dryRun?: boolean
  limit?: number
  now?: number
  sqlite?: Database.Database
  storage?: MediaStorage
} = {}): Promise<UploadCleanupResult> {
  const sqlite = options.sqlite ?? getDatabase().sqlite
  const now = options.now ?? Date.now()
  const limit = Math.max(1, Math.min(options.limit ?? 200, 1_000))
  // 默认 dry-run：必须显式传 false 才真正删除。
  const dryRun = options.dryRun !== false

  const sessions = findExpiredUploadSessions(sqlite, now, limit)
  const result: UploadCleanupResult = {
    scanned: sessions.length,
    deletedObjects: 0,
    failed: 0,
    dryRun,
  }
  if (dryRun || sessions.length === 0) {
    return result
  }

  const storage = options.storage ?? getMediaStorage()
  const markCleaned = sqlite.prepare(`
    UPDATE upload_sessions
    SET status = CASE WHEN status = 'AWAITING_UPLOAD' THEN 'EXPIRED' ELSE status END,
        cleaned_at = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND cleaned_at IS NULL
  `)

  for (const session of sessions) {
    try {
      // 精确 Key 删除；deletePrivate 对 NoSuchKey 静默成功，因此幂等。
      await storage.deletePrivate(session.privateObjectKey)
      markCleaned.run(now, now, session.id)
      result.deletedObjects += 1
    }
    catch (error) {
      result.failed += 1
      safeLog('warn', 'Expired upload cleanup failed for one session.', {
        sessionId: session.id,
        errorCode: (error as { code?: unknown }).code,
      })
    }
  }

  safeLog('info', 'Expired upload cleanup finished.', {
    scanned: result.scanned,
    deleted: result.deletedObjects,
    failed: result.failed,
  })
  return result
}
