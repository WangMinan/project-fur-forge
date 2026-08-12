import {
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import { ServiceError } from '../../server/utils/service-error'
import {
  createUpdate,
  deleteUpdate,
  editUpdate,
  listAdminUpdates,
  publishUpdate,
  unpublishUpdate,
} from '../../server/utils/service/update'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NOW = Date.UTC(2026, 7, 12, 9)

let directory: string
let sqlite: Database.Database

function insertUser() {
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-update-'))
  const file = resolve(directory, 'studio.db')
  await migrateDatabase(file)
  sqlite = openDatabase(file).sqlite
  insertUser()
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('update management', () => {
  it('creates and edits a draft with audited CAS versions', () => {
    const created = createUpdate(sqlite, {
      type: 'event',
      title: '参展通知',
      content: '周末见。',
    }, USER_ID, NOW)

    expect(created).toMatchObject({
      publicationStatus: 'draft',
      publishedAt: null,
      version: 1,
    })
    const edited = editUpdate(sqlite, created.id, 1, {
      type: 'event',
      title: '参展通知更新',
      content: '周六周日都在。',
    }, USER_ID, NOW + 1)
    expect(edited).toMatchObject({
      title: '参展通知更新',
      version: 2,
    })
    expect(() => editUpdate(sqlite, created.id, 1, {
      type: 'other',
      title: '过期写入',
      content: '不会保存。',
    }, USER_ID, NOW + 2)).toThrow(ServiceError)

    expect(sqlite.prepare(`
      SELECT action, entity_type AS entityType, result
      FROM audit_logs WHERE entity_id = ? ORDER BY created_at
    `).all(created.id)).toEqual([
      { action: 'UPDATE_CREATE', entityType: 'UPDATE', result: 'SUCCESS' },
      { action: 'UPDATE_EDIT', entityType: 'UPDATE', result: 'SUCCESS' },
    ])
  })

  it('refreshes publish time on republish but not on published edits', () => {
    const created = createUpdate(sqlite, {
      type: 'drop',
      title: '掉落预告',
      content: '第一次预告。',
    }, USER_ID, NOW)
    const published = publishUpdate(sqlite, created.id, 1, USER_ID, NOW + 10)
    expect(published).toMatchObject({
      publicationStatus: 'published',
      publishedAt: new Date(NOW + 10).toISOString(),
      version: 2,
    })

    const edited = editUpdate(sqlite, created.id, 2, {
      type: 'drop',
      title: '掉落预告（补充）',
      content: '正文已更新。',
    }, USER_ID, NOW + 20)
    expect(edited.publishedAt).toBe(published.publishedAt)

    const unpublished = unpublishUpdate(
      sqlite,
      created.id,
      3,
      USER_ID,
      NOW + 30,
    )
    expect(unpublished).toMatchObject({
      publicationStatus: 'unpublished',
      publishedAt: published.publishedAt,
      version: 4,
    })
    const republished = publishUpdate(
      sqlite,
      created.id,
      4,
      USER_ID,
      NOW + 40,
    )
    expect(republished.publishedAt).toBe(new Date(NOW + 40).toISOString())
  })

  it('lists latest edits first and deletes any publication state by version', () => {
    const older = createUpdate(sqlite, {
      type: 'other',
      title: '旧动态',
      content: '旧内容。',
    }, USER_ID, NOW)
    const newer = createUpdate(sqlite, {
      type: 'commission_open',
      title: '新动态',
      content: '新内容。',
    }, USER_ID, NOW + 1)
    expect(listAdminUpdates(sqlite).map(item => item.id)).toEqual([
      newer.id,
      older.id,
    ])

    const published = publishUpdate(sqlite, newer.id, 1, USER_ID, NOW + 2)
    expect(deleteUpdate(
      sqlite,
      published.id,
      published.version,
      USER_ID,
      NOW + 3,
    )).toEqual({ id: newer.id })
    expect(listAdminUpdates(sqlite).map(item => item.id)).toEqual([older.id])
  })

  it('enforces the database enum, trim, publication-time and version checks', () => {
    const insert = sqlite.prepare(`
      INSERT INTO updates (
        id, type, title, content, publication_status,
        published_at, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    expect(() => insert.run(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'news',
      '标题',
      '正文',
      'draft',
      null,
      1,
      NOW,
      NOW,
    )).toThrow(/updates_type/u)
    expect(() => insert.run(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'other',
      ' 标题 ',
      '正文',
      'draft',
      null,
      1,
      NOW,
      NOW,
    )).toThrow(/updates_title/u)
    expect(() => insert.run(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'other',
      '标题',
      '正文',
      'published',
      null,
      1,
      NOW,
      NOW,
    )).toThrow(/updates_publication_time/u)
    expect(() => insert.run(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'other',
      '标题',
      '正文',
      'draft',
      null,
      0,
      NOW,
      NOW,
    )).toThrow(/updates_version_positive/u)
  })
})
