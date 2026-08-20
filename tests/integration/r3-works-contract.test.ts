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
import { afterEach, describe, expect, it } from 'vitest'
import {
  DATABASE_MIGRATIONS_FOLDER,
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'

const directories: string[] = []
const PRE_CONTRACT_TAG = '0038_r3_b_adoption_commission_expand'

function migrationsAfter(tag: string) {
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const index = journal.entries.findIndex(entry => entry.tag === tag)
  return journal.entries.length - index - 1
}

function databaseFile() {
  const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-r3-contract-'))
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
    adoptionStatus?: 'available' | 'adopted' | null
    id: string
    publicationStatus?: 'draft' | 'published' | 'unpublished'
    purpose?: 'adoption' | 'commission' | 'showcase'
  },
) {
  const now = Date.UTC(2026, 7, 16)
  const purpose = input.purpose ?? 'adoption'
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, suit_type, purpose,
      adoption_method, business_status, event_name, event_time,
      owner_display, owner_contact, adoption_status,
      publication_status, sort_order, featured, version, created_at, updated_at
    ) VALUES (?, ?, ?, '犬科', 'full', ?, ?, ?, NULL, NULL,
      '仅迁移前字段', NULL, ?, ?, 7, 1, 3, ?, ?)
  `).run(
    input.id,
    input.id,
    `合成角色 ${input.id}`,
    purpose,
    purpose === 'adoption' ? 'regular' : null,
    purpose === 'adoption' ? 'available' : null,
    purpose === 'adoption' ? (input.adoptionStatus ?? null) : null,
    input.publicationStatus ?? 'draft',
    now,
    now,
  )
}

function insertReadyAsset(
  sqlite: ReturnType<typeof openDatabase>['sqlite'],
  input: {
    id: string
    role: 'adoption_cover' | 'studio_photo'
    workId: string
  },
) {
  const now = Date.UTC(2026, 7, 16)
  const landscape = input.role === 'adoption_cover'
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, ?, 'READY', ?, ?, 1024, 'image/png', ?, ?, ?, ?)
  `).run(
    input.id,
    input.role,
    `test/r3-contract/${input.id}.png`,
    input.id.replaceAll('-', '').padEnd(64, 'a').slice(0, 64),
    landscape ? 1600 : 1200,
    landscape ? 900 : 1200,
    now,
    now,
  )
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
}

