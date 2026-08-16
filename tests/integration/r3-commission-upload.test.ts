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
import { createSyntheticSourcePng } from '../../scripts/oss-preflight-core.mjs'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import {
  COMMISSION_UPLOAD_TTL_MS,
  cancelCommissionUpload,
  cleanupExpiredCommissionUploads,
  completeCommissionUpload,
  createCommissionUpload,
  createCommissionSubmission,
  getCommissionDesignReference,
  getCommissionSubmissionDetail,
  listCommissionSubmissions,
  retryCommissionUpload,
  updateCommissionSubmission,
} from '../../server/utils/service/commission-management'
import { commissionUploadExpectedSchema } from '../../shared/schemas/commission'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SESSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const NOW = Date.UTC(2026, 7, 16)
const TOKEN = 'a'.repeat(43)
const CONTENT = createSyntheticSourcePng(640, 480) as Buffer

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

function expected(content = CONTENT) {
  return {
    contentType: 'image/png' as const,
    byteSize: content.length,
    contentMd5: createHash('md5').update(content).digest('base64'),
    sha256: createHash('sha256').update(content).digest('hex'),
    width: 640,
    height: 480,
  }
}

async function createAndSeed(
  id = SESSION_ID,
  now = NOW,
  token = TOKEN,
) {
  const created = await createCommissionUpload(
    sqlite,
    storage,
    { appEnv: 'test' },
    expected(),
    {
      id,
      keyPrefix: 'test/r3-commission',
      now,
      objectToken: createHash('sha256').update(id).digest('hex').slice(0, 48),
      token,
    },
  )
  const key = storage.signedPuts.at(-1)?.objectKey
  if (!key) {
    throw new Error('Signed upload key was not recorded.')
  }
  storage.seedPrivate(key, CONTENT, 'image/png')
  return { created, key }
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-r3-commission-'))
  const databaseFile = resolve(directory, 'studio.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { recursive: true, force: true })
})

