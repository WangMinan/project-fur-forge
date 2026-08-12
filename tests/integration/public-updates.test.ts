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
import { listPublishedUpdates } from '../../server/utils/repository/public-update-repository'
import {
  createUpdate,
  editUpdate,
  publishUpdate,
  unpublishUpdate,
} from '../../server/utils/service/update'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NOW = Date.UTC(2026, 7, 12, 9)

let directory: string
let sqlite: Database.Database

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-public-update-'))
  const file = resolve(directory, 'studio.db')
  await migrateDatabase(file)
  sqlite = openDatabase(file).sqlite
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('public updates repository', () => {
  it('returns only published rows in latest publish order', () => {
    const draft = createUpdate(sqlite, {
      type: 'other',
      title: '草稿',
      content: '不公开。',
    }, USER_ID, NOW)
    const older = createUpdate(sqlite, {
      type: 'event',
      title: '较早发布',
      content: '较早正文。',
    }, USER_ID, NOW + 1)
    const newer = createUpdate(sqlite, {
      type: 'commission_open',
      title: '较新发布',
      content: '较新正文。',
    }, USER_ID, NOW + 2)
    publishUpdate(sqlite, older.id, 1, USER_ID, NOW + 10)
    publishUpdate(sqlite, newer.id, 1, USER_ID, NOW + 20)

    expect(listPublishedUpdates(sqlite).map(item => item.title)).toEqual([
      '较新发布',
      '较早发布',
    ])
    expect(JSON.stringify(listPublishedUpdates(sqlite))).not.toContain(draft.id)

    unpublishUpdate(sqlite, newer.id, 2, USER_ID, NOW + 30)
    expect(listPublishedUpdates(sqlite).map(item => item.title)).toEqual([
      '较早发布',
    ])
  })

  it('returns the strict public projection and preserves published edit order', () => {
    const created = createUpdate(sqlite, {
      type: 'drop',
      title: '掉落预告',
      content: '第一行\n第二行',
    }, USER_ID, NOW)
    const published = publishUpdate(sqlite, created.id, 1, USER_ID, NOW + 10)
    editUpdate(sqlite, created.id, 2, {
      type: 'drop',
      title: '掉落预告更新',
      content: '更新后的纯文本。',
    }, USER_ID, NOW + 20)

    expect(listPublishedUpdates(sqlite)).toEqual([{
      id: created.id,
      type: 'drop',
      title: '掉落预告更新',
      content: '更新后的纯文本。',
      publishedAt: published.publishedAt,
    }])
    const serialized = JSON.stringify(listPublishedUpdates(sqlite))
    for (const privateField of [
      'publicationStatus',
      'version',
      'createdAt',
      'updatedAt',
      'privateObjectKey',
      'signedUrl',
    ]) {
      expect(serialized).not.toContain(privateField)
    }
  })

  it('supports a bounded latest summary without changing full-list order', () => {
    for (let index = 0; index < 5; index += 1) {
      const created = createUpdate(sqlite, {
        type: 'other',
        title: `动态 ${index + 1}`,
        content: `正文 ${index + 1}`,
      }, USER_ID, NOW + index)
      publishUpdate(sqlite, created.id, 1, USER_ID, NOW + index * 10)
    }
    expect(listPublishedUpdates(sqlite, 3).map(item => item.title)).toEqual([
      '动态 5',
      '动态 4',
      '动态 3',
    ])
    expect(listPublishedUpdates(sqlite)).toHaveLength(5)
  })
})
