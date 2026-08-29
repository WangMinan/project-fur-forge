import { mkdtempSync, rmSync } from 'node:fs'
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
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import type {
  R3StageAObjectInspection,
  R3StageAObjectScope,
  R3StageAObjectStore,
} from '../../server/utils/runner/r3-stage-a-retirement'
import {
  executeCommissionDeletion,
  listCommissionRetentionCandidates,
  previewCommissionDeletion,
} from '../../server/utils/service/commission-retention'

const NOW = Date.UTC(2026, 7, 20)
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SUBMISSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ASSET_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const SESSION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const VARIANT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const PENDING_ASSET_ID = '11111111-1111-4111-8111-111111111111'
const ORIGINAL_KEY = 'test/commission/original/design.png'
const VARIANT_KEY = 'test/commission/preprocess/design.png'

interface StoredObject {
  current: boolean
  deleteMarkers: number
  versions: number
}

class ExactFakeStore implements R3StageAObjectStore {
  readonly objects = new Map<string, StoredObject>()
  failDelete = false
  failInspect = false

  seed(key: string, value: StoredObject) {
    this.objects.set(key, { ...value })
  }

  async inspect(
    _scope: R3StageAObjectScope,
    objectKey: string,
  ): Promise<R3StageAObjectInspection> {
    if (this.failInspect) {
      throw new Error('fake inspect failure')
    }
    const value = this.objects.get(objectKey) ?? {
      current: false,
      deleteMarkers: 0,
      versions: 0,
    }
    return {
      ...value,
      versionBytes: value.versions * 100,
    }
  }

  async deleteAll(_scope: R3StageAObjectScope, objectKey: string) {
    if (this.failDelete) {
      throw new Error('fake non-NotFound deletion failure')
    }
    this.objects.set(objectKey, {
      current: false,
      deleteMarkers: 0,
      versions: 0,
    })
  }
}

let directory = ''
let database: ReturnType<typeof openDatabase>
let sqlite: Database.Database
let store: ExactFakeStore

function seedSubmission(options: { variantScope?: 'PRIVATE' | 'PUBLIC' } = {}) {
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'retention-admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, fit_mode, created_at, updated_at
    ) VALUES (?, 'commission_design_reference', 'READY', ?, ?, 100,
      'image/png', 640, 640, 'contain', ?, ?)
  `).run(ASSET_ID, ORIGINAL_KEY, 'a'.repeat(64), NOW, NOW)
  sqlite.prepare(`
    INSERT INTO commission_upload_sessions (
      id, token_digest, private_object_key, expected_content_type,
      expected_bytes, expected_content_md5, expected_sha256,
      expected_width, expected_height, status, asset_id, version,
      created_at, expires_at, completed_at, consumed_at, updated_at
    ) VALUES (?, ?, ?, 'image/png', 100, ?, ?, 640, 640,
      'CONSUMED', ?, 3, ?, ?, ?, ?, ?)
  `).run(
    SESSION_ID,
    'b'.repeat(64),
    ORIGINAL_KEY,
    'c'.repeat(24),
    'a'.repeat(64),
    ASSET_ID,
    NOW - 10_000,
    NOW + 590_000,
    NOW - 5_000,
    NOW - 4_000,
    NOW - 4_000,
  )
  sqlite.prepare(`
    INSERT INTO commission_submissions (
      id, receipt_code, nickname, species, phone_country_code, phone_number,
      qq, height_cm, weight_kg_tenths, design_asset_id, status,
      handled_at, handled_by, version, created_at, updated_at
    ) VALUES (?, 'DD-RETENTION01', '脱敏候选', '犬科', '+86', '19900000000',
      '100001', 170, 605, ?, 'rejected', ?, ?, 2, ?, ?)
  `).run(SUBMISSION_ID, ASSET_ID, NOW, USER_ID, NOW - 20_000, NOW)

  if (options.variantScope) {
    sqlite.pragma('ignore_check_constraints = ON')
    sqlite.prepare(`
      INSERT INTO asset_variants (
        id, asset_id, storage_scope, status, object_key, input_sha256,
        media_role, usage, width, height, format, quality, crop_identity,
        recipe_version, sha256, byte_size, created_at, updated_at
      ) VALUES (?, ?, ?, 'READY', ?, ?, 'commission_design_reference',
        'preprocess', 640, 640, 'png', 82, 'contain', 'preprocess-v1',
        ?, 100, ?, ?)
    `).run(
      VARIANT_ID,
      ASSET_ID,
      options.variantScope,
      VARIANT_KEY,
      'a'.repeat(64),
      'd'.repeat(64),
      NOW,
      NOW,
    )
    sqlite.pragma('ignore_check_constraints = OFF')
  }
  sqlite.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, entity_type, entity_id, result, created_at
    ) VALUES (?, ?, 'COMMISSION_SUBMISSION_UPDATE',
      'COMMISSION_SUBMISSION', ?, 'SUCCESS', ?)
  `).run('ffffffff-ffff-4fff-8fff-ffffffffffff', USER_ID, SUBMISSION_ID, NOW)
  store.seed(ORIGINAL_KEY, { current: true, versions: 2, deleteMarkers: 1 })
  if (options.variantScope) {
    store.seed(VARIANT_KEY, { current: true, versions: 1, deleteMarkers: 0 })
  }
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-retention-'))
  const databaseFile = resolve(directory, 'studio.db')
  await migrateDatabase(databaseFile)
  database = openDatabase(databaseFile)
  sqlite = database.sqlite
  store = new ExactFakeStore()
})

