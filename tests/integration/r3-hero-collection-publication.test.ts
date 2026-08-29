import { createHash, randomUUID } from 'node:crypto'
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
} from 'vitest'
import { createSyntheticTransparentPng } from '../../scripts/oss-preflight-core.mjs'
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import { getPublicHome } from '../../server/utils/runner/home-management'
import {
  createHeroCollectionItemPreview,
  runHeroCollectionItemPublication,
  runHeroCollectionItemUnpublication,
  startHeroCollectionItemPublication,
  startHeroCollectionItemUnpublication,
} from '../../server/utils/runner/hero-collection-publication'
import {
  createHeroCollectionItem,
  getAdminHeroCollection,
  reorderEnabledHeroCollectionItems,
  updateHeroCollectionItem,
} from '../../server/utils/service/hero-collection-management'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NOW = Date.UTC(2026, 7, 16)
const MEDIA_BASE_URL = 'https://media.example.test'

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage
let sequence = 1

function digest(content: Buffer) {
  return createHash('sha256').update(content).digest('hex')
}

function seedHeroAsset(input: {
  orientation: 'landscape' | 'portrait'
  ownerVersion: number
  placement: 'commission' | 'home'
}) {
  const id = randomUUID()
  const content = createSyntheticTransparentPng()
  const landscape = input.orientation === 'landscape'
  const width = landscape ? 3840 : 1080
  const height = landscape ? 2160 : 1920
  const role = landscape ? 'home_hero_landscape' : 'home_hero_portrait'
  const key = `test/original/${id}.png`
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, ?, 'READY', ?, ?, ?, 'image/png', ?, ?, ?, ?)
  `).run(id, role, key, digest(content), content.length, width, height, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO upload_sessions (
      id, owner_type, owner_id, owner_version, media_role,
      private_object_key, expected_content_type, expected_bytes,
      expected_content_md5, expected_sha256, expected_width,
      expected_height, created_by, status, asset_id, version,
      created_at, expires_at, updated_at
    ) VALUES (?, 'site', ?, ?, ?, ?, 'image/png', ?, ?, ?, ?, ?, ?,
              'COMPLETED', ?, 3, ?, ?, ?)
  `).run(
    randomUUID(),
    `hero-${input.placement}-${input.orientation}`,
    input.ownerVersion,
    role,
    key,
    content.length,
    createHash('md5').update(content).digest('base64'),
    digest(content),
    width,
    height,
    USER_ID,
    id,
    NOW,
    NOW + 300_000,
    NOW,
  )
  storage.seedPrivate(key, content, 'image/png', digest(content), {
    fileSize: content.length,
    format: 'png',
    height,
    orientation: 1,
    width,
  })
  return id
}

function heroItemInput(
  assetId: string,
  alt: string,
  sortOrder: number,
  focal = { x: 0.5, y: 0.5 },
) {
  return {
    alt,
    assetId,
    assetVersion: 1,
    focalX: focal.x,
    focalY: focal.y,
    sortOrder,
  }
}

async function createAndPublish(input: {
  alt: string
  orientation: 'landscape' | 'portrait'
  placement?: 'commission' | 'home'
  sortOrder: number
}) {
  const placement = input.placement ?? 'home'
  const before = getAdminHeroCollection(sqlite, placement, input.orientation)
  const assetId = seedHeroAsset({
    orientation: input.orientation,
    ownerVersion: before.version,
    placement,
  })
  const created = createHeroCollectionItem(
    sqlite,
    placement,
    input.orientation,
    before.version,
    heroItemInput(assetId, input.alt, input.sortOrder),
    NOW + sequence++,
  )
  const item = created.items.find(candidate => candidate.asset.assetId === assetId)!
  const operation = startHeroCollectionItemPublication(
    sqlite,
    item.id,
    placement,
    input.orientation,
    created.version,
    NOW + sequence++,
  )
  const result = await runHeroCollectionItemPublication(
    sqlite,
    storage,
    operation.operationId,
    USER_ID,
    NOW + sequence++,
  )
  expect(result.status).toBe('DONE')
  return item.id
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-r3-hero-publication-'))
  const databaseFile = resolve(directory, 'studio.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
  sequence = 1
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { recursive: true, force: true })
})

