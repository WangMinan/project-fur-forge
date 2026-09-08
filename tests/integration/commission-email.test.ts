import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSyntheticSourcePng } from '../../scripts/oss-preflight-core.mjs'
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import { loadRuntimeConfig } from '../../server/utils/runtime-config'
import { smtpConfiguration } from '../../server/utils/smtp-config'
import { completeCommissionUpload, createCommissionSubmission, createCommissionUpload } from '../../server/utils/service/commission-management'
import {
  beginCommissionEmailTransmission, cancelRemovedCommissionEmails, claimCommissionEmail,
  commissionEmailRows, commissionEmailSummary, commissionRecipients,
  fenceCommissionEmailsForDeletion, retryCommissionEmail, renewCommissionEmailLease,
} from '../../server/utils/repository/commission-email'
import { deliverNextCommissionEmail, smtpFailure } from '../../server/utils/runner/commission-email'
import { commissionRecipientsSchema } from '../../shared/schemas/commission-email'
import { getPublicSiteContent } from '../../server/utils/service/site-content'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const NOW = Date.UTC(2026, 8, 6)
const ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const TOKEN = 'a'.repeat(43)
const content = createSyntheticSourcePng(640, 480) as Buffer
const input = {
  adultConfirmed: true as const, privacyNoticeAcknowledged: true as const,
  uploadSessionId: ID, expectedUploadVersion: 3,
  nickname: '测试委托', species: '犬科', phone: { countryCode: '+86' as const, number: '19900000000' },
  qq: '100001', heightCm: 170, weightKg: 60.5,
}
const config = loadRuntimeConfig({ env: {
  APP_ENV: 'test', PUBLIC_BASE_URL: 'https://public.test.invalid', ADMIN_BASE_URL: 'https://admin.test.invalid',
  MEDIA_BASE_URL: 'https://media.test.invalid', OSS_UPLOAD_BASE_URL: 'https://upload.test.invalid',
  SMTP_ENABLED: 'true', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_SECURE: 'true',
  SMTP_USER: 'sender@example.com', SMTP_FROM: 'sender@example.com', SMTP_PASSWORD: 'test-only-password',
} })
let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage
let now: number
function setRecipients(recipients: string[]) {
  sqlite.prepare('UPDATE site_content SET commission_notification_recipients_json = ?').run(JSON.stringify(recipients))
  cancelRemovedCommissionEmails(sqlite, now)
}
async function seed(enabled = true) {
  await createCommissionUpload(sqlite, storage, { appEnv: 'test' }, {
    contentType: 'image/png', byteSize: content.length,
    contentMd5: createHash('md5').update(content).digest('base64'), sha256: createHash('sha256').update(content).digest('hex'),
    width: 640, height: 480,
  }, { id: ID, keyPrefix: 'test/mail', now: NOW, objectToken: 'c'.repeat(48), token: TOKEN })
  storage.seedPrivate(storage.signedPuts.at(-1)!.objectKey, content, 'image/png')
  await completeCommissionUpload(sqlite, storage, ID, TOKEN, 1, NOW + 1)
  return createCommissionSubmission(sqlite, input, TOKEN, { id: ID, now: NOW + 2, notificationsEnabled: enabled })
}
function deliver(send = vi.fn().mockResolvedValue(undefined)) {
  return deliverNextCommissionEmail({ sqlite, storage, config, send, now: () => now })
}
beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-email-'))
  const file = resolve(directory, 'studio.db')
  await migrateDatabase(file)
  sqlite = openDatabase(file).sqlite
  storage = new FakeMediaStorage()
  now = NOW + 10
  setRecipients(['one@example.com', 'two@example.com'])
})
afterEach(() => { vi.restoreAllMocks(); sqlite.close(); rmSync(directory, { recursive: true, force: true }) })

