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
import { validateHeroSlidesForPublication } from '../../server/utils/hero-publication'

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const SHA_C = 'c'.repeat(64)
const now = Date.UTC(2026, 6, 31)

let directory: string
let sqlite: Database.Database

function insertWork(
  id: string,
  fields: Partial<{
    purpose: string
    ownerDisplay: string
    publicationStatus: string
    adoptionMethod: string | null
    businessStatus: string | null
    currentEventName: string | null
    priceAmountMinor: number | null
    priceCurrency: string | null
  }> = {},
) {
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, suit_type, purpose,
      adoption_method, business_status, current_event_name,
      owner_display, owner_contact, price_amount_minor, price_currency,
      publication_status, created_at, updated_at
    ) VALUES (
      @id, @slug, '团子', '犬科', 'full', @purpose,
      @adoptionMethod, @businessStatus, @currentEventName,
      @ownerDisplay, 'private-contact', @priceAmountMinor, @priceCurrency,
      @publicationStatus, @now, @now
    )
  `).run({
    id,
    slug: `work-${id}`,
    purpose: fields.purpose ?? 'showcase',
    adoptionMethod: fields.adoptionMethod ?? null,
    businessStatus: fields.businessStatus ?? null,
    currentEventName: fields.currentEventName ?? null,
    ownerDisplay: fields.ownerDisplay ?? '有点小狗工作室',
    priceAmountMinor: fields.priceAmountMinor ?? null,
    priceCurrency: fields.priceCurrency ?? null,
    publicationStatus: fields.publicationStatus ?? 'draft',
    now,
  })
}

function insertAsset(
  id: string,
  role: string,
  fields: Partial<{
    status: string
    width: number
    height: number
    sha256: string
  }> = {},
) {
  const portrait = role === 'home_hero_portrait'

  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (
      @id, @role, @status, @key, @sha256, 1024,
      'image/png', @width, @height, @now, @now
    )
  `).run({
    id,
    role,
    status: fields.status ?? 'READY',
    key: `test/original/${id}.png`,
    sha256: fields.sha256 ?? SHA_A,
    width: fields.width ?? (portrait ? 900 : 1600),
    height: fields.height ?? (portrait ? 1600 : 900),
    now,
  })
}

