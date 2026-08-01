import { createHash } from 'node:crypto'
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
  createLargeSyntheticPng,
  createSyntheticWatermarkPng,
} from '../../scripts/oss-preflight-core.mjs'
import {
  completeUploadSession,
  retryAssetProcessing,
} from '../../server/utils/media-completion'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import { createUploadSession } from '../../server/utils/upload-session'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WORK_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const NOW = Date.UTC(2026, 7, 1)

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

function digests(content: Buffer) {
  return {
    contentMd5: createHash('md5').update(content).digest('base64'),
    sha256: createHash('sha256').update(content).digest('hex'),
  }
}

function insertFixtures() {
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, suit_type, purpose,
      owner_display, created_at, updated_at
    ) VALUES (?, 'test-work', '团子', '犬科', 'full', 'showcase', '不公开', ?, ?)
  `).run(WORK_ID, NOW, NOW)
}

async function createSession(
  id: string,
  content: Buffer,
  width: number,
  height: number,
) {
  const result = await createUploadSession(
    sqlite,
    storage,
    { appEnv: 'test' },
    USER_ID,
    {
      owner: { type: 'work', id: WORK_ID, expectedVersion: 1 },
      mediaRole: 'studio_photo',
      expected: {
        contentType: 'image/png',
        byteSize: content.length,
        ...digests(content),
        width,
        height,
      },
    },
    {
      id,
      keyPrefix: 'test/t15-fixture',
      now: NOW,
      objectToken: 'e'.repeat(48),
    },
  )
  const key = storage.signedPuts.at(-1)?.objectKey
  if (!key) {
    throw new Error('Fake signed key was not recorded.')
  }
  storage.seedPrivate(key, content, 'image/png')
  return { key, result }
}

async function createWatermarkSession(id: string, content: Buffer) {
  await createUploadSession(
    sqlite,
    storage,
    { appEnv: 'test' },
    USER_ID,
    {
      owner: { type: 'site', id: 'branding', expectedVersion: 1 },
      mediaRole: 'watermark_logo',
      expected: {
        contentType: 'image/png',
        byteSize: content.length,
        ...digests(content),
        width: 160,
        height: 64,
      },
    },
    {
      id,
      keyPrefix: 'test/gate07-upload',
      now: NOW,
      objectToken: id.replaceAll('-', '').slice(0, 48).padEnd(48, 'a'),
    },
  )
  const key = storage.signedPuts.at(-1)!.objectKey
  storage.seedPrivate(key, content, 'image/png')
  return key
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-completion-'))
  const databaseFile = resolve(directory, 'completion.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
  insertFixtures()
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('verified upload completion', () => {
  it('accepts transparent watermark PNGs and rejects opaque candidates', async () => {
    const transparent = createSyntheticWatermarkPng()
    const acceptedId = '11111111-1111-4111-8111-111111111111'
    await createWatermarkSession(acceptedId, transparent)
    await expect(completeUploadSession(
      sqlite,
      storage,
      acceptedId,
      { expectedVersion: 1, focalX: 0.5, focalY: 0.5 },
      NOW + 1_000,
    )).resolves.toMatchObject({
      asset: { role: 'watermark_logo', status: 'READY', previews: [] },
    })

    const opaque = Buffer.from(transparent)
    opaque[25] = 2
    const rejectedId = '22222222-2222-4222-8222-222222222222'
    const rejectedKey = await createWatermarkSession(rejectedId, opaque)
    await expect(completeUploadSession(
      sqlite,
      storage,
      rejectedId,
      { expectedVersion: 1, focalX: 0.5, focalY: 0.5 },
      NOW + 1_000,
    )).rejects.toMatchObject({ statusCode: 400 })
    expect(storage.deletedPrivateKeys).toContain(rejectedKey)
  })

  it('verifies the actual object and completes idempotently without leaking its key', async () => {
    const content = createSyntheticWatermarkPng()
    const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    await createSession(id, content, 160, 64)

    const result = await completeUploadSession(
      sqlite,
      storage,
      id,
      {
        expectedVersion: 1,
        focalX: 0.4,
        focalY: 0.6,
        watermarkAnchor: 'bottom-right',
      },
      NOW + 1_000,
    )

    expect(result.asset).toMatchObject({
      assetId: id,
      status: 'READY',
      byteSize: content.length,
      width: 160,
      height: 64,
      focalX: 0.4,
      focalY: 0.6,
      watermarkAnchor: 'bottom-right',
    })
    expect(result.asset).not.toHaveProperty('privateObjectKey')
    expect(result.asset).not.toHaveProperty('sha256')
    expect(result.session).not.toHaveProperty('privateObjectKey')
    expect(sqlite.prepare(`
      SELECT sha256 FROM assets WHERE id = ?
    `).pluck().get(id)).toBe(digests(content).sha256)

    await expect(completeUploadSession(
      sqlite,
      storage,
      id,
      {
        expectedVersion: 1,
        focalX: 0,
        focalY: 0,
        watermarkAnchor: 'top-left',
      },
      NOW + 2_000,
    )).resolves.toMatchObject({ asset: { assetId: id, focalX: 0.4 } })
  })

  it('records the safe failure stage and deletes the exact invalid object', async () => {
    const content = createSyntheticWatermarkPng()
    const id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const { key } = await createSession(id, content, 160, 64)
    storage.objects.get(key)!.sha256Metadata = 'f'.repeat(64)

    await expect(completeUploadSession(
      sqlite,
      storage,
      id,
      {
        expectedVersion: 1,
        focalX: 0.5,
        focalY: 0.5,
        watermarkAnchor: 'top-left',
      },
      NOW + 1_000,
    )).rejects.toMatchObject({ statusCode: 400 })

    expect(storage.deletedPrivateKeys).toEqual([key])
    expect(sqlite.prepare(`
      SELECT status, failure_code AS failureCode, failure_stage AS failureStage
      FROM upload_sessions WHERE id = ?
    `).get(id)).toEqual({
      status: 'FAILED',
      failureCode: 'UPLOAD_METADATA_MISMATCH',
      failureStage: 'HEAD',
    })
  })

  it('creates a bounded private preprocess and preserves the original', async () => {
    const content = createLargeSyntheticPng()
    const id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const { key } = await createSession(id, content, 9_500, 1_030)

    const result = await completeUploadSession(
      sqlite,
      storage,
      id,
      {
        expectedVersion: 1,
        focalX: 0.5,
        focalY: 0.5,
        watermarkAnchor: 'top-left',
      },
      NOW + 1_000,
    )

    expect(result.asset.status).toBe('READY')
    expect(storage.objects.get(key)?.content.equals(content)).toBe(true)
    expect(storage.privatePuts).toHaveLength(1)
    expect(storage.privatePuts[0]?.objectKey).toMatch(
      /^test\/t15-fixture\/processing\/[^/]+\/preprocess-v1\/[0-9a-f]{64}\.png$/u,
    )
    const variant = sqlite.prepare(`
      SELECT storage_scope AS storageScope, usage, width, height,
             input_sha256 AS inputSha256, sha256, byte_size AS byteSize
      FROM asset_variants WHERE asset_id = ?
    `).get(id) as Record<string, unknown>
    expect(variant).toMatchObject({
      storageScope: 'PRIVATE',
      usage: 'preprocess',
      inputSha256: digests(content).sha256,
    })
    expect(Number(variant.width)).toBeLessThanOrEqual(4_096)
    expect(Number(variant.height)).toBeLessThanOrEqual(4_096)
    expect(Number(variant.byteSize)).toBeLessThanOrEqual(20_000_000)
    expect(variant.sha256).not.toBe(variant.inputSha256)
  }, 30_000)

  it('keeps a verified large original when preprocessing fails and can retry', async () => {
    const content = createLargeSyntheticPng()
    const id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    const { key } = await createSession(id, content, 9_500, 1_030)
    storage.failPut = true

    const failed = await completeUploadSession(
      sqlite,
      storage,
      id,
      {
        expectedVersion: 1,
        focalX: 0.5,
        focalY: 0.5,
        watermarkAnchor: 'top-left',
      },
      NOW + 1_000,
    )
    expect(failed.asset).toMatchObject({
      status: 'FAILED',
      processingFailureCode: 'UPLOAD_PREPROCESS_FAILURE',
    })
    expect(storage.objects.get(key)?.content.equals(content)).toBe(true)

    storage.failPut = false
    const retried = await retryAssetProcessing(
      sqlite,
      storage,
      id,
      failed.asset.version,
      NOW + 2_000,
    )
    expect(retried).toMatchObject({
      status: 'READY',
      processingFailureCode: null,
    })
  }, 45_000)
})