describe('R3-B anonymous commission upload', () => {
  it('keeps the bearer secret out of storage and completes one private asset idempotently', async () => {
    const { created } = await createAndSeed()
    const persisted = sqlite.prepare(`
      SELECT token_digest AS tokenDigest, private_object_key AS privateObjectKey,
        expires_at AS expiresAt
      FROM commission_upload_sessions WHERE id = ?
    `).get(SESSION_ID) as {
      expiresAt: number
      privateObjectKey: string
      tokenDigest: string
    }

    expect(created.session).toMatchObject({
      uploadSessionId: SESSION_ID,
      status: 'AWAITING_UPLOAD',
      version: 1,
      assetId: null,
    })
    expect(created.token).toBe(TOKEN)
    expect(created.upload.headers).toMatchObject({
      'Content-Type': 'image/png',
      'Content-MD5': expected().contentMd5,
      'x-oss-meta-sha256': expected().sha256,
      'x-oss-forbid-overwrite': 'true',
    })
    expect(persisted.tokenDigest).toBe(
      createHash('sha256').update(TOKEN).digest('hex'),
    )
    expect(persisted.tokenDigest).not.toContain(TOKEN)
    expect(persisted.expiresAt).toBe(NOW + COMMISSION_UPLOAD_TTL_MS)
    expect(JSON.stringify(created.session)).not.toContain(persisted.privateObjectKey)

    await expect(completeCommissionUpload(
      sqlite,
      storage,
      SESSION_ID,
      'b'.repeat(43),
      1,
      NOW + 1,
    )).rejects.toMatchObject({ statusCode: 404 })
    expect(sqlite.prepare(`
      SELECT status FROM commission_upload_sessions WHERE id = ?
    `).pluck().get(SESSION_ID)).toBe('AWAITING_UPLOAD')

    const completed = await completeCommissionUpload(
      sqlite,
      storage,
      SESSION_ID,
      TOKEN,
      1,
      NOW + 2,
    )
    expect(completed).toMatchObject({
      status: 'COMPLETED',
      version: 3,
      assetId: SESSION_ID,
    })
    await expect(completeCommissionUpload(
      sqlite,
      storage,
      SESSION_ID,
      TOKEN,
      1,
      NOW + 3,
    )).resolves.toEqual(completed)
    expect(sqlite.prepare(`
      SELECT role, status FROM assets WHERE id = ?
    `).get(SESSION_ID)).toEqual({
      role: 'commission_design_reference',
      status: 'READY',
    })
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants WHERE asset_id = ?
    `).pluck().get(SESSION_ID)).toBe(0)
    expect(sqlite.pragma('foreign_key_check')).toEqual([])
    expect(sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
  })

  it('consumes atomically through submission, retries receipt collisions, and keeps list/audit output PII-free', async () => {
    await createAndSeed()
    await completeCommissionUpload(
      sqlite,
      storage,
      SESSION_ID,
      TOKEN,
      1,
      NOW + 1,
    )
    expect(() => sqlite.prepare(`
      UPDATE commission_upload_sessions
      SET status = 'CONSUMED', consumed_at = ?, version = version + 1,
          updated_at = ?
      WHERE id = ?
    `).run(NOW + 2, NOW + 2, SESSION_ID)).toThrow()

    sqlite.prepare(`
      INSERT INTO users (
        id, username, password_hash, password_changed_at, created_at, updated_at
      ) VALUES (?, 'commission-admin', 'hash', ?, ?, ?)
    `).run(USER_ID, NOW, NOW, NOW)
    const created = createCommissionSubmission(sqlite, {
      uploadSessionId: SESSION_ID,
      expectedUploadVersion: 3,
      nickname: '合成称呼',
      phone: { countryCode: '+86', number: '19900000000' },
      qq: '100001',
      heightCm: 170,
      weightKg: 60.5,
    }, TOKEN, {
      id: SESSION_ID,
      now: NOW + 2,
      receiptCode: () => 'DD-ABC123',
    })
    expect(created).toEqual({ receiptCode: 'DD-ABC123' })
    expect(sqlite.prepare(`
      SELECT status FROM commission_upload_sessions WHERE id = ?
    `).pluck().get(SESSION_ID)).toBe('CONSUMED')
    expect(() => createCommissionSubmission(sqlite, {
      uploadSessionId: SESSION_ID,
      expectedUploadVersion: 3,
      nickname: '合成称呼',
      phone: { countryCode: '+86', number: '19900000000' },
      qq: '100001',
      heightCm: 170,
      weightKg: 60.5,
    }, TOKEN, { now: NOW + 3 })).toThrowError(expect.objectContaining({
      statusCode: 409,
    }))

    const list = listCommissionSubmissions(sqlite)
    expect(list).toEqual([expect.objectContaining({
      id: SESSION_ID,
      receiptCode: 'DD-ABC123',
      nickname: '合成称呼',
      status: 'pending',
    })])
    const serializedList = JSON.stringify(list)
    expect(serializedList).not.toMatch(/phone|qq|height|weight|note/iu)
    expect(serializedList).not.toContain('19900000000')
    expect(serializedList).not.toContain('100001')

    const detail = getCommissionSubmissionDetail(sqlite, SESSION_ID)
    expect(detail.designReferencePreviewHref).toBe(
      `/api/admin/v1/commissions/${SESSION_ID}/design-reference`,
    )
    const preview = await getCommissionDesignReference(
      sqlite,
      storage,
      SESSION_ID,
    )
    expect(preview.mimeType).toBe('image/png')
    expect(preview.content).toEqual(CONTENT)

    const accepted = updateCommissionSubmission(sqlite, SESSION_ID, 1, {
      actorUserId: USER_ID,
      internalNote: '已人工确认',
      status: 'accepted',
    }, NOW + 3)
    expect(accepted).toMatchObject({ status: 'accepted', version: 2 })
    const audit = sqlite.prepare(`
      SELECT action, entity_type AS entityType, entity_id AS entityId, result
      FROM audit_logs WHERE entity_id = ?
    `).get(SESSION_ID)
    expect(audit).toEqual({
      action: 'COMMISSION_SUBMISSION_UPDATE',
      entityType: 'COMMISSION_SUBMISSION',
      entityId: SESSION_ID,
      result: 'SUCCESS',
    })
    expect(JSON.stringify(audit)).not.toContain('19900000000')
    expect(JSON.stringify(audit)).not.toContain('100001')
  })

  it('cancels idempotently and retries into a fresh token/key/session', async () => {
    const { created, key } = await createAndSeed()
    const cancelled = await cancelCommissionUpload(
      sqlite,
      storage,
      SESSION_ID,
      TOKEN,
      created.session.version,
      NOW + 1,
    )
    expect(cancelled).toMatchObject({ status: 'CANCELLED', version: 2 })
    expect(storage.deletedPrivateKeys).toContain(key)
    await expect(cancelCommissionUpload(
      sqlite,
      storage,
      SESSION_ID,
      TOKEN,
      created.session.version,
      NOW + 2,
    )).resolves.toEqual(cancelled)

    const replacement = await retryCommissionUpload(
      sqlite,
      storage,
      { appEnv: 'test' },
      SESSION_ID,
      TOKEN,
      cancelled.version,
      NOW + 3,
    )
    expect(replacement.session.uploadSessionId).not.toBe(SESSION_ID)
    expect(replacement.session.status).toBe('AWAITING_UPLOAD')
    expect(replacement.token).not.toBe(TOKEN)
    expect(replacement.upload.url).not.toContain(key)
    expect(JSON.stringify(replacement.session)).not.toContain('/commission/original/')
  })

  it('retries a receipt collision inside the atomic submission boundary', async () => {
    const firstId = '11111111-1111-4111-8111-111111111111'
    const secondId = '22222222-2222-4222-8222-222222222222'
    const firstToken = 'f'.repeat(43)
    const secondToken = 'g'.repeat(43)
    await createAndSeed(firstId, NOW, firstToken)
    await completeCommissionUpload(sqlite, storage, firstId, firstToken, 1, NOW + 1)
    createCommissionSubmission(sqlite, {
      uploadSessionId: firstId,
      expectedUploadVersion: 3,
      nickname: '合成申请甲',
      phone: { countryCode: '+86', number: '19900000000' },
      qq: '100001',
      heightCm: 170,
      weightKg: 60,
    }, firstToken, {
      id: firstId,
      now: NOW + 2,
      receiptCode: () => 'DD-COLLIDE',
    })

    await createAndSeed(secondId, NOW, secondToken)
    await completeCommissionUpload(sqlite, storage, secondId, secondToken, 1, NOW + 1)
    const attempts: number[] = []
    const second = createCommissionSubmission(sqlite, {
      uploadSessionId: secondId,
      expectedUploadVersion: 3,
      nickname: '合成申请乙',
      phone: { countryCode: '+86', number: '19800000000' },
      qq: '100002',
      heightCm: 180,
      weightKg: 70,
    }, secondToken, {
      id: secondId,
      now: NOW + 3,
      receiptCode: (attempt) => {
        attempts.push(attempt)
        return attempt === 0 ? 'DD-COLLIDE' : 'DD-UNIQUE2'
      },
    })
    expect(second.receiptCode).toBe('DD-UNIQUE2')
    expect(attempts).toEqual([0, 1])
    expect(sqlite.prepare(`
      SELECT status FROM commission_upload_sessions WHERE id = ?
    `).pluck().get(secondId)).toBe('CONSUMED')
  })

  it('cleans expired pending and completed uploads serially without touching consumed assets', async () => {
    const pendingId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const completedId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const pendingToken = 'd'.repeat(43)
    const completedToken = 'e'.repeat(43)
    const pending = await createAndSeed(pendingId, NOW, pendingToken)
    const completed = await createAndSeed(completedId, NOW, completedToken)
    await completeCommissionUpload(
      sqlite,
      storage,
      completedId,
      completedToken,
      1,
      NOW + 1,
    )

    const dryRun = await cleanupExpiredCommissionUploads({
      dryRun: true,
      now: NOW + COMMISSION_UPLOAD_TTL_MS,
      sqlite,
      storage,
    })
    expect(dryRun).toMatchObject({ scanned: 2, deletedObjects: 0 })
    expect(storage.objects.has(pending.key)).toBe(true)
    expect(storage.objects.has(completed.key)).toBe(true)

    const cleaned = await cleanupExpiredCommissionUploads({
      dryRun: false,
      now: NOW + COMMISSION_UPLOAD_TTL_MS,
      sqlite,
      storage,
    })
    expect(cleaned).toMatchObject({
      deletedAssets: 1,
      deletedObjects: 2,
      deletedSessions: 2,
      failed: 0,
      scanned: 2,
    })
    expect(sqlite.prepare(`
      SELECT count(*) FROM commission_upload_sessions
      WHERE id IN (?, ?)
    `).pluck().get(pendingId, completedId)).toBe(0)
    expect(sqlite.prepare(`
      SELECT count(*) FROM assets WHERE id = ?
    `).pluck().get(completedId)).toBe(0)
    expect(sqlite.pragma('foreign_key_check')).toEqual([])
  })

  it('expires without creating an asset and rejects images below the 64px contract', async () => {
    const { key } = await createAndSeed()
    await expect(completeCommissionUpload(
      sqlite,
      storage,
      SESSION_ID,
      TOKEN,
      1,
      NOW + COMMISSION_UPLOAD_TTL_MS,
    )).rejects.toMatchObject({ statusCode: 409 })
    expect(sqlite.prepare(`
      SELECT status FROM commission_upload_sessions WHERE id = ?
    `).pluck().get(SESSION_ID)).toBe('EXPIRED')
    expect(storage.deletedPrivateKeys).toContain(key)
    expect(sqlite.prepare('SELECT count(*) FROM assets').pluck().get()).toBe(0)

    expect(commissionUploadExpectedSchema.safeParse({
      ...expected(),
      width: 63,
    }).success).toBe(false)
    expect(() => sqlite.prepare(`
      UPDATE commission_upload_sessions SET status = 'AWAITING_UPLOAD'
      WHERE id = ?
    `).run(SESSION_ID)).toThrow()
  })
})
