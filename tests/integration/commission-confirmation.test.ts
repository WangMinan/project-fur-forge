import { createHash } from 'node:crypto'
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
import { createSyntheticSourcePng } from '../../scripts/oss-preflight-core.mjs'
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import {
  completeCommissionUpload,
  createCommissionSubmission,
  createCommissionUpload,
} from '../../server/utils/service/commission-management'
import type { CreateCommissionSubmissionRequest } from '../../shared/types/contracts'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const NOW = Date.UTC(2026, 7, 20)
const SESSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const TOKEN = 'a'.repeat(43)
const content = createSyntheticSourcePng(640, 480) as Buffer

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

const expected = {
  contentType: 'image/png' as const,
  byteSize: content.length,
  contentMd5: createHash('md5').update(content).digest('base64'),
  sha256: createHash('sha256').update(content).digest('hex'),
  width: 640,
  height: 480,
}

const validSubmission = {
  adultConfirmed: true,
  uploadSessionId: SESSION_ID,
  expectedUploadVersion: 3,
  nickname: '核心确认申请',
  species: '犬科',
  phone: { countryCode: '+86' as const, number: '19900000000' },
  privacyNoticeAcknowledged: true,
  qq: '100001',
  heightCm: 170,
  weightKg: 60.5,
}

async function seedCompletedUpload() {
  await createCommissionUpload(
    sqlite,
    storage,
    { appEnv: 'test' },
    expected,
    {
      id: SESSION_ID,
      keyPrefix: 'test/commission-confirmation',
      now: NOW,
      objectToken: 'c'.repeat(48),
      token: TOKEN,
    },
  )
  const key = storage.signedPuts.at(-1)?.objectKey
  if (!key) throw new Error('Signed upload key was not recorded.')
  storage.seedPrivate(key, content, 'image/png')
  await completeCommissionUpload(
    sqlite,
    storage,
    SESSION_ID,
    TOKEN,
    1,
    NOW + 1,
  )
}

function expectUploadUnconsumed() {
  expect(sqlite.prepare(`
    SELECT status FROM commission_upload_sessions WHERE id = ?
  `).pluck().get(SESSION_ID)).toBe('COMPLETED')
  expect(sqlite.prepare(`
    SELECT count(*) FROM commission_submissions
  `).pluck().get()).toBe(0)
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-confirmation-'))
  const databaseFile = resolve(directory, 'studio.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { recursive: true, force: true })
})

describe('commission confirmation core gate', () => {
  it('does not consume a completed upload when a confirmation is missing', async () => {
    await seedCompletedUpload()
    const { privacyNoticeAcknowledged: _missing, ...input } = validSubmission

    expect(() => createCommissionSubmission(
      sqlite,
      input as Omit<CreateCommissionSubmissionRequest, 'website'>,
      TOKEN,
      { now: NOW + 2 },
    )).toThrowError(expect.objectContaining({ statusCode: 400 }))
    expectUploadUnconsumed()
  })

  it('does not consume a completed upload when a confirmation is false', async () => {
    await seedCompletedUpload()

    expect(() => createCommissionSubmission(
      sqlite,
      { ...validSubmission, adultConfirmed: false as true },
      TOKEN,
      { now: NOW + 2 },
    )).toThrowError(expect.objectContaining({ statusCode: 400 }))
    expectUploadUnconsumed()
  })

  it('keeps the existing successful transaction when both confirmations are true', async () => {
    await seedCompletedUpload()

    expect(createCommissionSubmission(
      sqlite,
      validSubmission,
      TOKEN,
      {
        id: SESSION_ID,
        now: NOW + 2,
        receiptCode: () => 'DD-CONFIRMED',
      },
    )).toEqual({ receiptCode: 'DD-CONFIRMED' })
    expect(sqlite.prepare(`
      SELECT status FROM commission_upload_sessions WHERE id = ?
    `).pluck().get(SESSION_ID)).toBe('CONSUMED')
    expect(sqlite.prepare(`
      SELECT count(*) FROM commission_submissions
    `).pluck().get()).toBe(1)
  })

  it('does not create an upload session while the privacy policy is unready', async () => {
    sqlite.prepare(`
      UPDATE site_content
      SET privacy_policy = '本站不主动收集联系方式或角色设定图。'
      WHERE id = 'site'
    `).run()

    await expect(createCommissionUpload(
      sqlite,
      storage,
      { appEnv: 'test' },
      expected,
    )).rejects.toMatchObject({
      statusCode: 503,
      reason: 'COMMISSION_PRIVACY_POLICY_NOT_READY',
    })
    expect(storage.signedPuts).toHaveLength(0)
  })

  it('does not consume a completed upload if the policy becomes unready', async () => {
    await seedCompletedUpload()
    sqlite.prepare(`
      UPDATE site_content
      SET privacy_policy = '本站不主动收集联系方式或角色设定图。'
      WHERE id = 'site'
    `).run()

    expect(() => createCommissionSubmission(
      sqlite,
      validSubmission,
      TOKEN,
      { now: NOW + 2 },
    )).toThrowError(expect.objectContaining({
      statusCode: 503,
      reason: 'COMMISSION_PRIVACY_POLICY_NOT_READY',
    }))
    expectUploadUnconsumed()
  })
})