function insertReadyHeroAsset(
  sqlite: ReturnType<typeof openDatabase>['sqlite'],
  input: { id: string, role: 'home_hero_landscape' | 'home_hero_portrait' },
) {
  const now = Date.UTC(2026, 7, 16)
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, ?, 'READY', ?, ?, 1024, 'image/png', ?, ?, ?, ?)
  `).run(
    input.id,
    input.role,
    `test/r3-contract/${input.id}.png`,
    input.id.replaceAll('-', '').padEnd(64, 'b').slice(0, 64),
    input.role === 'home_hero_landscape' ? 1920 : 1080,
    input.role === 'home_hero_landscape' ? 1080 : 1920,
    now,
    now,
  )
}

function preContractColumns(sqlite: ReturnType<typeof openDatabase>['sqlite']) {
  return (sqlite.pragma('table_info(works)') as { name: string }[]).map(column => column.name)
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('R3-D works Contract migration', () => {
  it('stops before schema mutation when an adoption status still needs human judgment', async () => {
    const file = databaseFile()
    await migrateDatabase(file, {
      migrationsFolder: migrationsThrough(file, PRE_CONTRACT_TAG),
    })
    const before = openDatabase(file)
    const migrationCount = Number(before.sqlite.prepare(
      'SELECT count(*) FROM __drizzle_migrations',
    ).pluck().get())
    try {
      insertLegacyWork(before.sqlite, {
        adoptionStatus: null,
        id: 'status-review',
      })
    }
    finally {
      before.sqlite.close()
    }

    await expect(migrateDatabase(file)).rejects.toThrow(
      /R3_D_CONTRACT_BLOCKED_ADOPTION_STATUS/u,
    )
    const unchanged = openDatabase(file)
    try {
      expect(preContractColumns(unchanged.sqlite)).toContain('suit_type')
      expect(preContractColumns(unchanged.sqlite)).toContain('owner_contact')
      expect(unchanged.sqlite.prepare(
        'SELECT count(*) FROM __drizzle_migrations',
      ).pluck().get()).toBe(migrationCount)
      expect(unchanged.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(unchanged.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally {
      unchanged.sqlite.close()
    }
  })

  it('stops before schema mutation when a published adoption lacks its independent cover', async () => {
    const file = databaseFile()
    await migrateDatabase(file, {
      migrationsFolder: migrationsThrough(file, PRE_CONTRACT_TAG),
    })
    const before = openDatabase(file)
    try {
      insertLegacyWork(before.sqlite, {
        adoptionStatus: 'available',
        id: 'missing-cover',
        publicationStatus: 'published',
      })
      insertReadyAsset(before.sqlite, {
        id: '11111111-1111-4111-8111-111111111111',
        role: 'studio_photo',
        workId: 'missing-cover',
      })
    }
    finally {
      before.sqlite.close()
    }

    await expect(migrateDatabase(file)).rejects.toThrow(
      /R3_D_CONTRACT_BLOCKED_ADOPTION_COVER/u,
    )
    const unchanged = openDatabase(file)
    try {
      expect(preContractColumns(unchanged.sqlite)).toContain('owner_display')
      expect(unchanged.sqlite.prepare(
        "SELECT count(*) FROM work_assets WHERE role = 'studio_photo'",
      ).pluck().get()).toBe(1)
    }
    finally {
      unchanged.sqlite.close()
    }
  })

  it('stops before schema mutation when any published work lacks a primary studio photo', async () => {
    const file = databaseFile()
    await migrateDatabase(file, {
      migrationsFolder: migrationsThrough(file, PRE_CONTRACT_TAG),
    })
    const before = openDatabase(file)
    try {
      insertLegacyWork(before.sqlite, {
        id: 'missing-primary',
        publicationStatus: 'published',
        purpose: 'showcase',
      })
    }
    finally {
      before.sqlite.close()
    }

    await expect(migrateDatabase(file)).rejects.toThrow(
      /R3_D_CONTRACT_BLOCKED_PRIMARY_STUDIO_PHOTO/u,
    )
    const unchanged = openDatabase(file)
    try {
      expect(preContractColumns(unchanged.sqlite)).toContain('business_status')
      expect(unchanged.sqlite.prepare(
        "SELECT publication_status FROM works WHERE id = 'missing-primary'",
      ).pluck().get()).toBe('published')
    }
    finally {
      unchanged.sqlite.close()
    }
  })

  it('preserves eligible rows and relations, removes every old field, and is re-entrant', async () => {
    const file = databaseFile()
    await migrateDatabase(file, {
      migrationsFolder: migrationsThrough(file, PRE_CONTRACT_TAG),
    })
    const before = openDatabase(file)
    try {
      insertLegacyWork(before.sqlite, {
        adoptionStatus: 'adopted',
        id: 'eligible-adoption',
        publicationStatus: 'published',
      })
      insertReadyAsset(before.sqlite, {
        id: '22222222-2222-4222-8222-222222222222',
        role: 'adoption_cover',
        workId: 'eligible-adoption',
      })
      insertReadyAsset(before.sqlite, {
        id: '33333333-3333-4333-8333-333333333333',
        role: 'studio_photo',
        workId: 'eligible-adoption',
      })
      insertLegacyWork(before.sqlite, {
        id: 'eligible-draft',
        purpose: 'commission',
      })
      insertLegacyWork(before.sqlite, {
        id: 'hero-linked',
        publicationStatus: 'published',
        purpose: 'showcase',
      })
      insertReadyAsset(before.sqlite, {
        id: '44444444-4444-4444-8444-444444444444',
        role: 'studio_photo',
        workId: 'hero-linked',
      })
      insertReadyHeroAsset(before.sqlite, {
        id: '55555555-5555-4555-8555-555555555555',
        role: 'home_hero_landscape',
      })
      insertReadyHeroAsset(before.sqlite, {
        id: '66666666-6666-4666-8666-666666666666',
        role: 'home_hero_portrait',
      })
      const now = Date.UTC(2026, 7, 16)
      before.sqlite.prepare(`
        INSERT INTO site_hero_slides (
          id, landscape_asset_id, portrait_asset_id, alt_text,
          sort_order, enabled, linked_work_id, created_at, updated_at
        ) VALUES (
          '77777777-7777-4777-8777-777777777777',
          '55555555-5555-4555-8555-555555555555',
          '66666666-6666-4666-8666-666666666666',
          '合成 Hero', 0, 1, 'hero-linked', ?, ?
        )
      `).run(now, now)
      before.sqlite.prepare(`
        INSERT INTO work_feature_tags (work_id, value, position)
        VALUES ('eligible-adoption', '迁移后删除', 0)
      `).run()
    }
    finally {
      before.sqlite.close()
    }

    await expect(migrateDatabase(file)).resolves.toMatchObject({
      applied: migrationsAfter(PRE_CONTRACT_TAG),
    })
    await expect(migrateDatabase(file)).resolves.toMatchObject({ applied: 0 })
    const after = openDatabase(file)
    try {
      const columns = preContractColumns(after.sqlite)
      expect(columns).toEqual([
        'id',
        'slug',
        'character_name',
        'species',
        'purpose',
        'adoption_status',
        'price_amount_minor',
        'price_currency',
        'publication_status',
        'sort_order',
        'featured',
        'version',
        'published_at',
        'created_at',
        'updated_at',
      ])
      expect(after.sqlite.prepare(`
        SELECT id, purpose, adoption_status AS adoptionStatus,
               publication_status AS publicationStatus,
               sort_order AS sortOrder, featured, version
        FROM works ORDER BY id
      `).all()).toEqual([
        {
          id: 'eligible-adoption',
          purpose: 'adoption',
          adoptionStatus: 'adopted',
          publicationStatus: 'published',
          sortOrder: 7,
          featured: 1,
          version: 3,
        },
        {
          id: 'eligible-draft',
          purpose: 'commission',
          adoptionStatus: null,
          publicationStatus: 'draft',
          sortOrder: 7,
          featured: 1,
          version: 3,
        },
        {
          id: 'hero-linked',
          purpose: 'showcase',
          adoptionStatus: null,
          publicationStatus: 'published',
          sortOrder: 7,
          featured: 1,
          version: 3,
        },
      ])
      expect(after.sqlite.prepare(`
        SELECT role, alt_text AS alt, is_primary AS isPrimary
        FROM work_assets
        WHERE work_id = 'eligible-adoption'
        ORDER BY role
      `).all()).toEqual([
        { role: 'adoption_cover', alt: '合成领养横版封面', isPrimary: 0 },
        { role: 'studio_photo', alt: '合成主出厂照', isPrimary: 1 },
      ])
      expect(after.sqlite.prepare(`
        SELECT count(*) FROM sqlite_master
        WHERE type = 'table' AND name = 'work_feature_tags'
      `).pluck().get()).toBe(0)
      expect(after.sqlite.prepare(`
        SELECT count(*) FROM sqlite_master
        WHERE type = 'table' AND name = 'site_hero_slides'
      `).pluck().get()).toBe(0)
      after.sqlite.prepare("DELETE FROM work_assets WHERE work_id = 'hero-linked'").run()
      after.sqlite.prepare("DELETE FROM works WHERE id = 'hero-linked'").run()
      expect(after.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(after.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
      expect(() => after.sqlite.prepare(`
        UPDATE works SET purpose = 'showcase' WHERE id = 'eligible-adoption'
      `).run()).toThrow(/adoption media requires an adoption work/u)
      expect(() => after.sqlite.prepare(`
        INSERT INTO work_assets (
          work_id, asset_id, role, alt_text, position, is_primary
        ) VALUES (
          'eligible-draft', '22222222-2222-4222-8222-222222222222',
          'adoption_cover', '错误关系', 0, 0
        )
      `).run()).toThrow()
    }
    finally {
      after.sqlite.close()
    }
  })
})
