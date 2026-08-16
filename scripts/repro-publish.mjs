// Repro: publish a work whose studio photo is the small 160x64 E2E PNG.
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createSyntheticWatermarkPng } from './oss-preflight-core.mjs'
import { migrateDatabase, openDatabase } from '../server/utils/database.ts'
import { createManagedWork, replaceManagedStudioPhotos } from '../server/utils/work-management.ts'
import { checkWorkPublication, publishWork } from '../server/utils/work-publication.ts'
import { FakeMediaStorage } from '../tests/helpers/fake-media-storage.ts'

const NOW = Date.UTC(2026, 7, 1)
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ASSET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-repro-'))
try {
  const databaseFile = resolve(directory, 'repro.db')
  await migrateDatabase(databaseFile)
  const { sqlite } = openDatabase(databaseFile)
  const storage = new FakeMediaStorage()

  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)

  const work = createManagedWork(sqlite, {
    slug: 'repro-work',
    characterName: '复现',
    species: '犬',
    purpose: 'commission',
    sortOrder: 0,
    featured: false,
  }, NOW)

  const content = createSyntheticWatermarkPng()
  console.log('png bytes:', content.length, 'dims:', content.readUInt32BE(16), 'x', content.readUInt32BE(20))
  const key = `test/repro/original/${ASSET_ID}/source.png`
  const sha256 = createHash('sha256').update(content).digest('hex')
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, 'studio_photo', 'READY', ?, ?, ?,
              'image/png', 160, 64, ?, ?)
  `).run(ASSET_ID, key, sha256, content.length, NOW, NOW)
  storage.seedPrivate(key, content, 'image/png', sha256)

  replaceManagedStudioPhotos(sqlite, work.id, 1, [{
    assetId: ASSET_ID,
    alt: '出厂照',
    primary: true,
    focalX: 0.5,
    focalY: 0.5,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    watermarkAnchor: 'bottom-right',
  }], NOW + 1000)

  console.log('check:', JSON.stringify(checkWorkPublication(sqlite, work.id)))
  try {
    const result = await publishWork(sqlite, storage, work.id, 2, USER_ID, NOW + 2000)
    console.log('publish result:', JSON.stringify(result.operation, null, 2))
  }
  catch (error) {
    console.error('publish threw:', error)
  }
  const op = sqlite.prepare('SELECT * FROM publication_operations ORDER BY started_at DESC LIMIT 1').get()
  console.log('op row:', op)
  sqlite.close()
}
finally {
  rmSync(directory, { force: true, recursive: true })
}
