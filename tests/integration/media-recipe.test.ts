import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSyntheticTransparentPng } from '../../scripts/oss-preflight-core.mjs'
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import {
  generatePrivatePublicPreview,
  generatePublicVariants,
  PUBLIC_RECIPE_VERSION,
} from '../../server/utils/recipe/media-recipe'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const NOW = Date.UTC(2026, 7, 29)
const ASSET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-recipe-'))
  const databaseFile = resolve(directory, 'recipe.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()

  const content = createSyntheticTransparentPng()
  const objectKey = `test/recipe/original/${ASSET_ID}/source.png`
  const digest = createHash('sha256').update(content).digest('hex')
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size, mime_type,
      width, height, focal_x, focal_y, created_at, updated_at
    ) VALUES (?, 'studio_photo', 'READY', ?, ?, ?, 'image/png',
              3200, 2400, 0.2, 0.8, ?, ?)
  `).run(ASSET_ID, objectKey, digest, content.length, NOW, NOW)
  storage.seedPrivate(objectKey, content, 'image/png', digest, {
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

describe('public media generation without automatic overlays', () => {
  it('generates recipe-v4 once and keeps preview/public processing overlay-free', async () => {
    const first = await generatePublicVariants(sqlite, storage, ASSET_ID, undefined, NOW)
    const callsAfterFirstRun = storage.processCalls.length

    expect(first).toHaveLength(12)
    expect(first.every(variant => variant.recipeVersion === PUBLIC_RECIPE_VERSION)).toBe(true)
    expect(storage.processCalls.every(call => !call.process.includes('/watermark,'))).toBe(true)
    expect(sqlite.prepare('PRAGMA table_info(asset_variants)').pluck().all())
      .not.toEqual(expect.arrayContaining([
        'protection_mode',
        'watermark_profile_id',
        'watermark_anchor',
      ]))

    const second = await generatePublicVariants(sqlite, storage, ASSET_ID, undefined, NOW + 1)
    expect(second.map(variant => variant.objectKey)).toEqual(first.map(variant => variant.objectKey))
    expect(storage.processCalls).toHaveLength(callsAfterFirstRun)

    await generatePrivatePublicPreview(sqlite, storage, {
      assetId: ASSET_ID,
      objectKey: 'test/recipe/preview/studio.webp',
      usage: 'detail',
      width: 960,
    })
    expect(storage.processCalls.at(-1)?.process).not.toContain('/watermark,')
  })
})
