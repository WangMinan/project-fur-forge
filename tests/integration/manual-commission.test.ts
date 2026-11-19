import { randomUUID, createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import { createManualCommission, manualCommissionConflicts, updateManualCommission } from '../../server/utils/service/manual-commission'
import { createCommissionUpload, completeCommissionUpload, cancelCommissionUpload, cleanupExpiredCommissionUploads, createCommissionSubmission } from '../../server/utils/service/commission-management'
import { enqueueCommissionEmails } from '../../server/utils/repository/commission-email'
import { getCommissionEmails, requestCommissionEmailRetry } from '../../server/utils/service/commission-email'
import { previewCommissionDeletion, executeCommissionDeletion } from '../../server/utils/service/commission-retention'
import { manualCommissionFieldsSchema } from '../../shared/schemas/manual-commission'
import { FakeMediaStorage } from '../helpers/fake-media-storage'
import { setExactObjectStoreForTesting } from '../../server/utils/exact-object-storage'
import { migrationsThrough } from '../helpers/migrations'

const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-manual-'))
let database: ReturnType<typeof openDatabase>
const actor = randomUUID()
const fields = () => ({
  nickname: '虚构补录测试', channel: 'qq' as const, channelLabel: null,
  species: null, phone: null, qq: String(100000 + Math.floor(Math.random() * 900000)), otherContact: null,
  heightCm: null, weightKg: null, originalAppliedOn: null, historicalHandledOn: null,
  status: 'pending' as const, internalNote: null, offlineAdultConfirmed: false, offlinePrivacyConfirmed: false,
})
const emptyStore = {
  inspect: async () => ({ current: false, versions: 0, deleteMarkers: 0, versionBytes: 0 }),
  deleteAll: async () => {},
}

beforeAll(async () => {
  const file = resolve(directory, 'studio.db')
  await migrateDatabase(file)
  database = openDatabase(file)
  database.sqlite.prepare(`INSERT INTO users (id, username, password_hash, password_changed_at, created_at, updated_at)
    VALUES (?, 'manual-test', 'hash', 1, 1, 1)`).run(actor)
})
afterAll(() => { setExactObjectStoreForTesting(undefined); database?.sqlite.close(); rmSync(directory, { recursive: true, force: true }) })

describe('manual commissions', () => {
  it('saves minimum fields once and never schedules email, including direct enqueue/retry', () => {
    const input = { requestId: randomUUID(), fields: fields() }
    const row = createManualCommission(database.sqlite, actor, input)
    expect(row).toMatchObject({ origin: 'manual', phone: null, designReferencePreviewHref: null, emailNotificationStatus: 'not_applicable' })
    expect(createManualCommission(database.sqlite, actor, input).id).toBe(row.id)
    expect(() => createManualCommission(database.sqlite, actor, { ...input, fields: { ...input.fields, nickname: '另一个意图' } })).toThrow()
    enqueueCommissionEmails(database.sqlite, row.id, true, Date.now())
    expect(getCommissionEmails(database.sqlite, row.id)).toMatchObject({ status: 'not_applicable', deliveries: [] })
    expect(() => requestCommissionEmailRetry(database.sqlite, row.id, randomUUID())).toThrow()
    expect(database.sqlite.prepare('SELECT count(*) FROM commission_email_notifications WHERE submission_id = ?').pluck().get(row.id)).toBe(0)
  })

  it('detects phone OR QQ across statuses, confirms a second application, and invalidates stale confirmation', () => {
    const f = { ...fields(), phone: { countryCode: '+86' as const, number: '19900000117' } }
    const first = createManualCommission(database.sqlite, actor, { requestId: randomUUID(), fields: f })
    const secondInput = { requestId: randomUUID(), fields: { ...fields(), phone: f.phone } }
    expect(() => createManualCommission(database.sqlite, actor, secondInput)).toThrow()
    const confirmation = manualCommissionConflicts(database.sqlite, actor, { phone: f.phone, qq: f.qq }).confirmation
    expect(() => createManualCommission(database.sqlite, actor, { ...secondInput, conflictConfirmation: confirmation })).toThrow()
    const matching = manualCommissionConflicts(database.sqlite, actor, { phone: f.phone, qq: secondInput.fields.qq })
    expect(matching.matches).toEqual([expect.objectContaining({ id: first.id, reasons: ['phone'] })])
    updateManualCommission(database.sqlite, actor, first.id, { expectedVersion: first.version, fields: { ...f, status: 'rejected' } })
    expect(() => createManualCommission(database.sqlite, actor, { ...secondInput, conflictConfirmation: matching.confirmation })).toThrow()
    const refreshed = manualCommissionConflicts(database.sqlite, actor, { phone: f.phone, qq: secondInput.fields.qq })
    const second = createManualCommission(database.sqlite, actor, { ...secondInput, conflictConfirmation: refreshed.confirmation })
    expect(second.id).not.toBe(first.id)
    const third = { requestId: randomUUID(), fields: { ...fields(), qq: f.qq } }
    expect(() => createManualCommission(database.sqlite, actor, third)).toThrow()
    const both = manualCommissionConflicts(database.sqlite, actor, { phone: f.phone, qq: f.qq })
    expect(both.matches).toHaveLength(2)
    const parallel = { requestId: randomUUID(), fields: { ...fields(), phone: f.phone } }
    const parallelConfirmation = manualCommissionConflicts(database.sqlite, actor, { phone: f.phone, qq: parallel.fields.qq })
    createManualCommission(database.sqlite, actor, { ...parallel, conflictConfirmation: parallelConfirmation.confirmation })
    expect(database.sqlite.prepare("SELECT count(*) FROM commission_submissions WHERE phone_number = ? AND status = 'pending'").pluck().get(f.phone.number)).toBe(2)
  })

  it('keeps dates separate, requires confirmations for acceptance, and permits missing measurements', () => {
    const f = { ...fields(), originalAppliedOn: '2025-01-01' }
    expect(manualCommissionFieldsSchema.safeParse({ ...f, status: 'accepted' }).success).toBe(false)
    expect(manualCommissionFieldsSchema.safeParse({ ...f, originalAppliedOn: '2999-01-01' }).success).toBe(false)
    expect(manualCommissionFieldsSchema.safeParse({ ...f, originalAppliedOn: '2025-02-30' }).success).toBe(false)
    const row = createManualCommission(database.sqlite, actor, { requestId: randomUUID(), fields: { ...f, status: 'accepted', offlineAdultConfirmed: true, offlinePrivacyConfirmed: true } })
    expect(row.originalAppliedOn).toBe('2025-01-01')
    expect(row.createdAt.slice(0, 4)).not.toBe('2025')
    expect(row.historicalHandledOn).toBeNull()
    expect(() => updateManualCommission(database.sqlite, actor, row.id, { expectedVersion: row.version - 1, fields: f })).toThrow()
  })

  it('deletes a rejected no-image record and fences old successful request replay', async () => {
    const input = { requestId: randomUUID(), fields: { ...fields(), status: 'rejected' } }
    const row = createManualCommission(database.sqlite, actor, input)
    const options = { sqlite: database.sqlite, objectStore: emptyStore, identifier: row.id, actorUserId: actor }
    expect(await previewCommissionDeletion(options)).toMatchObject({ status: 'ready', privateObjects: { keys: 0 } })
    expect(await executeCommissionDeletion(options)).toMatchObject({ status: 'deleted' })
    expect(() => createManualCommission(database.sqlite, actor, input)).toThrow('deleted')
    expect(database.sqlite.prepare('SELECT payload_hash, submission_id FROM commission_create_requests WHERE id = ?').get(input.requestId)).toEqual({ payload_hash: null, submission_id: null })
  })

  it('binds private uploads to an administrator and retires a removed image through recoverable cleanup', async () => {
    const storage = new FakeMediaStorage()
    // Synthetic PNG header; storage supplies image-info without invoking external services.
    const bytes = Buffer.alloc(32); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes); bytes.writeUInt32BE(64, 16); bytes.writeUInt32BE(64, 20)
    const expected = { contentType: 'image/png' as const, byteSize: bytes.length, width: 64, height: 64,
      contentMd5: createHash('md5').update(bytes).digest('base64'), sha256: createHash('sha256').update(bytes).digest('hex') }
    const now = Date.now()
    const created = await createCommissionUpload(database.sqlite, storage, { appEnv: 'test' }, expected, { actorUserId: actor, now })
    const key = storage.signedPuts.at(-1)!.objectKey
    storage.seedPrivate(key, bytes, 'image/png')
    await expect(completeCommissionUpload(database.sqlite, storage, created.session.uploadSessionId, created.token, created.session.version, now)).rejects.toThrow()
    await expect(completeCommissionUpload(database.sqlite, storage, created.session.uploadSessionId, created.token, created.session.version, now, randomUUID())).rejects.toThrow()
    const completed = await completeCommissionUpload(database.sqlite, storage, created.session.uploadSessionId, created.token, created.session.version, now, actor)
    const f = fields()
    const input = { requestId: randomUUID(), fields: f, upload: { id: completed.uploadSessionId, token: created.token, version: completed.version } }
    const row = createManualCommission(database.sqlite, actor, input, now)
    expect(createManualCommission(database.sqlite, actor, input, now).id).toBe(row.id)
    setExactObjectStoreForTesting({
      inspect: async (_scope, key) => ({ current: storage.objects.has(key), versions: 0, deleteMarkers: 0, versionBytes: 0 }),
      deleteAll: async (_scope, key) => { await storage.deletePrivate(key) },
    })
    const replacement = await createCommissionUpload(database.sqlite, storage, { appEnv: 'test' }, expected, { actorUserId: actor, now })
    storage.seedPrivate(storage.signedPuts.at(-1)!.objectKey, bytes, 'image/png')
    const replacementReady = await completeCommissionUpload(database.sqlite, storage, replacement.session.uploadSessionId, replacement.token, replacement.session.version, now, actor)
    const replacementInput = { fields: f, upload: { id: replacementReady.uploadSessionId, token: replacement.token, version: replacementReady.version } }
    expect(() => updateManualCommission(database.sqlite, actor, row.id, { ...replacementInput, expectedVersion: row.version + 1 }, now)).toThrow()
    expect(database.sqlite.prepare('SELECT design_asset_id FROM commission_submissions WHERE id = ?').pluck().get(row.id)).toBe(completed.assetId)
    expect(storage.objects.has(key)).toBe(true)
    const replaced = updateManualCommission(database.sqlite, actor, row.id, { ...replacementInput, expectedVersion: row.version }, now)
    expect(await cleanupExpiredCommissionUploads({ sqlite: database.sqlite, storage, now, dryRun: false })).toMatchObject({ deletedAssets: 1 })
    const updated = updateManualCommission(database.sqlite, actor, row.id, { expectedVersion: replaced.version, fields: f, upload: null }, now)
    expect(updated.designReferencePreviewHref).toBeNull()
    storage.failDelete = true
    expect(await cleanupExpiredCommissionUploads({ sqlite: database.sqlite, storage, now, dryRun: false })).toMatchObject({ failed: 1 })
    storage.failDelete = false
    setExactObjectStoreForTesting({
      inspect: async () => ({ current: false, versions: 1, deleteMarkers: 0, versionBytes: 32 }),
      deleteAll: async (_scope, key) => { await storage.deletePrivate(key) },
    })
    expect(await cleanupExpiredCommissionUploads({ sqlite: database.sqlite, storage, now, dryRun: false })).toMatchObject({ failed: 1 })
    setExactObjectStoreForTesting({
      inspect: async (_scope, key) => ({ current: storage.objects.has(key), versions: 0, deleteMarkers: 0, versionBytes: 0 }),
      deleteAll: async (_scope, key) => { await storage.deletePrivate(key) },
    })
    expect(await cleanupExpiredCommissionUploads({ sqlite: database.sqlite, storage, now, dryRun: false })).toMatchObject({ deletedAssets: 1 })
    expect(database.sqlite.pragma('foreign_key_check')).toEqual([])
    const unused = await createCommissionUpload(database.sqlite, storage, { appEnv: 'test' }, expected, { actorUserId: actor, now })
    storage.seedPrivate(storage.signedPuts.at(-1)!.objectKey, bytes, 'image/png')
    const unusedReady = await completeCommissionUpload(database.sqlite, storage, unused.session.uploadSessionId, unused.token, unused.session.version, now, actor)
    const cancelled = await cancelCommissionUpload(database.sqlite, storage, unusedReady.uploadSessionId, unused.token, unusedReady.version, now, actor)
    expect(cancelled.status).toBe('CANCELLED')
    expect(database.sqlite.prepare('SELECT id FROM assets WHERE id = ?').get(unusedReady.assetId)).toBeUndefined()
    expect((await cancelCommissionUpload(database.sqlite, storage, unusedReady.uploadSessionId, unused.token, unusedReady.version, now, actor)).status).toBe('CANCELLED')
  })

  it('preserves a legacy application, image and email delivery when upgrading the previous schema', async () => {
    const file = resolve(directory, 'legacy.db')
    await migrateDatabase(file, { migrationsFolder: migrationsThrough(file, '0057_r13_adoption_artist') })
    const before = openDatabase(file)
    const id = randomUUID()
    const mailId = randomUUID()
    try {
      before.sqlite.prepare(`INSERT INTO assets (id, role, status, private_object_key, sha256, byte_size, mime_type, width, height, fit_mode, created_at, updated_at)
        VALUES (?, 'commission_design_reference', 'READY', ?, ?, 128, 'image/png', 64, 64, 'contain', 123, 123)`)
        .run(id, `test/legacy/${id}.png`, 'a'.repeat(64))
      before.sqlite.prepare(`INSERT INTO commission_submissions (id, receipt_code, nickname, phone_number, qq, height_cm, weight_kg_tenths, design_asset_id, created_at, updated_at, email_notification_policy)
        VALUES (?, 'DD-LEGACY117', '虚构旧申请', '19900000118', '88001188', 170, 600, ?, 123, 456, 'enabled')`).run(id, id)
      before.sqlite.prepare(`INSERT INTO commission_email_notifications (id, submission_id, recipient, next_attempt_at, created_at, updated_at, status, sent_at)
        VALUES (?, ?, 'fixture@example.test', 123, 123, 456, 'sent', 456)`).run(mailId, id)
    }
    finally { before.sqlite.close() }
    await migrateDatabase(file)
    const after = openDatabase(file)
    try {
      expect(after.sqlite.prepare('SELECT receipt_code, origin, design_asset_id, created_at, updated_at FROM commission_submissions WHERE id = ?').get(id))
        .toEqual({ receipt_code: 'DD-LEGACY117', origin: 'website', design_asset_id: id, created_at: 123, updated_at: 456 })
      expect(after.sqlite.prepare('SELECT status, sent_at FROM commission_email_notifications WHERE id = ?').get(mailId)).toEqual({ status: 'sent', sent_at: 456 })
      expect(after.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(after.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
      expect(() => after.sqlite.prepare('UPDATE commission_submissions SET design_asset_id = NULL WHERE id = ?').run(id)).toThrow()
      expect(() => after.sqlite.prepare("UPDATE commission_submissions SET origin = 'manual' WHERE id = ?").run(id)).toThrow()
    }
    finally { after.sqlite.close() }
  })

  it('keeps public pending-phone rejection when a manual application exists, and rejects admin upload consumption by visitors', async () => {
    const phone = { countryCode: '+86' as const, number: '19900000119' }
    createManualCommission(database.sqlite, actor, { requestId: randomUUID(), fields: { ...fields(), phone } })
    const storage = new FakeMediaStorage()
    const bytes = Buffer.alloc(32); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes); bytes.writeUInt32BE(64, 16); bytes.writeUInt32BE(64, 20)
    const expected = { contentType: 'image/png' as const, byteSize: bytes.length, width: 64, height: 64,
      contentMd5: createHash('md5').update(bytes).digest('base64'), sha256: createHash('sha256').update(bytes).digest('hex') }
    const created = await createCommissionUpload(database.sqlite, storage, { appEnv: 'test' }, expected)
    storage.seedPrivate(storage.signedPuts.at(-1)!.objectKey, bytes, 'image/png')
    const completed = await completeCommissionUpload(database.sqlite, storage, created.session.uploadSessionId, created.token, created.session.version)
    const input = { adultConfirmed: true as const, privacyNoticeAcknowledged: true as const, nickname: '虚构官网投递', species: '犬',
      phone, qq: '88001199', heightCm: 170, weightKg: 60, uploadSessionId: completed.uploadSessionId, expectedUploadVersion: completed.version }
    expect(() => createCommissionSubmission(database.sqlite, input, created.token)).toThrow('pending')
    const manual = await createCommissionUpload(database.sqlite, storage, { appEnv: 'test' }, expected, { actorUserId: actor })
    expect(() => createCommissionSubmission(database.sqlite, { ...input, uploadSessionId: manual.session.uploadSessionId, expectedUploadVersion: manual.session.version }, manual.token)).toThrow('not found')
  })
})
