import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import {
  createSqlitePublicSiteRepository,
} from '../../server/utils/repository/public-site-repository'

const MEDIA_BASE_URL = 'https://media.example.test'
const NOW = Date.UTC(2026, 7, 12, 12)

let directory: string
let sqlite: Database.Database

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-home-updates-'))
  const file = resolve(directory, 'studio.db')
  await migrateDatabase(file)
  sqlite = openDatabase(file).sqlite
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

function insertUpdate(input: {
  id: string
  publicationStatus: 'draft' | 'published' | 'unpublished'
  publishedAt: number | null
  title: string
}) {
  sqlite.prepare(`
    INSERT INTO updates (
      id, type, title, content, publication_status,
      published_at, version, created_at, updated_at
    ) VALUES (?, 'other', ?, ?, ?, ?, 1, ?, ?)
  `).run(
    input.id,
    input.title,
    `${input.title} 正文`,
    input.publicationStatus,
    input.publishedAt,
    NOW,
    NOW,
  )
}

describe('T12 home latest updates projection', () => {
  it('returns only the latest three published updates in publication order', () => {
    insertUpdate({ id: '11111111-1111-4111-8111-111111111111', publicationStatus: 'published', publishedAt: NOW + 1, title: '第一条' })
    insertUpdate({ id: '22222222-2222-4222-8222-222222222222', publicationStatus: 'published', publishedAt: NOW + 2, title: '第二条' })
    insertUpdate({ id: '33333333-3333-4333-8333-333333333333', publicationStatus: 'published', publishedAt: NOW + 3, title: '第三条' })
    insertUpdate({ id: '44444444-4444-4444-8444-444444444444', publicationStatus: 'published', publishedAt: NOW + 4, title: '第四条' })
    insertUpdate({ id: '55555555-5555-4555-8555-555555555555', publicationStatus: 'draft', publishedAt: null, title: '草稿' })
    insertUpdate({ id: '66666666-6666-4666-8666-666666666666', publicationStatus: 'unpublished', publishedAt: NOW + 6, title: '已下架' })

    const aggregate = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
      .getHomeAggregate()

    expect(aggregate.latestUpdates).toMatchObject({
      available: true,
      items: [
        { title: '第四条' },
        { title: '第三条' },
        { title: '第二条' },
      ],
    })
    expect(JSON.stringify(aggregate.latestUpdates)).not.toContain('草稿')
    expect(JSON.stringify(aggregate.latestUpdates)).not.toContain('已下架')
  })

  it('hides only the updates section when its query fails', () => {
    const prepare = sqlite.prepare.bind(sqlite)
    const spy = vi.spyOn(sqlite, 'prepare').mockImplementation(((source: string) => {
      if (/\bFROM\s+updates\b/iu.test(source)) {
        throw new Error('updates temporarily unavailable')
      }
      return prepare(source)
    }) as typeof sqlite.prepare)

    try {
      const aggregate = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
        .getHomeAggregate()
      expect(aggregate.latestUpdates).toEqual({ available: false, items: [] })
      expect(aggregate.hero).toBeTruthy()
      expect(aggregate.featured.available).toBe(true)
      expect(aggregate.currentAdoptions.available).toBe(true)
    }
    finally {
      spy.mockRestore()
    }
  })
})
