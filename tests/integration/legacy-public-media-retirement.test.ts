import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSyntheticTransparentPng } from '../../scripts/oss-preflight-core.mjs'
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import type { PublicMediaCache } from '../../server/utils/public-media-cache'
import {
  LEGACY_PUBLIC_MEDIA_CONFIRMATION,
  retireLegacyPublicMedia,
} from '../../server/utils/runner/legacy-public-media-retirement'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const NOW = Date.UTC(2026, 7, 29)
const WORK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ASSET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const LEGACY_KEY = 'test/web/legacy/recipe-v3/work-card.webp'

const disabledCache: PublicMediaCache = {
  enabled: false,
  mediaOrigin: null,
  async describeExactFilePurge() {
    throw new Error('disabled')
  },
  async purgeExactFiles() {
    throw new Error('disabled')
  },
}

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-public-retirement-'))
  const databaseFile = resolve(directory, 'retirement.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()

  const content = createSyntheticTransparentPng()
  const sourceKey = `test/original/${ASSET_ID}/studio.png`
  const digest = createHash('sha256').update(content).digest('hex')
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, purpose, publication_status,
      published_at, created_at, updated_at
    ) VALUES (?, 'retirement-test', '退役测试', '犬科', 'showcase',
              'published', ?, ?, ?)
  `).run(WORK_ID, NOW, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size, mime_type,
      width, height, created_at, updated_at
    ) VALUES (?, 'studio_photo', 'READY', ?, ?, ?, 'image/png',
              3200, 2400, ?, ?)
  `).run(ASSET_ID, sourceKey, digest, content.length, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO work_assets (
      work_id, asset_id, role, alt_text, position, is_primary
    ) VALUES (?, ?, 'studio_photo', '退役测试出厂照', 0, 1)
  `).run(WORK_ID, ASSET_ID)
  sqlite.prepare(`
    INSERT INTO asset_variants (
      id, asset_id, storage_scope, status, object_key, input_sha256,
      media_role, usage, width, height, format, quality, crop_identity,
      recipe_version, sha256, byte_size, created_at, updated_at
    ) VALUES ('legacy', ?, 'PUBLIC', 'READY', ?, ?, 'studio_photo',
              'work-card', 480, 640, 'webp', 82, 'legacy', 'recipe-v3',
              ?, 128, ?, ?)
  `).run(ASSET_ID, LEGACY_KEY, digest, 'c'.repeat(64), NOW, NOW)
  storage.seedPrivate(sourceKey, content, 'image/png', digest, {
    fileSize: content.length,
    format: 'png',
    height: 2400,
    orientation: 1,
    width: 3200,
  })
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('legacy public media retirement', () => {
  it('dry-runs, requires confirmation, then replaces and removes legacy variants', async () => {
    await expect(retireLegacyPublicMedia({ cache: disabledCache, sqlite, storage }))
      .resolves.toMatchObject({ executed: false, legacyVariantCount: 1 })
    await expect(retireLegacyPublicMedia({
      cache: disabledCache,
      confirmation: 'wrong',
      execute: true,
      sqlite,
      storage,
    })).rejects.toThrow(/Refusing to execute/)

    await expect(retireLegacyPublicMedia({
      cache: disabledCache,
      confirmation: LEGACY_PUBLIC_MEDIA_CONFIRMATION,
      execute: true,
      now: NOW + 1,
      sqlite,
      storage,
    })).resolves.toMatchObject({ executed: true, legacyVariantCount: 1 })
    expect(storage.deletedPublicKeys).toContain(LEGACY_KEY)
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE recipe_version IN ('recipe-v1', 'recipe-v2', 'recipe-v3')
    `).pluck().get()).toBe(0)
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants WHERE recipe_version = 'recipe-v4'
    `).pluck().get()).toBe(12)
  })
})
