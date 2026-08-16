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
const PRE_CONTRACT_TAG = '0039_r3_d_works_contract'

function migrationsAfter(tag: string) {
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const index = journal.entries.findIndex(entry => entry.tag === tag)
  return journal.entries.length - index - 1
}

function databaseFile() {
  const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-r3-commission-contract-'))
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

function siteContentColumns(file: string) {
  const database = openDatabase(file)
  try {
    return (database.sqlite.pragma('table_info(site_content)') as { name: string }[])
      .map(column => column.name)
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

describe('R3-E commission Contract migration', () => {
  it('drops the FAQ contract while preserving QQ and the backup email action exactly', async () => {
    const file = databaseFile()
    await migrateDatabase(file, {
      migrationsFolder: migrationsThrough(file, PRE_CONTRACT_TAG),
    })
    const before = openDatabase(file)
    const expected = {
      contactQq: '123456789',
      emailAction: '保留的备用邮件说明。',
    }
    try {
      before.sqlite.prepare(`
        UPDATE site_content
        SET contact_qq = ?, commission_email_action = ?,
            commission_faq_json = ?, commission_faq_version = 7
        WHERE id = 'site'
      `).run(
        expected.contactQq,
        expected.emailAction,
        JSON.stringify([{
          id: '11111111-1111-4111-8111-111111111111',
          question: '迁移后删除的问题',
          answer: '迁移后删除的回答',
        }]),
      )
      expect(siteContentColumns(file)).toContain('commission_faq_json')
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
      const columns = (after.sqlite.pragma('table_info(site_content)') as { name: string }[])
        .map(column => column.name)
      expect(columns).not.toContain('commission_faq_json')
      expect(columns).not.toContain('commission_faq_version')
      expect(after.sqlite.prepare(`
        SELECT contact_qq AS contactQq,
               commission_email_action AS emailAction
        FROM site_content WHERE id = 'site'
      `).get()).toEqual(expected)
      expect(after.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(after.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally {
      after.sqlite.close()
    }
  })

  it('creates a fresh database without any FAQ column', async () => {
    const file = databaseFile()
    const journal = JSON.parse(readFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
      'utf8',
    )) as { entries: unknown[] }
    await expect(migrateDatabase(file)).resolves.toMatchObject({
      applied: journal.entries.length,
    })
    expect(siteContentColumns(file)).not.toContain('commission_faq_json')
    expect(siteContentColumns(file)).not.toContain('commission_faq_version')
  })
})
