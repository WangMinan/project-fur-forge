import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import type Database from 'better-sqlite3'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import { updateCommissionSubmission } from '../../server/utils/service/commission-management'
import {
  claimCommissionDeletionTarget, COMMISSION_DELETION_LEASE_MS, deleteCommissionTargetRows,
  findCommissionDeletionTarget, holdsCommissionDeletionLease, releaseCommissionDeletionLease,
  renewCommissionDeletionLease, updateCommissionSubmissionRow,
} from '../../server/utils/repository/commission-repository'
import { migrationsAfter, migrationsThrough } from '../helpers/migrations'
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
  vi.useRealTimers()
  database.sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('commission retention and exact single deletion', () => {
  it('upgrades an existing deletion fence without resetting data or leaving it locked forever', async () => {
    const file = resolve(directory, 'legacy.db')
    await migrateDatabase(file, { migrationsFolder: migrationsThrough(file, '0055_r7_x_contact') })
    const legacy = openDatabase(file).sqlite
    const current = sqlite
    try {
      sqlite = legacy
      seedSubmission()
      legacy.prepare('UPDATE commission_submissions SET email_deletion_pending=1 WHERE id=?').run(SUBMISSION_ID)
    }
    finally { sqlite = current; legacy.close() }
    await expect(migrateDatabase(file)).resolves.toMatchObject({ applied: migrationsAfter('0055_r7_x_contact') })
    const upgraded = openDatabase(file).sqlite
    try {
      expect(upgraded.prepare('SELECT version, email_deletion_pending, deletion_lease_expires_at FROM commission_submissions').get())
        .toEqual({ version: 2, email_deletion_pending: 1, deletion_lease_expires_at: null })
      expect(claimCommissionDeletionTarget(upgraded, findCommissionDeletionTarget(upgraded, SUBMISSION_ID)!, NOW)).toBeTruthy()
      expect(upgraded.pragma('foreign_key_check')).toEqual([])
    }
    finally { upgraded.close() }
  })

  it('does not grant a second deletion claim on a different database connection', () => {
    seedSubmission()
    const other = openDatabase(resolve(directory, 'studio.db')).sqlite
    try {
      expect(claimCommissionDeletionTarget(sqlite, findCommissionDeletionTarget(sqlite, SUBMISSION_ID)!)).toBeTruthy()
      expect(claimCommissionDeletionTarget(other, findCommissionDeletionTarget(other, 'DD-RETENTION01')!)).toBeFalsy()
    }
    finally { other.close() }
  })

  it('rolls back the claim when an email transmission still blocks deletion', async () => {
    seedSubmission()
    sqlite.prepare(`INSERT INTO commission_email_notifications
      (id, submission_id, recipient, status, attempt_count, next_attempt_at,
       lease_token, lease_expires_at, transmitting_at, created_at, updated_at)
      VALUES (?, ?, 'synthetic@example.invalid', 'sending', 1, ?, 'synthetic-lease', ?, ?, ?, ?)`)
      .run(crypto.randomUUID(), SUBMISSION_ID, NOW, NOW + 60_000, NOW, NOW, NOW)
    const remove = vi.spyOn(store, 'deleteAll')
    await expect(executeCommissionDeletion({ actorUserId: USER_ID, identifier: SUBMISSION_ID, objectStore: store, sqlite, now: NOW }))
      .rejects.toMatchObject({ statusCode: 409, reason: 'COMMISSION_DELETE_BLOCKED' })
    expect(remove).not.toHaveBeenCalled()
    expect(sqlite.prepare('SELECT version, email_deletion_pending, deletion_lease_expires_at FROM commission_submissions').get())
      .toEqual({ version: 2, email_deletion_pending: 0, deletion_lease_expires_at: null })
  })

  it('rejects an alias deletion in a separate process before it can delete any object', async () => {
    seedSubmission()
    const remove = store.deleteAll.bind(store)
    store.deleteAll = async (scope, key) => {
      const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
        import Database from 'better-sqlite3';
        import { executeCommissionDeletion } from ${JSON.stringify(new URL('../../server/utils/service/commission-retention.ts', import.meta.url).href)};
        const db = new Database(process.argv[1]); let deletes = 0;
        const objectStore = { inspect: async () => ({ current: true, versions: 0, deleteMarkers: 0, versionBytes: 0 }), deleteAll: async () => { deletes++; } };
        try { await executeCommissionDeletion({ sqlite: db, objectStore, actorUserId: null, identifier: 'DD-RETENTION01' }); process.stdout.write(JSON.stringify({ status: 200, deletes })); }
        catch (error) { process.stdout.write(JSON.stringify({ status: error.statusCode, deletes })); }
        finally { db.close(); }
      `, resolve(directory, 'studio.db')], { encoding: 'utf8', timeout: 10_000 })
      expect(child.status, child.stderr).toBe(0)
      expect(JSON.parse(child.stdout)).toEqual({ status: 409, deletes: 0 })
      await remove(scope, key)
    }
    await expect(executeCommissionDeletion({ actorUserId: USER_ID, identifier: SUBMISSION_ID, objectStore: store, sqlite }))
      .resolves.toMatchObject({ status: 'deleted' })
    expect(sqlite.prepare("SELECT result FROM audit_logs WHERE action='COMMISSION_DATA_DELETE'").all()).toEqual([{ result: 'SUCCESS' }])
  })

  it('allows expired claims to be recovered and fences their previous version', () => {
    seedSubmission()
    const first = claimCommissionDeletionTarget(sqlite, findCommissionDeletionTarget(sqlite, SUBMISSION_ID)!, NOW)!
    const other = openDatabase(resolve(directory, 'studio.db')).sqlite
    try {
      const claim = (now: number) => claimCommissionDeletionTarget(other, findCommissionDeletionTarget(other, 'DD-RETENTION01')!, now)
      expect(claim(NOW + COMMISSION_DELETION_LEASE_MS - 1)).toBeNull()
      const next = claim(NOW + COMMISSION_DELETION_LEASE_MS)!
      expect(next.version).toBe(first.version + 1)
      expect(renewCommissionDeletionLease(sqlite, first, NOW + COMMISSION_DELETION_LEASE_MS)).toBe(false)
      releaseCommissionDeletionLease(sqlite, first)
      expect(holdsCommissionDeletionLease(other, next, NOW + COMMISSION_DELETION_LEASE_MS)).toBe(true)
      const staleTarget = findCommissionDeletionTarget(sqlite, SUBMISSION_ID)!
      staleTarget.submission.version = first.version
      expect(() => deleteCommissionTargetRows(sqlite, staleTarget, {
        actorUserId: USER_ID, auditId: crypto.randomUUID(), deletedAt: NOW + COMMISSION_DELETION_LEASE_MS, submissionIdDigest: 'synthetic',
      })).toThrow('lease is no longer held')
      expect(sqlite.prepare('SELECT count(*) FROM commission_submissions').pluck().get()).toBe(1)
    }
    finally { other.close() }
  })

  it('renews a slow deletion and clears the heartbeat after completion', async () => {
    seedSubmission()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    let entered!: () => void
    let finish!: () => void
    const started = new Promise<void>(resolve => { entered = resolve })
    const barrier = new Promise<void>(resolve => { finish = resolve })
    const remove = store.deleteAll.bind(store)
    store.deleteAll = async (scope, key) => { entered(); await barrier; await remove(scope, key) }
    const deletion = executeCommissionDeletion({ actorUserId: USER_ID, identifier: SUBMISSION_ID, objectStore: store, sqlite })
    await started
    await vi.advanceTimersByTimeAsync(COMMISSION_DELETION_LEASE_MS + 1)
    const other = openDatabase(resolve(directory, 'studio.db')).sqlite
    try { expect(claimCommissionDeletionTarget(other, findCommissionDeletionTarget(other, 'DD-RETENTION01')!, Date.now())).toBeNull() }
    finally { other.close() }
    finish()
    await expect(deletion).resolves.toMatchObject({ status: 'deleted' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not write a failure audit when a stale process resumes after another owner completed', async () => {
    seedSubmission()
    let entered!: () => void
    let finish!: () => void
    const started = new Promise<void>(resolve => { entered = resolve })
    const barrier = new Promise<void>(resolve => { finish = resolve })
    const remove = store.deleteAll.bind(store)
    store.deleteAll = async (scope, key) => { entered(); await barrier; await remove(scope, key) }
    const deletion = executeCommissionDeletion({ actorUserId: USER_ID, identifier: SUBMISSION_ID, objectStore: store, sqlite })
    await started
    const other = openDatabase(resolve(directory, 'studio.db')).sqlite
    try {
      other.prepare('UPDATE commission_submissions SET deletion_lease_expires_at=? WHERE id=?').run(Date.now() - 1, SUBMISSION_ID)
      const target = findCommissionDeletionTarget(other, SUBMISSION_ID)!
      const next = claimCommissionDeletionTarget(other, target)!
      target.submission.version = next.version
      await remove('private', ORIGINAL_KEY)
      deleteCommissionTargetRows(other, target, {
        actorUserId: USER_ID, auditId: crypto.randomUUID(), deletedAt: Date.now(), submissionIdDigest: 'synthetic',
      })
      const rejected = expect(deletion).rejects.toMatchObject({ statusCode: 409, reason: 'COMMISSION_DELETE_IN_PROGRESS' })
      finish()
      await rejected
      expect(other.prepare("SELECT result FROM audit_logs WHERE action='COMMISSION_DATA_DELETE'").all()).toEqual([{ result: 'SUCCESS' }])
    }
    finally { finish(); other.close() }
  })

  it('fences edits by ID and another connection when deleting by receipt', async () => {
    seedSubmission()
    const other = openDatabase(resolve(directory, 'studio.db')).sqlite
    const remove = store.deleteAll.bind(store)
    store.deleteAll = async (scope, key) => {
      const change = { actorUserId: USER_ID, internalNote: null, status: 'accepted' as const }
      const version = findCommissionDeletionTarget(sqlite, SUBMISSION_ID)!.submission.version
      expect(() => updateCommissionSubmission(sqlite, SUBMISSION_ID, version, change)).toThrow()
      expect(updateCommissionSubmissionRow(other, SUBMISSION_ID, version, change, NOW)).toBe(0)
      const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
        import Database from 'better-sqlite3';
        import { updateCommissionSubmissionRow } from ${JSON.stringify(new URL('../../server/utils/repository/commission-repository.ts', import.meta.url).href)};
        const db = new Database(process.argv[1]);
        const changes = updateCommissionSubmissionRow(db, ${JSON.stringify(SUBMISSION_ID)}, ${version}, ${JSON.stringify(change)}, ${NOW});
        db.close(); process.stdout.write(String(changes));
      `, resolve(directory, 'studio.db')], { encoding: 'utf8', timeout: 10_000 })
      expect(child.status, child.stderr).toBe(0)
      expect(child.stdout).toBe('0')
      await remove(scope, key)
    }
    try {
      await expect(executeCommissionDeletion({ actorUserId: USER_ID, identifier: 'DD-RETENTION01', objectStore: store, sqlite }))
        .resolves.toMatchObject({ status: 'deleted' })
    }
    finally { other.close() }
  })

  it('rejects a changed inspection snapshot before deleting any object', async () => {
    seedSubmission()
    const inspect = store.inspect.bind(store)
    store.inspect = async (scope, key) => {
      updateCommissionSubmissionRow(sqlite, SUBMISSION_ID, 2,
        { actorUserId: USER_ID, internalNote: null, status: 'accepted' }, NOW)
      return inspect(scope, key)
    }
    await expect(executeCommissionDeletion({ actorUserId: USER_ID, identifier: SUBMISSION_ID, objectStore: store, sqlite }))
      .rejects.toMatchObject({ statusCode: 409 })
    expect((await inspect('private', ORIGINAL_KEY)).current).toBe(true)
    expect(sqlite.prepare('SELECT status FROM commission_submissions WHERE id=?').pluck().get(SUBMISSION_ID)).toBe('accepted')
  })

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
