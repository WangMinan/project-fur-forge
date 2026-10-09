import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import { migrationsThrough } from '../helpers/migrations'

it('adds empty credit to existing works without changing prices, enforces adoption-only credit and is rerunnable', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-r13-'))
  const file = resolve(directory, 'migration.db')
  try {
    await migrateDatabase(file, { migrationsFolder: migrationsThrough(file, '0056_r11_commission_deletion_lease') })
    const old = openDatabase(file).sqlite
    old.prepare(`INSERT INTO works (id, slug, character_name, species, purpose, adoption_status,
      price_amount_minor, price_currency, created_at, updated_at)
      VALUES ('r13', 'r13', '测试角色', '犬', 'adoption', 'adopted', 880050, 'CNY', 1, 1)`).run()
    old.close()
    await migrateDatabase(file)
    const sqlite = openDatabase(file).sqlite
    try {
      expect(sqlite.prepare('SELECT artist, price_amount_minor, adoption_status FROM works WHERE id = ?').get('r13'))
        .toEqual({ artist: null, price_amount_minor: 880050, adoption_status: 'adopted' })
      for (const artist of ['', ' padded ', 'a'.repeat(101)]) {
        expect(() => sqlite.prepare('UPDATE works SET artist = ?').run(artist)).toThrow()
      }
      sqlite.prepare('UPDATE works SET artist = ?').run('测试画师')
      expect(() => sqlite.prepare("UPDATE works SET purpose = 'showcase', adoption_status = NULL, price_amount_minor = NULL, price_currency = NULL").run()).toThrow()
      expect(sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
      expect(sqlite.pragma('foreign_key_check')).toEqual([])
    }
    finally { sqlite.close() }
    expect(await migrateDatabase(file)).toMatchObject({ applied: 0 })
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
})
