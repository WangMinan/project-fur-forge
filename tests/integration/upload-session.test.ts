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
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import {
  cancelUploadSession,
  createUploadSession,
  getUploadSession,
  retryUploadSession,
  UPLOAD_SESSION_TTL_MS,
} from '../../server/utils/upload-session'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WORK_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SESSION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const MD5 = 'AAAAAAAAAAAAAAAAAAAAAA=='
const SHA256 = 'd'.repeat(64)
const NOW = Date.UTC(2026, 7, 1)

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

function insertFixtures(purpose = 'showcase') {
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO works (
      id, slug, character_name, species, suit_type, purpose,
      owner_display, created_at, updated_at
    ) VALUES (?, 'test-work', '团子', '犬科', 'full', ?, '不公开', ?, ?)
  `).run(WORK_ID, purpose, NOW, NOW)
}

function input(role: 'studio_photo' | 'design_sheet' = 'studio_photo') {
  return {
    owner: {
      type: 'work' as const,
      id: WORK_ID,
      expectedVersion: 1,
    },
    mediaRole: role,
    expected: {
      contentType: 'image/png' as const,
      byteSize: 1_024,
      contentMd5: MD5,
      sha256: SHA256,
      width: 800,
      height: 1_200,
    },
  }
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-upload-'))
  const databaseFile = resolve(directory, 'upload.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('persistent conditional upload sessions', () => {
  it('persists the claims separately from assets and signs fixed PUT headers', async () => {
    insertFixtures()
    const result = await createUploadSession(
      sqlite,
      storage,
      { appEnv: 'test' },
      USER_ID,
      input(),
      {
        id: SESSION_ID,
        keyPrefix: 'test/t14-fixture',
        now: NOW,
        objectToken: 'e'.repeat(48),
      },
    )

    expect(result.session).toMatchObject({
      uploadSessionId: SESSION_ID,
      owner: { type: 'work', id: WORK_ID },
      ownerVersion: 1,
      mediaRole: 'studio_photo',
      status: 'AWAITING_UPLOAD',
      version: 1,
      assetId: null,
      failureCode: null,
    })
    expect(result.upload).toMatchObject({
      method: 'PUT',
      headers: {
        'Content-Type': 'image/png',
        'Content-MD5': MD5,
        'x-oss-meta-sha256': SHA256,
        'x-oss-forbid-overwrite': 'true',
      },
    })
    expect(result.session).not.toHaveProperty('privateObjectKey')
    expect(storage.signedPuts[0]?.objectKey).toMatch(
      /^test\/t14-fixture\/original\/[^/]+\/[0-9a-f]{48}\.png$/u,
    )
    expect(sqlite.prepare('SELECT count(*) FROM assets').pluck().get()).toBe(0)
  })

  it('rejects stale owners and role changes before signing', async () => {
    insertFixtures()
    await expect(createUploadSession(
      sqlite,
      storage,
      { appEnv: 'test' },
      USER_ID,
      {
        ...input(),
        owner: { ...input().owner, expectedVersion: 2 },
      },
    )).rejects.toMatchObject({ statusCode: 409 })
    await expect(createUploadSession(
      sqlite,
      storage,
      { appEnv: 'test' },
      USER_ID,
      input('design_sheet'),
    )).rejects.toMatchObject({ statusCode: 400 })
    expect(storage.signedPuts).toHaveLength(0)
  })

  it('allows watermark candidates only under site branding ownership', async () => {
    insertFixtures()
    const expected = input().expected
    await expect(createUploadSession(
      sqlite,
      storage,
      { appEnv: 'test' },
      USER_ID,
      {
        owner: { type: 'site', id: 'branding', expectedVersion: 1 },
        mediaRole: 'watermark_logo',
        expected,
      },
    )).resolves.toMatchObject({
      session: {
        owner: { type: 'site', id: 'branding' },
        mediaRole: 'watermark_logo',
      },
    })
    await expect(createUploadSession(
      sqlite,
      storage,
      { appEnv: 'test' },
      USER_ID,
      {
        owner: { type: 'work', id: WORK_ID, expectedVersion: 1 },
        mediaRole: 'watermark_logo',
        expected,
      },
    )).rejects.toMatchObject({ statusCode: 400 })
    await expect(createUploadSession(
      sqlite,
      storage,
      { appEnv: 'test' },
      USER_ID,
      {
        owner: { type: 'site', id: 'home', expectedVersion: 1 },
        mediaRole: 'watermark_logo',
        expected,
      },
    )).rejects.toMatchObject({ statusCode: 400 })
  })

  it('cancels by exact key and retries with a new session and key', async () => {
    insertFixtures()
    const created = await createUploadSession(
      sqlite,
      storage,
      { appEnv: 'test' },
      USER_ID,
      input(),
      { id: SESSION_ID, keyPrefix: 'test/t14-retry', now: NOW },
    )
    const oldKey = storage.signedPuts[0]!.objectKey
    const cancelled = await cancelUploadSession(
      sqlite,
      storage,
      SESSION_ID,
      created.session.version,
      NOW + 1,
    )
    const retried = await retryUploadSession(
      sqlite,
      storage,
      { appEnv: 'test' },
      USER_ID,
      SESSION_ID,
      cancelled.version,
      NOW + 2,
    )

    expect(cancelled.status).toBe('CANCELLED')
    expect(storage.deletedPrivateKeys).toEqual([oldKey, oldKey])
    expect(retried.session.uploadSessionId).not.toBe(SESSION_ID)
    expect(storage.signedPuts[1]!.objectKey).not.toBe(oldKey)
  })

  it('expires lazily and records safe cleanup failures', async () => {
    insertFixtures()
    await createUploadSession(
      sqlite,
      storage,
      { appEnv: 'test' },
      USER_ID,
      input(),
      { id: SESSION_ID, keyPrefix: 'test/t14-expire', now: NOW },
    )
    storage.failDelete = true
    const expired = await getUploadSession(
      sqlite,
      storage,
      SESSION_ID,
      NOW + UPLOAD_SESSION_TTL_MS,
    )

    expect(expired).toMatchObject({
      status: 'FAILED',
      failureCode: 'UPLOAD_CLEANUP_FAILED',
    })
    expect(JSON.stringify(expired)).not.toContain('/original/')
  })
})
