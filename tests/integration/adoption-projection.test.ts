import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSyntheticWatermarkPng } from '../../scripts/oss-preflight-core.mjs'
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import { generatePublicVariants } from '../../server/utils/recipe/media-recipe'
import { createSqlitePublicSiteRepository } from '../../server/utils/repository/public-site-repository'
import { FakeMediaStorage } from '../helpers/fake-media-storage'
import { insertActiveWatermarkProfile } from '../helpers/watermark-fixture'

const NOW = Date.UTC(2026, 7, 16)
const MEDIA_BASE_URL = 'https://media.example.com'
const PREFIX = 'test/r3-d-adoption'

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

function insertAdoption(input: {
  id: string
  name: string
  slug: string
  status: 'available' | 'adopted'
}) {
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, purpose, adoption_status,
      price_amount_minor, price_currency, publication_status,
      sort_order, version, published_at, created_at, updated_at
    ) VALUES (?, ?, ?, '犬科', 'adoption', ?, 128000, 'CNY',
      'published', 0, 1, ?, ?, ?)
  `).run(input.id, input.slug, input.name, input.status, NOW, NOW, NOW)
}

async function attachPublicAsset(input: {
  id: string
  role: 'adoption_cover' | 'studio_photo'
  workId: string
}) {
  const width = input.role === 'adoption_cover' ? 1920 : 2400
  const height = input.role === 'adoption_cover' ? 1080 : 1600
  const content = createSyntheticWatermarkPng(width, height)
  const sha = createHash('sha256').update(content).digest('hex')
  const key = `${PREFIX}/original/${input.id}.png`
  storage.seedPrivate(key, content, 'image/png', sha)
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, ?, 'READY', ?, ?, ?, 'image/png', ?, ?, ?, ?)
  `).run(input.id, input.role, key, sha, content.length, width, height, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO work_assets (
      work_id, asset_id, role, alt_text, position, is_primary
    ) VALUES (?, ?, ?, ?, 0, ?)
  `).run(
    input.workId,
    input.id,
    input.role,
    input.role === 'adoption_cover' ? '合成领养横版封面' : '合成主出厂照',
    input.role === 'studio_photo' ? 1 : 0,
  )
  await generatePublicVariants(sqlite, storage, input.id, undefined, NOW)
}

async function seedCompleteAdoption(input: {
  id: string
  name: string
  slug: string
  status: 'available' | 'adopted'
}) {
  insertAdoption(input)
  await attachPublicAsset({
    id: `${input.id.slice(0, -1)}1`,
    role: 'adoption_cover',
    workId: input.id,
  })
  await attachPublicAsset({
    id: `${input.id.slice(0, -1)}2`,
    role: 'studio_photo',
    workId: input.id,
  })
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-adoption-projection-'))
  const databaseFile = resolve(directory, 'adoption.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
  insertActiveWatermarkProfile(sqlite, NOW, { environmentPrefix: PREFIX, storage })
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('R3-D adoption public projection', () => {
  it('lists both explicit statuses and supports name-only search', async () => {
    await seedCompleteAdoption({
      id: '11111111-1111-4111-8111-111111111110',
      name: '云朵',
      slug: 'cloud',
      status: 'available',
    })
    await seedCompleteAdoption({
      id: '22222222-2222-4222-8222-222222222220',
      name: '团子',
      slug: 'tuanzi',
      status: 'adopted',
    })

    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    expect(repository.listAdoptions().items.map(item => item.work.adoptionStatus))
      .toEqual(['available', 'adopted'])
    const searched = repository.listAdoptions({ q: ' 团子 ' })
    expect(searched.filter).toEqual({ valid: true })
    expect(searched.items.map(item => item.work.slug)).toEqual(['tuanzi'])
    expect(repository.listAdoptions({ q: '' }).resultCount).toBe(2)
  })

  it('uses the independent cover for the adoption card and primary studio photo for detail', async () => {
    await seedCompleteAdoption({
      id: '33333333-3333-4333-8333-333333333330',
      name: '星糖',
      slug: 'star-candy',
      status: 'available',
    })
    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    const adoption = repository.listAdoptions().items[0]!
    const detail = repository.getWorkBySlug('star-candy')

    expect(adoption.cover.assetId).toBe('33333333-3333-4333-8333-333333333331')
    expect(detail?.media.primaryAssetId)
      .toBe('33333333-3333-4333-8333-333333333332')
    expect(detail?.media.designSheet).toBeUndefined()
    expect(JSON.stringify({ adoption, detail })).not.toContain('/original/')
  })

  it('includes complete adoptions in the home aggregate without retired event fields', async () => {
    await seedCompleteAdoption({
      id: '44444444-4444-4444-8444-444444444440',
      name: '栗子',
      slug: 'chestnut',
      status: 'available',
    })
    const aggregate = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
      .getHomeAggregate()
    const serialized = JSON.stringify(aggregate.currentAdoptions)

    expect(aggregate.currentAdoptions.items).toHaveLength(1)
    expect(serialized).not.toContain('adoptionMethod')
    expect(serialized).not.toContain('eventName')
    expect(serialized).not.toContain('eventTime')
  })
})