function insertHeroPair(index: number, linkedWorkId: string | null = null) {
  const landscapeId = `landscape-${index}`
  const portraitId = `portrait-${index}`
  insertAsset(landscapeId, 'home_hero_landscape')
  insertAsset(portraitId, 'home_hero_portrait')
  sqlite.prepare(`
    INSERT INTO site_hero_slides (
      id, landscape_asset_id, portrait_asset_id, alt_text,
      sort_order, enabled, linked_work_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
    `slide-${index}`,
    landscapeId,
    portraitId,
    `第 ${index + 1} 张首页作品图`,
    index,
    linkedWorkId,
    now,
    now,
  )
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-domain-'))
  const databaseFile = resolve(directory, 'domain.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('P0 schema boundary', () => {
  it('creates only the P0 tables and keeps banned fields out of works', () => {
    const tables = sqlite.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).pluck().all()
    const workColumns = sqlite.prepare('PRAGMA table_info(works)')
      .all()
      .map(column => (column as { name: string }).name)

    expect(tables).toEqual([
      '__drizzle_migrations',
      'asset_variants',
      'assets',
      'audit_logs',
      'business_statuses',
      'publication_operations',
      'site_content',
      'site_hero_slides',
      'users',
      'work_assets',
      'work_feature_tags',
      'works',
    ])
    expect(workColumns).not.toEqual(expect.arrayContaining([
      'owner_type',
      'deposit_note',
      'payment_note',
      'price_usd',
    ]))
    expect(tables).not.toEqual(expect.arrayContaining([
      'events',
      'password_reset_tokens',
      'return_photos',
      'slug_redirects',
      'trash_entries',
    ]))
  })

  it('enforces ownerDisplay, CNY and foreign keys', () => {
    insertWork('studio')
    insertWork('private', { ownerDisplay: '不公开' })
    insertWork('adoption', {
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      priceAmountMinor: 1_560_000,
      priceCurrency: 'CNY',
    })

    expect(() => insertWork('blank', { ownerDisplay: ' ' }))
      .toThrow(/works_owner_display_nonempty/)
    expect(() => insertWork('trimmed', { ownerDisplay: ' 不公开 ' }))
      .toThrow(/works_owner_display_nonempty/)
    expect(() => insertWork('usd', {
      purpose: 'adoption',
      priceAmountMinor: 100,
      priceCurrency: 'USD',
    })).toThrow(/works_price_cny/)
    expect(() => insertWork('commission-price', {
      purpose: 'commission',
      priceAmountMinor: 100,
      priceCurrency: 'CNY',
    })).toThrow(/works_adoption_fields|works_price_cny/)
    expect(() => sqlite.prepare(`
      INSERT INTO work_feature_tags (work_id, position, value)
      VALUES ('missing-work', 0, '短属性')
    `).run()).toThrow(/FOREIGN KEY/)
  })

  it('limits ordered feature tags to eight nonblank unique values', () => {
    insertWork('tags')
    const insert = sqlite.prepare(`
      INSERT INTO work_feature_tags (work_id, position, value)
      VALUES ('tags', ?, ?)
    `)

    for (let position = 0; position < 8; position += 1) {
      insert.run(position, `属性${position}`)
    }

    expect(() => insert.run(8, '第九条'))
      .toThrow(/work_feature_tags_position/)
    expect(() => insert.run(7, '属性0'))
      .toThrow(/UNIQUE/)
    expect(() => sqlite.prepare(`
      UPDATE work_feature_tags SET value = ' ' WHERE work_id = 'tags'
    `).run()).toThrow(/work_feature_tags_value/)
  })

  it('enforces media roles, limits and immutable originals', () => {
    insertWork('adoption-work', { purpose: 'adoption' })
    insertWork('commission-work', { purpose: 'commission' })
    insertAsset('design', 'design_sheet')
    insertAsset('studio-0', 'studio_photo')

    sqlite.prepare(`
      INSERT INTO work_assets (work_id, asset_id, role, position)
      VALUES ('adoption-work', 'design', 'design_sheet', 0)
    `).run()
    expect(() => sqlite.prepare(`
      UPDATE works SET purpose = 'commission'
      WHERE id = 'adoption-work'
    `).run()).toThrow(/design sheet requires an adoption work/)
    insertAsset('design-second', 'design_sheet')
    expect(() => sqlite.prepare(`
      INSERT INTO work_assets (work_id, asset_id, role, position)
      VALUES ('adoption-work', 'design-second', 'design_sheet', 0)
    `).run()).toThrow(/UNIQUE constraint failed/)
    expect(() => sqlite.prepare(`
      INSERT INTO work_assets (work_id, asset_id, role, position)
      VALUES ('commission-work', 'studio-0', 'design_sheet', 0)
    `).run()).toThrow(/work asset role is invalid/)
    expect(() => insertAsset('return', 'return_photo'))
      .toThrow(/assets_role/)
    expect(() => insertAsset('wrong-landscape', 'home_hero_landscape', {
      width: 900,
      height: 1600,
    })).toThrow(/assets_hero_orientation/)
    expect(() => sqlite.prepare(`
      UPDATE assets SET private_object_key = 'test/original/replaced.png'
      WHERE id = 'design'
    `).run()).toThrow(/original asset identity is immutable/)

    for (let position = 1; position < 5; position += 1) {
      const id = `studio-${position}`
      insertAsset(id, 'studio_photo')
      sqlite.prepare(`
        INSERT INTO work_assets (work_id, asset_id, role, position)
        VALUES ('adoption-work', ?, 'studio_photo', ?)
      `).run(id, position)
    }
    insertAsset('studio-5', 'studio_photo')
    expect(() => sqlite.prepare(`
      INSERT INTO work_assets (work_id, asset_id, role, position)
      VALUES ('adoption-work', 'studio-5', 'studio_photo', 5)
    `).run()).toThrow(/work_assets_position/)
  })

  it('locks complete variant identity and separates private/public output', () => {
    insertAsset('variant-source', 'studio_photo')
    const insert = sqlite.prepare(`
      INSERT INTO asset_variants (
        id, asset_id, storage_scope, status, object_key,
        input_sha256, media_role, usage, width, height, format, quality,
        crop_identity, recipe_version, watermark_profile,
        logo_digest, watermark_anchor, sha256, byte_size,
        created_at, updated_at
      ) VALUES (
        @id, 'variant-source', @scope, 'READY', @key,
        @input, 'studio_photo', 'work-card', 768, 1024, 'webp', 82,
        'crop:full', 'recipe-v1', @profile,
        @logo, @anchor, @output, 2048, @now, @now
      )
    `)
    const publicIdentity = {
      id: 'variant-public',
      scope: 'PUBLIC',
      key: 'prod/web/variant-source/recipe-v1/work-card/output.webp',
      input: SHA_A,
      profile: 'brand-standard-v1',
      logo: SHA_B,
      anchor: 'top-left',
      output: SHA_C,
      now,
    }

    insert.run(publicIdentity)
    expect(() => insert.run({
      ...publicIdentity,
      id: 'variant-duplicate',
      key: 'prod/web/variant-source/recipe-v1/work-card/duplicate.webp',
    })).toThrow(/UNIQUE constraint failed/)
    expect(() => insert.run({
      ...publicIdentity,
      id: 'variant-unwatermarked',
      key: 'prod/web/variant-source/unwatermarked.webp',
      profile: 'none',
      logo: 'none',
      anchor: 'none',
    })).toThrow(/asset_variants_public_watermark/)
    expect(() => sqlite.prepare(`
      UPDATE asset_variants SET object_key = 'prod/web/replaced.webp'
      WHERE id = 'variant-public'
    `).run()).toThrow(/asset variant identity is immutable/)
  })

  it('requires 1–5 READY landscape/portrait pairs for hero publication', () => {
    expect(() => validateHeroSlidesForPublication(sqlite))
      .toThrow(/1 to 5/)

    insertWork('published-link', { publicationStatus: 'published' })
    for (let index = 0; index < 5; index += 1) {
      insertHeroPair(index, index === 0 ? 'published-link' : null)
    }
    expect(validateHeroSlidesForPublication(sqlite)).toBe(5)

    insertAsset('sixth-landscape', 'home_hero_landscape')
    insertAsset('sixth-portrait', 'home_hero_portrait')
    expect(() => sqlite.prepare(`
      INSERT INTO site_hero_slides (
        id, landscape_asset_id, portrait_asset_id, alt_text,
        sort_order, enabled, created_at, updated_at
      ) VALUES (
        'slide-5', 'sixth-landscape', 'sixth-portrait', '第六张', 5, 1, ?, ?
      )
    `).run(now, now)).toThrow(/site_hero_slides_sort/)
    expect(() => sqlite.prepare(`
      UPDATE works SET publication_status = 'unpublished'
      WHERE id = 'published-link'
    `).run()).toThrow(/published work is linked/)
  })

  it('rejects incomplete hero pairs and ACL publication states', () => {
    insertAsset('ready-landscape', 'home_hero_landscape')
    insertAsset('pending-portrait', 'home_hero_portrait', {
      status: 'PENDING',
    })
    expect(() => sqlite.prepare(`
      INSERT INTO site_hero_slides (
        id, landscape_asset_id, portrait_asset_id, alt_text,
        sort_order, enabled, created_at, updated_at
      ) VALUES (
        'invalid-slide', 'ready-landscape', 'pending-portrait',
        '未就绪轮播', 0, 1, ?, ?
      )
    `).run(now, now)).toThrow(/not publication-ready/)
    expect(() => sqlite.prepare(`
      INSERT INTO site_hero_slides (
        id, landscape_asset_id, portrait_asset_id, alt_text,
        sort_order, enabled, created_at, updated_at
      ) VALUES (
        'blank-alt', 'ready-landscape', 'pending-portrait', ' ', 0, 0, ?, ?
      )
    `).run(now, now)).toThrow(/site_hero_slides_alt_nonempty/)

    const insertOperation = sqlite.prepare(`
      INSERT INTO publication_operations (
        id, entity_type, entity_id, requested_version, status,
        started_at, updated_at
      ) VALUES (?, 'HOME', 'site', 1, ?, ?, ?)
    `)
    for (const status of [
      'GENERATING_PUBLIC',
      'APPLYING_WATERMARK',
      'VERIFYING_PUBLIC',
      'COMMITTING',
      'CLEANING_PUBLIC',
      'FAILED',
      'DONE',
    ]) {
      insertOperation.run(`operation-${status}`, status, now, now)
    }
    expect(() => insertOperation.run(
      'operation-acl',
      'SWITCHING_ACL',
      now,
      now,
    )).toThrow(/publication_operations_status/)
  })
})
