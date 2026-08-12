import type Database from 'better-sqlite3'
import { publicUpdateDtoSchema } from '../../../shared/schemas/update'
import type { PublicUpdateDto } from '../../../shared/types/contracts'

interface PublishedUpdateRow {
  content: string
  id: string
  publishedAt: number
  title: string
  type: PublicUpdateDto['type']
}

/**
 * 最新动态的唯一公开读取入口。
 *
 * SQL 先排除草稿/下架记录，映射后再走严格公开 DTO；管理版本、创建/更新
 * 时间和发布状态都没有进入选择列，因此不能被路由误返回。
 */
export function listPublishedUpdates(
  sqlite: Database.Database,
  limit?: number,
) {
  const safeLimit = limit === undefined
    ? null
    : Math.max(0, Math.trunc(limit))
  const rows = sqlite.prepare(`
    SELECT id, type, title, content, published_at AS publishedAt
    FROM updates
    WHERE publication_status = 'published' AND published_at IS NOT NULL
    ORDER BY published_at DESC, id
    ${safeLimit === null ? '' : 'LIMIT ?'}
  `).all(...(safeLimit === null ? [] : [safeLimit])) as PublishedUpdateRow[]

  return rows.map(row => publicUpdateDtoSchema.parse({
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    publishedAt: new Date(row.publishedAt).toISOString(),
  }))
}
