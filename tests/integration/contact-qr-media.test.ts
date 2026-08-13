import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import {
  completeUploadSession,
  retryAssetProcessing,
} from '../../server/utils/service/media-completion'
import { getPublicSiteContent } from '../../server/utils/service/site-content'
import { createUploadSession } from '../../server/utils/service/upload-session'
import { createUploadSessionRequestSchema } from '../../shared/schemas/upload'
import { CONTACT_QR_PNG } from '../helpers/contact-qr-fixture'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ASSET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const NOW = Date.UTC(2026, 7, 12)

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

function contactContentVersion() {
  return (sqlite.prepare(`
    SELECT contact_content_version AS version
    FROM site_content
    WHERE id = 'site'
  `).get() as { version: number }).version
}

function digests(content: Buffer) {
  return {
    contentMd5: createHash('md5').update(content).digest('base64'),
    sha256: createHash('sha256').update(content).digest('hex'),
  }
}

function input(
  content: Buffer,
  width: number,
  height = width,
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/png',
) {
  return {
    owner: {
      type: 'site' as const,
      id: 'contact' as const,
      expectedVersion: contactContentVersion(),
    },
    mediaRole: 'contact_qr' as const,
    expected: {
      contentType,
      byteSize: content.length,
      ...digests(content),
      width,
      height,
    },
  }
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-contact-qr-'))
  const databaseFile = resolve(directory, 'contact-qr.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('T03 contact QR media', () => {
  it('publishes only a complete READY PNG derivative and retries failures', async () => {
    const content = CONTACT_QR_PNG
    expect(createUploadSessionRequestSchema.safeParse(input(content, 640)).success)
      .toBe(true)
    expect(createUploadSessionRequestSchema.safeParse(input(content, 640, 320)).success)
      .toBe(true)
    expect(createUploadSessionRequestSchema.safeParse(input(content, 200)).success)
      .toBe(true)
    expect(createUploadSessionRequestSchema.safeParse(input(content, 63)).success)
      .toBe(false)
    expect(createUploadSessionRequestSchema.safeParse({
      ...input(content, 640),
      expected: {
        ...input(content, 640).expected,
        byteSize: 20_000_001,
      },
    }).success).toBe(false)
    expect(createUploadSessionRequestSchema.safeParse(input(
      content,
      640,
      320,
      'image/jpeg',
    )).success).toBe(true)
    expect(createUploadSessionRequestSchema.safeParse(input(
      content,
      320,
      640,
      'image/webp',
    )).success).toBe(true)

    const created = await createUploadSession(
      sqlite,
      storage,
      { appEnv: 'test' },
      USER_ID,
      input(content, 640),
      {
        id: ASSET_ID,
        keyPrefix: 'test/contact-qr',
        now: NOW,
        objectToken: 'e'.repeat(48),
      },
    )
    const privateKey = storage.signedPuts.at(-1)!.objectKey
    storage.seedPrivate(privateKey, content, 'image/png')

    storage.failProcess = true
    const failed = await completeUploadSession(
      sqlite,
      storage,
      ASSET_ID,
      { expectedVersion: created.session.version, focalX: 0.5, focalY: 0.5 },
      NOW + 1,
    )
    expect(failed.asset).toMatchObject({
      role: 'contact_qr',
      status: 'FAILED',
      processingFailureCode: 'UPLOAD_DERIVATIVE_FAILURE',
      processingFailureStage: 'DERIVATIVE',
      previews: [{ usage: 'contact-qr', aspect: 'original', fitMode: 'contain' }],
    })
    expect(getPublicSiteContent(
      sqlite,
      'https://media.example.test',
      'test',
    ).contact.officialChannels).toEqual([])
    expect(storage.objects.has(privateKey)).toBe(true)

    storage.failProcess = false
    const retried = await retryAssetProcessing(
      sqlite,
      storage,
      ASSET_ID,
      failed.asset.version,
      NOW + 2,
    )
    expect(retried).toMatchObject({
      status: 'READY',
      processingFailureCode: null,
      processingFailureStage: null,
    })
    expect(storage.processCalls.map(call => call.process)).toEqual([
      'image/auto-orient,1/resize,m_lfit,w_320,h_320/format,png',
      'image/auto-orient,1/resize,m_lfit,w_640,h_640/format,png',
    ])
    expect(storage.processCalls.every(
      call => !call.process.includes('watermark') && !call.process.includes('m_fill'),
    )).toBe(true)
    for (const call of storage.processCalls) {
      const publicImage = await storage.getPublicAnonymous(call.objectKey)
      expect(publicImage.content.subarray(1, 4).toString('ascii')).toBe('PNG')
    }
    expect(storage.privatePuts).toHaveLength(1)
    expect(storage.privatePuts[0]?.content).not.toEqual(content)
    expect(storage.privatePuts[0]?.content.readUInt32BE(16)).toBe(640)
    expect(storage.privatePuts[0]?.content.readUInt32BE(20)).toBe(640)

    sqlite.prepare(`
      UPDATE site_content SET official_channels_json = ? WHERE id = 'site'
    `).run(JSON.stringify([
      { platform: 'qq', account: '3114559925', qrCodeAssetId: ASSET_ID },
      { platform: 'douyin', account: null, qrCodeAssetId: null },
      { platform: 'qq_group', account: null, qrCodeAssetId: null },
      { platform: 'xiaohongshu', account: null, qrCodeAssetId: null },
      { platform: 'bilibili', account: null, qrCodeAssetId: null },
    ]))
    const publicDto = getPublicSiteContent(
      sqlite,
      'https://media.example.test',
      'test',
    )
    expect(publicDto.contact.officialChannels).toHaveLength(1)
    expect(publicDto.contact.officialChannels[0]).toMatchObject({
      platform: 'qq',
      account: '3114559925',
      qrCodeSources: {
        webp: [],
        fallback: [
          { width: 320, height: 320, format: 'png' },
          { width: 640, height: 640, format: 'png' },
        ],
      },
    })
    const serialized = JSON.stringify(publicDto)
    expect(serialized).not.toContain('qrCodeAssetId')
    expect(serialized).not.toContain('/original/')
    expect(serialized).not.toContain('private-download')
    expect(serialized).not.toContain('x-oss-')
    expect(storage.processCalls.every(call => (
      /^test\/contact-qr\/web\/[^/]+\/contact-qr-v1\/contact-qr\/(320|640)\/[0-9a-f]{64}\.png$/u
        .test(call.objectKey)
    ))).toBe(true)
  })
})