describe('commission email contract', () => {
  it('validates SMTP without taking the application down, including TLS modes and disabled values', () => {
    expect(smtpConfiguration(config).status).toBe('ready')
    expect(smtpConfiguration({ ...config, smtpPort: '587' }).status).toBe('invalid')
    expect(smtpConfiguration({ ...config, smtpPort: '587', smtpSecure: 'false' }).status).toBe('ready')
    for (const smtpEnabled of [false, 'false', undefined]) expect(smtpConfiguration({ smtpEnabled }).status).toBe('disabled')
    expect(smtpConfiguration({ ...config, smtpPassword: undefined }).status).toBe('invalid')
    expect(smtpConfiguration({ ...config, smtpFrom: 'other@example.com' }).status).toBe('invalid')
    expect(smtpFailure({ responseCode: 552 })).toEqual({ code: 'TOO_LARGE', temporary: false })
    expect(smtpFailure({ code: 'EAUTH', response: 'secret' })).toEqual({ code: 'AUTH', temporary: false })
  })

  it('keeps an editable unbounded list private, normalizes QQ addresses, and preserves an empty list after migration', async () => {
    expect(commissionRecipientsSchema.parse([' Test@QQ.COM '])).toEqual(['test@qq.com'])
    expect(commissionRecipientsSchema.safeParse(['Test@qq.com', 'test@QQ.com']).success).toBe(false)
    for (const value of ['bad', 'x@example.com\r\nBcc:evil@example.com', '']) {
      expect(commissionRecipientsSchema.safeParse([value]).success).toBe(false)
    }
    const before = getPublicSiteContent(sqlite, config.mediaBaseUrl, 'test')
    setRecipients(['one@example.com', 'two@example.com', 'three@example.com'])
    expect(commissionRecipients(sqlite)).toHaveLength(3)
    expect(getPublicSiteContent(sqlite, config.mediaBaseUrl, 'test')).toEqual(before)
    setRecipients([])
    await migrateDatabase(resolve(directory, 'studio.db'))
    expect(commissionRecipients(sqlite)).toEqual([])
    expect(JSON.stringify(before)).not.toContain('commissionNotificationRecipients')
  })

  it('saves one submission and one notification per recipient atomically, keeping the public receipt unchanged', async () => {
    const receipt = await seed()
    expect(Object.keys(receipt)).toEqual(['receiptCode'])
    expect(commissionEmailRows(sqlite, ID)).toHaveLength(2)
    expect(() => createCommissionSubmission(sqlite, input, TOKEN, { now, notificationsEnabled: true })).toThrow()
    expect(commissionEmailRows(sqlite, ID)).toHaveLength(2)
    const send = vi.fn().mockResolvedValue(undefined)
    await deliver(send)
    const mail = send.mock.calls[0]![0]
    expect(mail.to).toBe('one@example.com')
    expect(mail.text).toContain('60.5 kg')
    expect(mail.text).toContain('170 cm')
    expect(mail.text).toContain('北京时间')
    expect(mail.text).toContain(`${config.adminBaseUrl}/admin/commissions/${ID}`)
    expect(mail.text).toContain('+86 19900000000')
    expect(mail.attachments[0].content).toEqual(content)
    expect(mail.attachments[0].contentType).toBe('image/png')
    expect(JSON.stringify(mail)).not.toContain(storage.signedPuts[0]!.objectKey)
    expect(commissionEmailSummary(sqlite, ID)).toBe('partial')
    await deliver(send)
    expect(commissionEmailSummary(sqlite, ID)).toBe('sent')
    expect(await deliver(send)).toBe(false)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('rolls back the submission and upload consumption when notification persistence fails', async () => {
    sqlite.exec(`CREATE TRIGGER fail_mail BEFORE INSERT ON commission_email_notifications BEGIN SELECT RAISE(ABORT, 'test rollback'); END`)
    await expect(seed()).rejects.toThrow()
    expect(sqlite.prepare('SELECT count(*) FROM commission_submissions').pluck().get()).toBe(0)
    expect(sqlite.prepare('SELECT status FROM commission_upload_sessions WHERE id = ?').pluck().get(ID)).toBe('COMPLETED')
  })

  it('records disabled and empty-recipient submissions without retrospective delivery', async () => {
    await seed(false)
    expect(commissionEmailSummary(sqlite, ID)).toBe('disabled')
    expect(await deliver()).toBe(false)
    sqlite.prepare("UPDATE commission_submissions SET email_notification_policy = 'unconfigured' WHERE id = ?").run(ID)
    setRecipients([])
    expect(commissionEmailSummary(sqlite, ID)).toBe('unconfigured')
    setRecipients(['new@example.com'])
    expect(await deliver()).toBe(false)
  })

  it('retries transient failures with a bound and never resends successful recipients', async () => {
    await seed()
    const send = vi.fn().mockRejectedValueOnce({ responseCode: 451, response: 'private SMTP error' }).mockResolvedValue(undefined)
    await deliver(send)
    await deliver(send)
    expect(commissionEmailRows(sqlite, ID).map(row => row.status)).toEqual(['pending', 'sent'])
    expect(await deliver(send)).toBe(false)
    now += 60_000
    await deliver(send)
    expect(send.mock.calls.map(call => call[0].to)).toEqual(['one@example.com', 'two@example.com', 'one@example.com'])
    expect(commissionEmailSummary(sqlite, ID)).toBe('sent')
    expect(() => retryCommissionEmail(sqlite, ID, commissionEmailRows(sqlite, ID)[0]!.id, now)).toThrow()
  })

  it('stops permanent failures and caps attachment retries without sending incomplete mail', async () => {
    setRecipients(['one@example.com'])
    await seed()
    const send = vi.fn().mockRejectedValue({ code: 'EAUTH', response: 'secret' })
    await deliver(send)
    expect(commissionEmailRows(sqlite, ID)[0]).toMatchObject({ status: 'failed', last_error_code: 'AUTH' })
    const id = commissionEmailRows(sqlite, ID)[0]!.id
    retryCommissionEmail(sqlite, ID, id, now)
    storage.failGet = true
    for (let i = 0; i < 2; i++) { await deliver(send); now += 60_000 }
    expect(commissionEmailRows(sqlite, ID)[0]).toMatchObject({ status: 'failed', attempt_count: 2, last_error_code: 'ATTACHMENT' })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('recovers an expired lease on a new database connection and fences concurrent claims', async () => {
    setRecipients(['one@example.com'])
    await seed()
    const row = claimCommissionEmail(sqlite, now)!
    // A claimed task that has not started SMTP can safely be recovered.
    const other = openDatabase(resolve(directory, 'studio.db')).sqlite
    try {
      expect(claimCommissionEmail(other, now)).toBeNull()
      renewCommissionEmailLease(sqlite, row, now + 100_000)
      expect(claimCommissionEmail(other, now + 180_001)).toBeNull()
      now += 280_001
      const recovered = claimCommissionEmail(other, now)!
      expect(recovered.id).toBe(row.id)
      expect(recovered.lease_token).not.toBe(row.lease_token)
      expect(beginCommissionEmailTransmission(sqlite, row, now)).toBe(false)
      expect(beginCommissionEmailTransmission(other, recovered, now)).toBe(true)
    }
    finally { other.close() }
  })

  it('stops after two attempts and does not claim old pending rows above the new cap', async () => {
    setRecipients(['one@example.com'])
    await seed()
    const send = vi.fn().mockRejectedValue({ code: 'ETIMEDOUT' })
    await deliver(send)
    now += 59_999
    expect(await deliver(send)).toBe(false)
    now++
    await deliver(send)
    expect(commissionEmailRows(sqlite, ID)[0]).toMatchObject({ status: 'failed', attempt_count: 2 })
    sqlite.prepare("UPDATE commission_email_notifications SET status = 'pending', next_attempt_at = ?").run(now)
    expect(await deliver(send)).toBe(false)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('requires manual verification after an expired transmitting lease, even before the attempt cap', async () => {
    setRecipients(['one@example.com'])
    await seed()
    const row = claimCommissionEmail(sqlite, now)!
    expect(beginCommissionEmailTransmission(sqlite, row, now)).toBe(true)
    now += 180_001
    expect(claimCommissionEmail(sqlite, now)).toBeNull()
    expect(commissionEmailRows(sqlite, ID)[0]).toMatchObject({ status: 'failed', attempt_count: 1, last_error_code: 'UNKNOWN' })
    retryCommissionEmail(sqlite, ID, row.id, now)
    expect(await deliver()).toBe(true)
    expect(commissionEmailSummary(sqlite, ID)).toBe('sent')
  })

  it('cancels a hanging transmission immediately and never resumes it automatically', async () => {
    setRecipients(['one@example.com'])
    await seed()
    const stop = new AbortController()
    const started = Promise.withResolvers<undefined>()
    const send = vi.fn(() => { started.resolve(undefined); return new Promise(() => {}) })
    const running = deliverNextCommissionEmail({ sqlite, storage, config, send, signal: stop.signal, now: () => now })
    await started.promise
    stop.abort()
    await running
    expect(commissionEmailRows(sqlite, ID)[0]).toMatchObject({ status: 'failed', last_error_code: 'UNKNOWN' })
    expect(await deliverNextCommissionEmail({ sqlite, storage, config, send, signal: stop.signal })).toBe(false)
    now += 600_000
    expect(await deliver(send)).toBe(false)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('cancels an attachment wait without sending later when the read completes', async () => {
    setRecipients(['one@example.com'])
    await seed()
    const pending = Promise.withResolvers<Buffer>()
    vi.spyOn(storage, 'getPrivate').mockReturnValue(pending.promise)
    const send = vi.fn()
    const stop = new AbortController()
    const running = deliverNextCommissionEmail({ sqlite, storage, config, send, signal: stop.signal, now: () => now })
    stop.abort()
    await running
    pending.resolve(content)
    await Promise.resolve()
    expect(send).not.toHaveBeenCalled()
    expect(commissionEmailRows(sqlite, ID)[0]).toMatchObject({ status: 'pending', transmitting_at: null })
  })

  it('cancels removed recipients including a claimed task, and never revives it on re-add', async () => {
    await seed()
    const row = claimCommissionEmail(sqlite, now)!
    setRecipients([])
    expect(beginCommissionEmailTransmission(sqlite, row, now)).toBe(false)
    expect(commissionEmailSummary(sqlite, ID)).toBe('cancelled')
    setRecipients(['one@example.com'])
    expect(await deliver()).toBe(false)
  })

  it('fences deletion across connections, blocks an active transmission and cascades mail rows', async () => {
    await seed()
    const row = claimCommissionEmail(sqlite, now)!
    expect(beginCommissionEmailTransmission(sqlite, row, now)).toBe(true)
    expect(() => fenceCommissionEmailsForDeletion(sqlite, ID, now)).toThrow()
    now += 180_001
    fenceCommissionEmailsForDeletion(sqlite, ID, now)
    expect(beginCommissionEmailTransmission(sqlite, row, now)).toBe(false)
    expect(await deliver()).toBe(false)
    sqlite.prepare('DELETE FROM commission_submissions WHERE id = ?').run(ID)
    expect(commissionEmailRows(sqlite, ID)).toEqual([])
  })
})
