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
    // 有出厂照时卡片仍优先竖版出厂照，封面同时进入详情。
    expect(detail?.media.cardOrientation).toBe('portrait')
    expect(detail?.media.card.assetId).toBe('33333333-3333-4333-8333-333333333332')
    expect(detail?.media.adoptionCover?.assetId)
      .toBe('33333333-3333-4333-8333-333333333331')
    expect(JSON.stringify({ adoption, detail })).not.toContain('/original/')
  })

  it('publishes a head-only adoption into works, featured and detail from its cover alone', async () => {
    const id = '66666666-6666-4666-8666-666666666660'
    const coverId = '66666666-6666-4666-8666-666666666661'
    insertAdoption({ id, name: '小绿狗', slug: 'green-doggy', status: 'available' })
    await attachPublicAsset({ id: coverId, role: 'adoption_cover', workId: id })
    sqlite.prepare(`UPDATE works SET featured = 1`).run()

    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    const detail = repository.getWorkBySlug('green-doggy')

    // 只有横版封面：作品展示、首页精选与详情都必须能看到它。
    expect(repository.listWorks().items.map(item => item.work.slug))
      .toEqual(['green-doggy'])
    expect(repository.listFeaturedWorks().items.map(item => item.work.slug))
      .toEqual(['green-doggy'])
    expect(repository.listAdoptions().items.map(item => item.cover.assetId))
      .toEqual([coverId])

    // 卡片回落到横版封面；详情没有出厂照但有封面。
    expect(detail?.media.cardOrientation).toBe('landscape')
    expect(detail?.media.card.assetId).toBe(coverId)
    expect(detail?.media.adoptionCover?.assetId).toBe(coverId)
    expect(detail?.media.gallery).toEqual([])
    expect(detail?.media.primaryAssetId).toBeNull()
    expect(JSON.stringify(detail)).not.toContain('/original/')
  })

  it('still hides a published commission work that has no primary studio photo', () => {
    sqlite.prepare(`
      INSERT INTO works (
        id, slug, character_name, species, purpose, publication_status,
        sort_order, featured, version, published_at, created_at, updated_at
      ) VALUES (?, 'photoless', '无照委托', '犬科', 'commission',
        'published', 0, 1, 1, ?, ?, ?)
    `).run('77777777-7777-4777-8777-777777777770', NOW, NOW, NOW)

    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    // 普通作品没有封面可回落，缺少卡片时行为不变。
    expect(repository.listWorks().items).toEqual([])
    expect(repository.listFeaturedWorks().items).toEqual([])
    expect(repository.getWorkBySlug('photoless')).toBeNull()
  })

  it('keeps adopted works in featured while excluding them from current home adoptions', async () => {
    await seedCompleteAdoption({
      id: '44444444-4444-4444-8444-444444444440',
      name: '栗子',
      slug: 'chestnut',
      status: 'available',
    })
    await seedCompleteAdoption({
      id: '55555555-5555-4555-8555-555555555550',
      name: '松果',
      slug: 'pinecone',
      status: 'adopted',
    })
    sqlite.prepare(`UPDATE works SET featured = 1`).run()

    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    const aggregate = repository.getHomeAggregate()
    const serialized = JSON.stringify(aggregate.currentAdoptions)

    expect(aggregate.currentAdoptions.items).toHaveLength(1)
    expect(aggregate.currentAdoptions.items.map(item => item.work.slug))
      .toEqual(['chestnut'])
    expect(aggregate.featured.items.map(item => item.work.slug))
      .toEqual(['chestnut', 'pinecone'])
    expect(repository.listAdoptions().items.map(item => item.work.slug))
      .toEqual(['chestnut', 'pinecone'])
    expect(serialized).not.toContain('adoptionMethod')
    expect(serialized).not.toContain('eventName')
    expect(serialized).not.toContain('eventTime')
  })
})
