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
import { listCommissionSubmissions } from '../../server/utils/service/commission-management'

const directories: string[] = []
const PRE_FOLLOW_UP_TAG = '0041_r3_d_hero_work_fk'

function databaseFile() {
  const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-r3-commission-follow-up-'))
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
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({ ...journal, entries }))
  return folder
}

function seedSubmission(
  file: string,
  id: string,
  phone: string,
  createdAt: number,
) {
  const database = openDatabase(file)
  try {
    database.sqlite.prepare(`
      INSERT INTO assets (
        id, role, status, private_object_key, sha256, byte_size,
        mime_type, width, height, fit_mode, created_at, updated_at
      ) VALUES (?, 'commission_design_reference', 'READY', ?, ?, 128,
        'image/png', 640, 480, 'contain', ?, ?)
    `).run(id, `test/commission/${id}.png`, 'a'.repeat(64), createdAt, createdAt)
    database.sqlite.prepare(`
      INSERT INTO commission_submissions (
        id, receipt_code, nickname, phone_country_code, phone_number, qq,
        height_cm, weight_kg_tenths, design_asset_id, status,
        created_at, updated_at
      ) VALUES (?, ?, '迁移前合成申请', '+86', ?, '100001',
        170, 600, ?, 'pending', ?, ?)
    `).run(id, `DD-${id.slice(0, 8).toUpperCase()}`, phone, id, createdAt, createdAt)
  }
  finally {
    database.sqlite.close()
  }
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('R3-E commission user follow-up migration', () => {
  it('adds nullable legacy species, initializes confirmed contacts, and is re-entrant', async () => {
    const file = databaseFile()
    await migrateDatabase(file, {
      migrationsFolder: migrationsThrough(file, PRE_FOLLOW_UP_TAG),
    })
    seedSubmission(file, '11111111-1111-4111-8111-111111111111', '19900000000', 1)

    const rollingRead = openDatabase(file)
    try {
      expect(listCommissionSubmissions(rollingRead.sqlite)).toEqual([
        expect.objectContaining({
          nickname: '迁移前合成申请',
          species: null,
        }),
      ])
    }
    finally {
      rollingRead.sqlite.close()
    }

    await expect(migrateDatabase(file)).resolves.toMatchObject({ applied: 1 })
    await expect(migrateDatabase(file)).resolves.toMatchObject({ applied: 0 })

    const database = openDatabase(file)
    try {
      expect(database.sqlite.prepare(`
        SELECT species FROM commission_submissions
      `).get()).toEqual({ species: null })
      expect(database.sqlite.prepare(`
        SELECT contact_email AS email, contact_qq AS qq,
          json_extract(official_channels_json, '$[0].account') AS channelQq,
          json_extract(official_channels_json, '$[1].account') AS qqGroup
        FROM site_content WHERE id = 'site'
      `).get()).toEqual({
        email: '765678159@qq.com',
        qq: '765678159',
        channelQq: '765678159',
        qqGroup: '1040925427',
      })
      expect(database.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(database.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally {
      database.sqlite.close()
    }
  })

  it('stops before creating the unique index when legacy pending phones conflict', async () => {
    const file = databaseFile()
    await migrateDatabase(file, {
      migrationsFolder: migrationsThrough(file, PRE_FOLLOW_UP_TAG),
    })
    seedSubmission(file, '11111111-1111-4111-8111-111111111111', '19900000000', 1)
    seedSubmission(file, '22222222-2222-4222-8222-222222222222', '19900000000', 2)

    await expect(migrateDatabase(file)).rejects.toThrow()
    const database = openDatabase(file)
    try {
      expect(database.sqlite.prepare(`
        SELECT count(*) FROM commission_submissions WHERE status = 'pending'
      `).pluck().get()).toBe(2)
      expect(database.sqlite.pragma('index_list(commission_submissions)'))
        .not.toEqual(expect.arrayContaining([
          expect.objectContaining({ name: 'commission_submissions_pending_phone_unique' }),
        ]))
    }
    finally {
      database.sqlite.close()
    }
  })
})
