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
  updatedAt?: number
}) {
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, purpose, adoption_status,
      price_amount_minor, price_currency, publication_status,
      sort_order, version, published_at, created_at, updated_at
    ) VALUES (?, ?, ?, '犬科', 'adoption', ?, 128000, 'CNY',
      'published', 0, 1, ?, ?, ?)
  `).run(input.id, input.slug, input.name, input.status, NOW, NOW, input.updatedAt ?? NOW)
}

async function attachPublicAsset(input: {
  id: string
  role: 'adoption_cover' | 'design_sheet' | 'studio_photo'
  workId: string
}) {
  const width = input.role === 'studio_photo'
    ? 2400
    : input.role === 'adoption_cover' ? 1920 : 2400
  const height = input.role === 'studio_photo'
    ? 3200
    : input.role === 'adoption_cover' ? 1080 : 1600
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
    input.role === 'adoption_cover'
      ? '合成领养横版封面'
      : input.role === 'design_sheet' ? '合成完整设定图' : '合成主出厂照',
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
  it('projects only available adoptions while keeping works order unchanged', async () => {
    const rows = [
      { id: '10000000-0000-4000-8000-000000000010', slug: 'available-a', status: 'available', updatedAt: NOW + 300 },
      { id: '10000000-0000-4000-8000-000000000020', slug: 'available-b', status: 'available', updatedAt: NOW + 300 },
      { id: '20000000-0000-4000-8000-000000000030', slug: 'available-c', status: 'available', updatedAt: NOW + 250 },
      { id: '30000000-0000-4000-8000-000000000040', slug: 'available-d', status: 'available', updatedAt: NOW + 200 },
      { id: '40000000-0000-4000-8000-000000000050', slug: 'available-e', status: 'available', updatedAt: NOW + 150 },
      { id: '50000000-0000-4000-8000-000000000060', slug: 'available-f', status: 'available', updatedAt: NOW + 100 },
      { id: '60000000-0000-4000-8000-000000000070', slug: 'available-g', status: 'available', updatedAt: NOW + 50 },
      { id: '00000000-0000-4000-8000-000000000001', slug: 'adopted-new', status: 'adopted', updatedAt: NOW + 1_000 },
      { id: '90000000-0000-4000-8000-000000000090', slug: 'adopted-old', status: 'adopted', updatedAt: NOW + 500 },
    ] as const
    for (const [index, row] of rows.entries()) {
      insertAdoption({
        ...row,
        name: `排序角色 ${index + 1}`,
      })
      await attachPublicAsset({
        id: `${row.id.slice(0, -1)}${index + 1}`,
        role: 'adoption_cover',
        workId: row.id,
      })
    }

    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    const firstPage = repository.listAdoptions({ q: ' 排序角色 ', page: 1 })
    const secondPage = repository.listAdoptions({ q: '排序角色', page: 2 })

    expect(firstPage.items.map(item => item.work.slug)).toEqual([
      'available-a',
      'available-b',
      'available-c',
      'available-d',
      'available-e',
      'available-f',
      'available-g',
    ])
    expect(secondPage.items).toEqual([])
    expect(firstPage.pageCount).toBe(1)
    expect(firstPage.resultCount).toBe(7)
    expect(firstPage.availableCount).toBe(7)
    expect(secondPage.availableCount).toBe(7)
    expect(repository.listAdoptions({ q: '排序角色 9' }).items.map(item => item.work.slug))
      .toEqual([])
    // /works 仍使用原公开时间 + ID 稳定顺序；最新 adopted 不套用领养 bucket。
    expect(repository.listWorks().items[0]?.work.slug).toBe('adopted-new')
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
    const catalogWork = repository.listWorks().items[0]!
    const detail = repository.getWorkBySlug('star-candy')

    expect(adoption.cover.assetId).toBe('33333333-3333-4333-8333-333333333331')
    expect(catalogWork.cardOrientation).toBe('portrait')
    expect(catalogWork.card.assetId).toBe('33333333-3333-4333-8333-333333333332')
    expect(detail?.media.primaryAssetId)
      .toBe('33333333-3333-4333-8333-333333333332')
    expect(detail?.media.designSheet).toBeUndefined()
    // /works 与详情都有出厂照时优先出厂照；领养封面仍进入详情。
    expect(detail?.media.cardOrientation).toBe('portrait')
    expect(detail?.media.card.assetId).toBe('33333333-3333-4333-8333-333333333332')
    expect(detail?.media.adoptionCover?.assetId)
      .toBe('33333333-3333-4333-8333-333333333331')
    expect(detail?.adoption).toEqual({
      adoptionStatus: 'available',
      price: {
        currency: 'CNY',
        minorUnits: 128_000,
      },
    })
    expect(JSON.stringify({ adoption, detail })).not.toContain('/original/')
  })

  it('keeps a head-only adoption in works and detail but excludes it from featured', async () => {
    const id = '66666666-6666-4666-8666-666666666660'
    const coverId = '66666666-6666-4666-8666-666666666661'
    insertAdoption({ id, name: '小绿狗', slug: 'green-doggy', status: 'available' })
    await attachPublicAsset({ id: coverId, role: 'adoption_cover', workId: id })
    sqlite.prepare(`UPDATE works SET featured = 1`).run()

    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    const detail = repository.getWorkBySlug('green-doggy')

    // 只有横版封面：作品展示与详情仍可看到，但不能进入首页代表作品。
    expect(repository.listWorks().items.map(item => item.work.slug))
      .toEqual(['green-doggy'])
    expect(repository.listFeaturedWorks().items.map(item => item.work.slug))
      .toEqual([])
    expect(repository.listAdoptions().items.map(item => item.cover.assetId))
      .toEqual([coverId])

    // 卡片回落到横版封面；详情没有出厂照但有封面。
    expect(detail?.media.cardOrientation).toBe('landscape')
    expect(detail?.media.card.assetId).toBe(coverId)
    expect(detail?.media.adoptionCover?.assetId).toBe(coverId)
    expect(detail?.media.gallery).toEqual([])
    expect(detail?.media.primaryAssetId).toBeNull()
    expect(detail?.adoption?.adoptionStatus).toBe('available')
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

  it('shows a sheet-only adoption in adoptions, works and detail without a cover', async () => {
    const id = '88888888-8888-4888-8888-888888888880'
    const sheetId = '88888888-8888-4888-8888-888888888881'
    insertAdoption({ id, name: '图纸小狗', slug: 'sheet-doggy', status: 'available' })
    await attachPublicAsset({ id: sheetId, role: 'design_sheet', workId: id })

    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    const detail = repository.getWorkBySlug('sheet-doggy')

    // 没有横版封面：/adoptions、作品展示与详情都回落到完整设定图。
    expect(repository.listAdoptions().items.map(item => item.cover.assetId))
      .toEqual([sheetId])
    expect(repository.listWorks().items.map(item => item.work.slug))
      .toEqual(['sheet-doggy'])
    expect(detail?.media.cardOrientation).toBe('landscape')
    expect(detail?.media.card.assetId).toBe(sheetId)
    // 封面回落为设定图时详情不重复展示同一张图。
    expect(detail?.media.adoptionCover).toBeUndefined()
    expect(detail?.media.designSheet?.assetId).toBe(sheetId)
    expect(detail?.media.gallery).toEqual([])
    expect(JSON.stringify(detail)).not.toContain('/original/')
  })

  it('projects at most the latest three available adoptions while keeping adopted works in featured', async () => {
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
    const repository = createSqlitePublicSiteRepository(sqlite, MEDIA_BASE_URL)
    expect(repository.getHomeAggregate().currentAdoptions.items.map(item => item.work.slug))
      .toEqual(['chestnut'])

    await seedCompleteAdoption({
      id: '66666666-6666-4666-8666-666666666660',
      name: '薄荷',
      slug: 'mint',
      status: 'available',
    })
    expect(repository.getHomeAggregate().currentAdoptions.items.map(item => item.work.slug))
      .toEqual(['chestnut', 'mint'])

    await seedCompleteAdoption({
      id: '77777777-7777-4777-8777-777777777770',
      name: '云朵',
      slug: 'cloud',
      status: 'available',
    })
    await seedCompleteAdoption({
      id: '88888888-8888-4888-8888-888888888880',
      name: '星河',
      slug: 'galaxy',
      status: 'available',
    })
    sqlite.prepare(`
      UPDATE works
      SET updated_at = CASE slug
        WHEN 'chestnut' THEN ?
        WHEN 'mint' THEN ?
        WHEN 'cloud' THEN ?
        WHEN 'galaxy' THEN ?
        WHEN 'pinecone' THEN ?
        ELSE updated_at
      END
    `).run(NOW + 100, NOW + 400, NOW + 300, NOW + 200, NOW + 1_000)
    sqlite.prepare(`UPDATE works SET featured = 1`).run()

    const aggregate = repository.getHomeAggregate()
    const serialized = JSON.stringify(aggregate.currentAdoptions)

    expect(aggregate.currentAdoptions.items).toHaveLength(3)
    expect(aggregate.currentAdoptions.items.map(item => item.work.slug))
      .toEqual(['mint', 'cloud', 'galaxy'])
    expect(aggregate.currentAdoptions.status).not.toBeUndefined()
    expect(aggregate.featured.items.map(item => item.work.slug))
      .toContain('pinecone')
    expect(repository.listAdoptions().items.map(item => item.work.slug))
      .toEqual(['mint', 'cloud', 'galaxy', 'chestnut'])
    expect(serialized).not.toContain('adoptionMethod')
    expect(serialized).not.toContain('eventName')
    expect(serialized).not.toContain('eventTime')
  })
})