afterEach(() => {
  database.sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('commission retention and exact single deletion', () => {
  it('lists rejected immediately, only flags stale pending, and masks identifiers', () => {
    seedSubmission()
    sqlite.prepare(`
      INSERT INTO assets (
        id, role, status, private_object_key, sha256, byte_size,
        mime_type, width, height, fit_mode, created_at, updated_at
      ) VALUES (?, 'commission_design_reference', 'READY', ?, ?, 100,
        'image/png', 640, 640, 'contain', ?, ?)
    `).run(
      PENDING_ASSET_ID,
      'test/commission/original/pending.png',
      '9'.repeat(64),
      NOW,
      NOW,
    )
    sqlite.prepare(`
      INSERT INTO commission_submissions (
        id, receipt_code, nickname, species, phone_country_code, phone_number,
        qq, height_cm, weight_kg_tenths, design_asset_id, status,
        version, created_at, updated_at
      ) VALUES (?, 'DD-PENDING001', '过期复核', '狐科', '+86', '19800000000',
        '100002', 180, 700, ?, 'pending', 1, ?, ?)
    `).run(
      '33333333-3333-4333-8333-333333333333',
      PENDING_ASSET_ID,
      NOW - 184 * 24 * 60 * 60 * 1_000,
      NOW,
    )
    const candidates = listCommissionRetentionCandidates(sqlite, NOW)
    expect(candidates).toEqual([
      expect.objectContaining({
        maskedReceiptCode: 'DD-…N01',
        reason: 'REJECTED_READY_FOR_DELETION',
        status: 'rejected',
      }),
      expect.objectContaining({
        maskedReceiptCode: 'DD-…001',
        reason: 'STALE_PENDING_REVIEW',
        status: 'pending',
      }),
    ])
    const serialized = JSON.stringify(candidates)
    expect(serialized).not.toContain(SUBMISSION_ID)
    expect(serialized).not.toMatch(/19900000000|100001|test\/commission/u)
  })

  it('dry-runs masked counts, deletes current/history/markers, and is idempotent', async () => {
    seedSubmission({ variantScope: 'PRIVATE' })
    const preview = await previewCommissionDeletion({
      identifier: SUBMISSION_ID,
      objectStore: store,
      sqlite,
    })
    expect(preview).toEqual({
      status: 'ready',
      databaseRows: {
        assets: 1,
        auditRelations: 1,
        submissions: 1,
        uploadSessions: 1,
        variants: 1,
      },
      privateObjects: {
        current: 2,
        deleteMarkers: 1,
        keys: 2,
        versions: 3,
      },
      blockers: [],
    })
    expect(sqlite.prepare('SELECT count(*) FROM commission_submissions').pluck().get()).toBe(1)

    const deleted = await executeCommissionDeletion({
      actorUserId: USER_ID,
      identifier: SUBMISSION_ID,
      now: NOW + 1,
      objectStore: store,
      sqlite,
    })
    expect(deleted.status).toBe('deleted')
    expect(sqlite.prepare('SELECT count(*) FROM commission_submissions').pluck().get()).toBe(0)
    expect(sqlite.prepare('SELECT count(*) FROM commission_upload_sessions').pluck().get()).toBe(0)
    expect(sqlite.prepare('SELECT count(*) FROM assets WHERE id = ?').pluck().get(ASSET_ID)).toBe(0)
    expect(sqlite.pragma('foreign_key_check')).toEqual([])
    expect(sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    const audit = sqlite.prepare(`
      SELECT entity_type AS entityType, entity_id AS entityId, result
      FROM audit_logs WHERE action = 'COMMISSION_DATA_DELETE'
    `).get() as { entityId: string, entityType: string, result: string }
    expect(audit).toMatchObject({
      entityType: 'COMMISSION_SUBMISSION_DIGEST',
      result: 'SUCCESS',
    })
    expect(audit.entityId).toMatch(/^[0-9a-f]{16}$/u)
    expect(audit.entityId).not.toBe(SUBMISSION_ID)

    await expect(executeCommissionDeletion({
      actorUserId: USER_ID,
      identifier: SUBMISSION_ID,
      now: NOW + 2,
      objectStore: store,
      sqlite,
    })).resolves.toMatchObject({ status: 'already_deleted' })
  })

  it('keeps database relations after storage failure and can retry', async () => {
    seedSubmission()
    store.failDelete = true
    await expect(executeCommissionDeletion({
      actorUserId: USER_ID,
      identifier: SUBMISSION_ID,
      objectStore: store,
      sqlite,
    })).rejects.toMatchObject({ statusCode: 500 })
    expect(sqlite.prepare('SELECT count(*) FROM commission_submissions').pluck().get()).toBe(1)
    expect(sqlite.prepare(`
      SELECT result FROM audit_logs
      WHERE action = 'COMMISSION_DATA_DELETE'
    `).pluck().get()).toBe('FAILURE')

    store.failDelete = false
    await expect(executeCommissionDeletion({
      actorUserId: USER_ID,
      identifier: SUBMISSION_ID,
      objectStore: store,
      sqlite,
    })).resolves.toMatchObject({ status: 'deleted' })
  })

  it('requires an explicit manual approval for a non-rejected single deletion', async () => {
    seedSubmission()
    sqlite.prepare(`
      UPDATE commission_submissions SET status = 'accepted' WHERE id = ?
    `).run(SUBMISSION_ID)
    await expect(previewCommissionDeletion({
      identifier: SUBMISSION_ID,
      objectStore: store,
      sqlite,
    })).resolves.toMatchObject({
      status: 'blocked',
      blockers: ['STATUS_NOT_REJECTED'],
    })
    await expect(previewCommissionDeletion({
      allowNonRejected: true,
      identifier: SUBMISSION_ID,
      objectStore: store,
      sqlite,
    })).resolves.toMatchObject({ status: 'ready', blockers: [] })
    await expect(executeCommissionDeletion({
      actorUserId: null,
      allowNonRejected: true,
      identifier: SUBMISSION_ID,
      objectStore: store,
      sqlite,
    })).resolves.toMatchObject({ status: 'deleted' })
  })

  it('re-enters safely after objects were deleted but the database commit failed', async () => {
    seedSubmission()
    sqlite.exec(`
      CREATE TRIGGER test_commission_asset_delete_failure
      BEFORE DELETE ON assets WHEN OLD.id = '${ASSET_ID}'
      BEGIN SELECT RAISE(ABORT, 'test db failure'); END;
    `)
    await expect(executeCommissionDeletion({
      actorUserId: USER_ID,
      identifier: SUBMISSION_ID,
      objectStore: store,
      sqlite,
    })).rejects.toMatchObject({ statusCode: 500 })
    expect((await store.inspect('private', ORIGINAL_KEY)).current).toBe(false)
    expect(sqlite.prepare('SELECT count(*) FROM commission_submissions').pluck().get()).toBe(1)
    sqlite.exec('DROP TRIGGER test_commission_asset_delete_failure')

    await expect(executeCommissionDeletion({
      actorUserId: USER_ID,
      identifier: SUBMISSION_ID,
      objectStore: store,
      sqlite,
    })).resolves.toMatchObject({ status: 'deleted' })
  })

  it('blocks anomalous external references and non-private variants', async () => {
    seedSubmission({ variantScope: 'PUBLIC' })
    sqlite.prepare(`
      INSERT INTO publication_operations (
        id, operation_type, entity_type, entity_id, requested_version,
        status, started_at, updated_at, completed_at
      ) VALUES (?, 'PUBLISH', 'WORK', ?, 1, 'DONE', ?, ?, ?)
    `).run(
      '22222222-2222-4222-8222-222222222222',
      ASSET_ID,
      NOW,
      NOW,
      NOW,
    )
    const preview = await previewCommissionDeletion({
      identifier: SUBMISSION_ID,
      objectStore: store,
      sqlite,
    })
    expect(preview.status).toBe('blocked')
    expect(preview.blockers).toEqual(expect.arrayContaining([
      'EXTERNAL_REFERENCE_FOUND',
      'PRIVATE_VARIANT_INVALID',
    ]))
    await expect(executeCommissionDeletion({
      actorUserId: USER_ID,
      identifier: SUBMISSION_ID,
      objectStore: store,
      sqlite,
    })).rejects.toMatchObject({
      reason: 'COMMISSION_DELETE_BLOCKED',
      statusCode: 409,
    })
    expect(sqlite.prepare('SELECT count(*) FROM commission_submissions').pluck().get()).toBe(1)
  })
})
