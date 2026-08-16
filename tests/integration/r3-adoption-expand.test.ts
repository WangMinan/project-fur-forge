import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  DATABASE_MIGRATIONS_FOLDER,
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import {
  getManagedWork,
  listAmbiguousAdoptionStatusReviews,
  replaceManagedAdoptionCover,
} from '../../server/utils/service/work-management'
import { insertActiveWatermarkProfile } from '../helpers/watermark-fixture'

const directories: string[] = []

function databaseFile() {
  const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-r3-adoption-'))
  directories.push(directory)
  return resolve(directory, 'studio.db')
}

function migrationsThrough(databaseFile: string, lastTag: string) {
  const folder = resolve(dirname(databaseFile), `migrations-through-${lastTag}`)
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const entries = journal.entries.slice(
    0,
    journal.entries.findIndex(entry => entry.tag === lastTag) + 1,
  )
  for (const { tag } of entries) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({
    ...journal,
    entries,
  }))
  return folder
}

function insertLegacyWork(
  sqlite: ReturnType<typeof openDatabase>['sqlite'],
  input: {
    businessStatus: string | null
    id: string
    purpose?: 'adoption' | 'showcase'
  },
) {
  const now = Date.UTC(2026, 7, 16)
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, suit_type, purpose,
      adoption_method, business_status, owner_display, publication_status,
      created_at, updated_at
    ) VALUES (?, ?, ?, '犬科', 'full', ?, ?, ?, '内部旧字段', 'draft', ?, ?)
  `).run(
    input.id,
    input.id,
    input.id,
    input.purpose ?? 'adoption',
    (input.purpose ?? 'adoption') === 'adoption' ? 'regular' : null,
    input.businessStatus,
    now,
    now,
  )
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('R3-B adoption expand', () => {
  it('maps only unambiguous legacy statuses and exposes a PII-free manual review list', async () => {
    const file = databaseFile()
    await migrateDatabase(file, {
      migrationsFolder: migrationsThrough(file, '0037_r3_b_hero_expand'),
    })
    const before = openDatabase(file)
    try {
      insertLegacyWork(before.sqlite, { id: 'available-work', businessStatus: 'available' })
      insertLegacyWork(before.sqlite, { id: 'delivered-work', businessStatus: 'delivered' })
      insertLegacyWork(before.sqlite, { id: 'preparing-work', businessStatus: 'preparing' })
      insertLegacyWork(before.sqlite, { id: 'scheduled-work', businessStatus: 'scheduled' })
      insertLegacyWork(before.sqlite, { id: 'null-work', businessStatus: null })
      insertLegacyWork(before.sqlite, {
        id: 'showcase-work',
        businessStatus: null,
        purpose: 'showcase',
      })
    }
    finally {
      before.sqlite.close()
    }

    await expect(migrateDatabase(file)).resolves.toMatchObject({ applied: 1 })
    await expect(migrateDatabase(file)).resolves.toMatchObject({ applied: 0 })
    const after = openDatabase(file)
    try {
      expect(after.sqlite.prepare(`
        SELECT id, adoption_status AS adoptionStatus
        FROM works ORDER BY id
      `).all()).toEqual([
        { id: 'available-work', adoptionStatus: 'available' },
        { id: 'delivered-work', adoptionStatus: 'adopted' },
        { id: 'null-work', adoptionStatus: null },
        { id: 'preparing-work', adoptionStatus: null },
        { id: 'scheduled-work', adoptionStatus: null },
        { id: 'showcase-work', adoptionStatus: null },
      ])
      const review = listAmbiguousAdoptionStatusReviews(after.sqlite)
      expect(review.map(item => item.id)).toEqual([
        'null-work',
        'preparing-work',
        'scheduled-work',
      ])
      expect(JSON.stringify(review)).not.toContain('内部旧字段')
      expect(JSON.stringify(review)).not.toMatch(/owner|contact|price/iu)
      expect(after.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(after.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally {
      after.sqlite.close()
    }
  })

  it('binds exactly one landscape adoption cover and accepts only adoption-card public variants', async () => {
    const file = databaseFile()
    await migrateDatabase(file)
    const database = openDatabase(file)
    const sqlite = database.sqlite
    const now = Date.UTC(2026, 7, 16)
    const workId = '11111111-1111-4111-8111-111111111111'
    const userId = '22222222-2222-4222-8222-222222222222'
    const assetId = '33333333-3333-4333-8333-333333333333'
    try {
      sqlite.prepare(`
        INSERT INTO users (
          id, username, password_hash, password_changed_at,
          created_at, updated_at
        ) VALUES (?, 'adoption-admin', 'hash', ?, ?, ?)
      `).run(userId, now, now, now)
      insertLegacyWork(sqlite, { id: workId, businessStatus: 'available' })
      sqlite.prepare(`
        INSERT INTO assets (
          id, role, status, private_object_key, sha256, byte_size,
          mime_type, width, height, created_at, updated_at
        ) VALUES (?, 'adoption_cover', 'READY', ?, ?, 1024,
          'image/png', 1920, 1080, ?, ?)
      `).run(assetId, 'test/original/adoption-cover.png', 'a'.repeat(64), now, now)
      sqlite.prepare(`
        INSERT INTO upload_sessions (
          id, owner_type, owner_id, owner_version, media_role,
          private_object_key, expected_content_type, expected_bytes,
          expected_content_md5, expected_sha256, expected_width,
          expected_height, created_by, status, asset_id,
          created_at, expires_at, updated_at
        ) VALUES (?, 'work', ?, 1, 'adoption_cover', ?, 'image/png',
          1024, ?, ?, 1920, 1080, ?, 'COMPLETED', ?, ?, ?, ?)
      `).run(
        '44444444-4444-4444-8444-444444444444',
        workId,
        'test/pending/adoption-cover.png',
        'A'.repeat(22) + '==',
        'a'.repeat(64),
        userId,
        assetId,
        now,
        now + 300_000,
        now,
      )
      const updated = replaceManagedAdoptionCover(sqlite, workId, 1, {
        assetId,
        alt: '横版单头成果图',
        focalX: 0.5,
        focalY: 0.5,
        crop: { x: 0, y: 0, width: 1, height: 1 },
      }, now + 1)
      expect(updated).toMatchObject({
        version: 2,
        adoptionStatus: null,
        adoptionCover: {
          assetId,
          alt: '横版单头成果图',
          width: 1920,
          height: 1080,
          publicVariantCount: 0,
        },
      })
      expect(getManagedWork(sqlite, workId).adoptionCover).not.toBeNull()
      expect(() => sqlite.prepare(`
        INSERT INTO assets (
          id, role, status, private_object_key, sha256, byte_size,
          mime_type, width, height, created_at, updated_at
        ) VALUES (?, 'adoption_cover', 'READY', ?, ?, 1024,
          'image/png', 1080, 1920, ?, ?)
      `).run(
        '55555555-5555-4555-8555-555555555555',
        'test/original/portrait-cover.png',
        'b'.repeat(64),
        now,
        now,
      )).toThrow()

      insertActiveWatermarkProfile(sqlite, now)
      const profile = sqlite.prepare(`
        SELECT
          profile.id, profile.profile_name AS name,
          profile.config_digest AS configDigest,
          profile.logo_digest AS logoDigest,
          profile.opacity_percent AS opacity,
          profile.scale_percent AS scale
        FROM site_branding AS branding
        JOIN watermark_profiles AS profile
          ON profile.id = branding.active_watermark_profile_id
        WHERE branding.id = 'site'
      `).get() as {
        configDigest: string
        id: string
        logoDigest: string
        name: string
        opacity: number
        scale: number
      }
      expect(() => sqlite.prepare(`
        INSERT INTO asset_variants (
          id, asset_id, storage_scope, status, object_key, input_sha256,
          media_role, usage, width, height, format, quality, crop_identity,
          recipe_version, protection_mode, watermark_profile,
          watermark_profile_id, watermark_config_digest, logo_digest,
          watermark_anchor, watermark_opacity_percent,
          watermark_scale_percent, sha256, byte_size, created_at, updated_at
        ) VALUES (?, ?, 'PUBLIC', 'READY', ?, ?, 'adoption_cover',
          'adoption-card', 768, 432, 'webp', 82, 'cover-v1', 'recipe-v3',
          'watermark', ?, ?, ?, ?, 'center', ?, ?, ?, 512, ?, ?)
      `).run(
        '66666666-6666-4666-8666-666666666666',
        assetId,
        'test/web/adoption-card.webp',
        'a'.repeat(64),
        profile.name,
        profile.id,
        profile.configDigest,
        profile.logoDigest,
        profile.opacity,
        profile.scale,
        'c'.repeat(64),
        now,
        now,
      )).not.toThrow()
      expect(sqlite.pragma('foreign_key_check')).toEqual([])
      expect(sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally {
      sqlite.close()
    }
  })
})
