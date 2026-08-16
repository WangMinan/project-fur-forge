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
  completeCommissionUpload,
  createCommissionUpload,
  getCommissionDesignReference,
  getCommissionSubmissionDetail,
  listCommissionSubmissions,
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

async function createAndSeed(id = SESSION_ID, now = NOW) {
  const created = await createCommissionUpload(
    sqlite,
    storage,
    { appEnv: 'test' },
    expected(),
    {
      id,
      keyPrefix: 'test/r3-commission',
      now,
      objectToken: 'c'.repeat(48),
      token: TOKEN,
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

  it('allows consumption only through a submission and keeps list/audit output PII-free', async () => {
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
    sqlite.prepare(`
      INSERT INTO commission_submissions (
        id, receipt_code, nickname, phone_number, qq, height_cm,
        weight_kg_tenths, design_asset_id, created_at, updated_at
      ) VALUES (?, 'DD-ABC123', '测试称呼', '19900000000', '100001',
        170, 605, ?, ?, ?)
    `).run(SESSION_ID, SESSION_ID, NOW + 2, NOW + 2)
    expect(() => sqlite.prepare(`
      UPDATE commission_upload_sessions
      SET status = 'CONSUMED', consumed_at = ?, version = version + 1,
          updated_at = ?
      WHERE id = ?
    `).run(NOW + 2, NOW + 2, SESSION_ID)).not.toThrow()

    const list = listCommissionSubmissions(sqlite)
    expect(list).toEqual([expect.objectContaining({
      id: SESSION_ID,
      receiptCode: 'DD-ABC123',
      nickname: '测试称呼',
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