describe('R3-C independent Hero collection publication', () => {
  it('creates a private single-item preview for a disabled collection item', async () => {
    const before = getAdminHeroCollection(sqlite, 'home', 'landscape')
    const assetId = seedHeroAsset({
      orientation: 'landscape',
      ownerVersion: before.version,
      placement: 'home',
    })
    const created = createHeroCollectionItem(
      sqlite,
      'home',
      'landscape',
      before.version,
      heroItemInput(assetId, '待预览横版', 0),
      NOW + sequence++,
    )
    const item = created.items.find(candidate => candidate.asset.assetId === assetId)!

    const preview = await createHeroCollectionItemPreview(
      sqlite,
      storage,
      item.id,
      'home',
      'landscape',
      created.version,
      NOW + sequence++,
    )

    expect(preview).toMatchObject({ width: 768 })
    expect(preview.url).toContain(`/items/${item.id}/preview`)
    expect(storage.publicObjects.size).toBe(0)
  })

  it('publishes, reorders and unpublishes one orientation without changing another', async () => {
    const firstLandscape = await createAndPublish({
      alt: '首页横版 A',
      orientation: 'landscape',
      sortOrder: 0,
    })
    const secondLandscape = await createAndPublish({
      alt: '首页横版 B',
      orientation: 'landscape',
      sortOrder: 1,
    })
    await createAndPublish({
      alt: '首页竖版独立',
      orientation: 'portrait',
      sortOrder: 0,
    })

    const landscape = getAdminHeroCollection(sqlite, 'home', 'landscape')
    reorderEnabledHeroCollectionItems(
      sqlite,
      'home',
      'landscape',
      landscape.version,
      [secondLandscape, firstLandscape],
      NOW + sequence++,
    )
    const projected = getPublicHome(sqlite, MEDIA_BASE_URL)
    expect(projected.landscape.map(item => item.alt)).toEqual([
      '首页横版 B',
      '首页横版 A',
    ])
    expect(projected.portrait.map(item => item.alt)).toEqual([
      '首页竖版独立',
    ])
    expect(projected.landscape[0]?.sources.webp.map(item => item.width)).toEqual([
      768,
      1280,
      1920,
      2880,
      3840,
    ])
    expect(JSON.stringify(projected)).not.toContain('linkedWork')

    const reordered = getAdminHeroCollection(sqlite, 'home', 'landscape')
    const unpublish = startHeroCollectionItemUnpublication(
      sqlite,
      secondLandscape,
      'home',
      'landscape',
      reordered.version,
      NOW + sequence++,
    )
    const completed = await runHeroCollectionItemUnpublication(
      sqlite,
      storage,
      unpublish.operationId,
      USER_ID,
      NOW + sequence++,
    )
    expect(completed.status).toBe('DONE')
    expect(getPublicHome(sqlite, MEDIA_BASE_URL).landscape.map(item => item.alt))
      .toEqual(['首页横版 A'])
    expect(getPublicHome(sqlite, MEDIA_BASE_URL).portrait).toHaveLength(1)
    expect(storage.deletedPublicKeys.length).toBeGreaterThan(0)
  })

  it('keeps collection CAS independent and refuses to remove the last enabled item', async () => {
    const landscapeId = await createAndPublish({
      alt: '横版唯一项',
      orientation: 'landscape',
      sortOrder: 0,
    })
    const portraitId = await createAndPublish({
      alt: '竖版唯一项',
      orientation: 'portrait',
      sortOrder: 0,
    })
    const landscape = getAdminHeroCollection(sqlite, 'home', 'landscape')
    let lastItemError: unknown
    try {
      startHeroCollectionItemUnpublication(
        sqlite,
        landscapeId,
        'home',
        'landscape',
        landscape.version,
      )
    }
    catch (error) {
      lastItemError = error
    }
    expect(lastItemError).toMatchObject({ reason: 'HERO_LAST_ENABLED_ITEM' })

    const portrait = getAdminHeroCollection(sqlite, 'home', 'portrait')
    expect(portrait.items[0]?.id).toBe(portraitId)
    let staleError: unknown
    try {
      reorderEnabledHeroCollectionItems(
        sqlite,
        'home',
        'landscape',
        1,
        [landscapeId],
      )
    }
    catch (error) {
      staleError = error
    }
    expect(staleError).toMatchObject({ reason: 'VERSION_CONFLICT' })
    expect(getAdminHeroCollection(sqlite, 'home', 'portrait').version)
      .toBe(portrait.version)
  })

  it('keeps commission collections to a single enabled item and allows replacing it', async () => {
    const first = await createAndPublish({
      alt: '委托横版 A',
      orientation: 'landscape',
      placement: 'commission',
      sortOrder: 0,
    })
    const entryKeys = sqlite.prepare(`
      SELECT variant.object_key
      FROM asset_variants AS variant
      JOIN site_hero_items AS item ON item.asset_id = variant.asset_id
      WHERE item.id = ? AND variant.usage = 'home-entry-commission'
    `).pluck().all(first) as string[]
    expect(entryKeys.length).toBeGreaterThan(0)

    // 委托集合同时只允许一张启用：第二张必须先停用旧图。
    const before = getAdminHeroCollection(sqlite, 'commission', 'landscape')
    const assetId = seedHeroAsset({
      orientation: 'landscape',
      ownerVersion: before.version,
      placement: 'commission',
    })
    const created = createHeroCollectionItem(
      sqlite,
      'commission',
      'landscape',
      before.version,
      heroItemInput(assetId, '委托横版 B', 0),
      NOW + sequence++,
    )
    const second = created.items.find(candidate => candidate.asset.assetId === assetId)!
    let slotError: unknown
    try {
      startHeroCollectionItemPublication(
        sqlite,
        second.id,
        'commission',
        'landscape',
        created.version,
        NOW + sequence++,
      )
    }
    catch (error) {
      slotError = error
    }
    expect(slotError).toMatchObject({ reason: 'HERO_SLOT_LIMIT' })

    // 与首页不同：委托集合允许停用最后一张启用图，下架即清空公开入口图。
    const collection = getAdminHeroCollection(sqlite, 'commission', 'landscape')
    const operation = startHeroCollectionItemUnpublication(
      sqlite,
      first,
      'commission',
      'landscape',
      collection.version,
      NOW + sequence++,
    )
    const completed = await runHeroCollectionItemUnpublication(
      sqlite,
      storage,
      operation.operationId,
      USER_ID,
      NOW + sequence++,
    )
    expect(completed.status).toBe('DONE')
    expect(storage.deletedPublicKeys).toEqual(expect.arrayContaining(entryKeys))
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants WHERE object_key IN (
        SELECT value FROM json_each(?)
      )
    `).pluck().get(JSON.stringify(entryKeys))).toBe(0)
    expect(getAdminHeroCollection(sqlite, 'commission', 'landscape').items
      .filter(item => item.enabled)).toHaveLength(0)

    // 停用旧图后新图可直接发布启用，完成替换。
    const draft = getAdminHeroCollection(sqlite, 'commission', 'landscape')
    const republish = startHeroCollectionItemPublication(
      sqlite,
      second.id,
      'commission',
      'landscape',
      draft.version,
      NOW + sequence++,
    )
    const replaced = await runHeroCollectionItemPublication(
      sqlite,
      storage,
      republish.operationId,
      USER_ID,
      NOW + sequence++,
    )
    expect(replaced.status).toBe('DONE')
    expect(getAdminHeroCollection(sqlite, 'commission', 'landscape').items
      .filter(item => item.enabled).map(item => item.alt)).toEqual(['委托横版 B'])
  })

  it('updates disabled focal coordinates through CAS and publishes new immutable variants', async () => {
    const before = getAdminHeroCollection(sqlite, 'commission', 'landscape')
    const assetId = seedHeroAsset({
      orientation: 'landscape',
      ownerVersion: before.version,
      placement: 'commission',
    })
    const created = createHeroCollectionItem(
      sqlite,
      'commission',
      'landscape',
      before.version,
      heroItemInput(assetId, '焦点重建', 0),
      NOW + sequence++,
    )
    const item = created.items.find(candidate => candidate.asset.assetId === assetId)!
    const firstOperation = startHeroCollectionItemPublication(
      sqlite,
      item.id,
      'commission',
      'landscape',
      created.version,
      NOW + sequence++,
    )
    expect((await runHeroCollectionItemPublication(
      sqlite,
      storage,
      firstOperation.operationId,
      USER_ID,
      NOW + sequence++,
    )).status).toBe('DONE')
    const firstKeys = [...storage.publicObjects.keys()]

    const published = getAdminHeroCollection(sqlite, 'commission', 'landscape')
    const unpublish = startHeroCollectionItemUnpublication(
      sqlite,
      item.id,
      'commission',
      'landscape',
      published.version,
      NOW + sequence++,
    )
    expect((await runHeroCollectionItemUnpublication(
      sqlite,
      storage,
      unpublish.operationId,
      USER_ID,
      NOW + sequence++,
    )).status).toBe('DONE')

    const disabled = getAdminHeroCollection(sqlite, 'commission', 'landscape')
    const disabledItem = disabled.items.find(candidate => candidate.id === item.id)!
    const updated = updateHeroCollectionItem(
      sqlite,
      item.id,
      'commission',
      'landscape',
      disabled.version,
      {
        alt: disabledItem.alt,
        assetId,
        assetVersion: disabledItem.asset.version,
        focalX: 0.37,
        focalY: 0.64,
        sortOrder: disabledItem.sortOrder,
      },
      NOW + sequence++,
    )
    const focused = updated.items.find(candidate => candidate.id === item.id)!
    expect(focused.asset).toMatchObject({ focalX: 0.37, focalY: 0.64, version: 2 })

    const secondOperation = startHeroCollectionItemPublication(
      sqlite,
      item.id,
      'commission',
      'landscape',
      updated.version,
      NOW + sequence++,
    )
    expect((await runHeroCollectionItemPublication(
      sqlite,
      storage,
      secondOperation.operationId,
      USER_ID,
      NOW + sequence++,
    )).status).toBe('DONE')
    const secondKeys = [...storage.publicObjects.keys()]
    expect(secondKeys).not.toEqual([])
    expect(secondKeys.some(key => firstKeys.includes(key))).toBe(false)
  })

  it('blocks focal changes when a legacy asset is shared by another Hero item', () => {
    const before = getAdminHeroCollection(sqlite, 'commission', 'landscape')
    const assetId = seedHeroAsset({
      orientation: 'landscape',
      ownerVersion: before.version,
      placement: 'commission',
    })
    const created = createHeroCollectionItem(
      sqlite,
      'commission',
      'landscape',
      before.version,
      heroItemInput(assetId, '共享焦点', 0),
      NOW + sequence++,
    )
    const item = created.items.find(candidate => candidate.asset.assetId === assetId)!
    sqlite.prepare(`
      INSERT INTO site_hero_items (
        id, placement, orientation, asset_id, alt_text, sort_order,
        enabled, version, created_at, updated_at
      ) VALUES (?, 'home', 'landscape', ?, '历史共享项', 4, 0, 1, ?, ?)
    `).run(randomUUID(), assetId, NOW, NOW)

    expect(() => updateHeroCollectionItem(
      sqlite,
      item.id,
      'commission',
      'landscape',
      created.version,
      {
        alt: item.alt,
        assetId,
        assetVersion: item.asset.version,
        focalX: 0,
        focalY: 1,
        sortOrder: item.sortOrder,
      },
      NOW + sequence++,
    )).toThrow(expect.objectContaining({
      reason: 'HERO_FOCAL_SHARED_ASSET_CONFLICT',
    }))
  })
})
