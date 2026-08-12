import type Database from 'better-sqlite3'
import type {
  PublicationStatus,
  UpdateFields,
  UpdateType,
} from '../../../shared/types/contracts'

export interface UpdateRow {
  content: string
  createdAt: number
  id: string
  publicationStatus: PublicationStatus
  publishedAt: number | null
  title: string
  type: UpdateType
  updatedAt: number
  version: number
}

const selectUpdate = `
  SELECT
    id,
    type,
    title,
    content,
    publication_status AS publicationStatus,
    published_at AS publishedAt,
    version,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM updates
`

export function findUpdate(sqlite: Database.Database, id: string) {
  return sqlite.prepare(`${selectUpdate} WHERE id = ?`)
    .get(id) as UpdateRow | undefined
}

/** 后台列表最近改动优先；ID 是稳定的并列排序键。 */
export function listUpdates(sqlite: Database.Database) {
  return sqlite.prepare(`
    ${selectUpdate}
    ORDER BY updated_at DESC, id
  `).all() as UpdateRow[]
}

export function insertUpdate(
  sqlite: Database.Database,
  input: UpdateFields & { id: string },
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO updates (
      id, type, title, content, publication_status,
      version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'draft', 1, ?, ?)
  `).run(input.id, input.type, input.title, input.content, now, now)
}

/** 正文编辑不接触 published_at，因此已发布动态不会被重新置顶。 */
export function updateUpdateRow(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  input: UpdateFields,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE updates
    SET type = ?, title = ?, content = ?,
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?
  `).run(
    input.type,
    input.title,
    input.content,
    now,
    id,
    expectedVersion,
  ).changes
}

/** 首次发布及下架后的再次发布都使用本次发布时间。 */
export function publishUpdateRow(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE updates
    SET publication_status = 'published', published_at = ?,
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ? AND publication_status != 'published'
  `).run(now, now, id, expectedVersion).changes
}

/** 下架保留最后一次发布时间，既满足历史语义，也符合数据库约束。 */
export function unpublishUpdateRow(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE updates
    SET publication_status = 'unpublished',
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ? AND publication_status = 'published'
  `).run(now, id, expectedVersion).changes
}

export function deleteUpdateRow(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
) {
  return sqlite.prepare(`
    DELETE FROM updates WHERE id = ? AND version = ?
  `).run(id, expectedVersion).changes
}

/** 只写动作和资源 ID；标题、正文等业务内容不进入审计记录。 */
export function insertUpdateAuditLog(
  sqlite: Database.Database,
  input: {
    action: string
    actorUserId: string
    id: string
    updateId: string
  },
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, entity_type, entity_id, result, created_at
    ) VALUES (?, ?, ?, 'UPDATE', ?, 'SUCCESS', ?)
  `).run(input.id, input.actorUserId, input.action, input.updateId, now)
}
