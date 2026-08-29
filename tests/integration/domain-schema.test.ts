import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase } from '../../server/utils/database'

const NOW = Date.UTC(2026, 7, 29)
const SHA = 'a'.repeat(64)

let directory: string
let sqlite: Database.Database

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-schema-'))
  const databaseFile = resolve(directory, 'schema.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('current media schema boundary', () => {
  it('contains no retired watermark tables, columns, triggers, or indexes', () => {
    const schema = sqlite.prepare(`
      SELECT type, name, sql FROM sqlite_master
      WHERE sql IS NOT NULL ORDER BY type, name
    `).all() as Array<{ name: string, sql: string, type: string }>
    const serialized = JSON.stringify(schema).toLowerCase()

    expect(serialized).not.toContain('watermark')
    expect(serialized).not.toContain('site_branding')
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })

  it('persists ordinary public variants and keeps role/usage validation', () => {
    sqlite.prepare(`
      INSERT INTO assets (
        id, role, status, private_object_key, sha256, byte_size, mime_type,
        width, height, created_at, updated_at
      ) VALUES ('asset-1', 'studio_photo', 'READY', 'test/original/asset-1.png',
                ?, 1024, 'image/png', 1200, 1600, ?, ?)
    `).run(SHA, NOW, NOW)

    const insert = sqlite.prepare(`
      INSERT INTO asset_variants (
        id, asset_id, storage_scope, status, object_key, input_sha256,
        media_role, usage, width, height, format, quality, crop_identity,
        recipe_version, sha256, byte_size, created_at, updated_at
      ) VALUES (?, 'asset-1', 'PUBLIC', 'READY', ?, ?, 'studio_photo', ?,
                480, 640, 'webp', 82, 'crop-v1', 'recipe-v4', ?, 512, ?, ?)
    `)
    expect(() => insert.run(
      'variant-1',
      'test/web/asset-1/recipe-v4/work-card/480.webp',
      SHA,
      'work-card',
      SHA,
      NOW,
      NOW,
    )).not.toThrow()
    expect(() => insert.run(
      'variant-2',
      'test/web/asset-1/recipe-v4/contact-qr/480.webp',
      SHA,
      'contact-qr',
      SHA,
      NOW,
      NOW,
    )).toThrow(/variant role and usage are incompatible/)
  })
})
