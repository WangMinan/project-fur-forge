import Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeContactQrLink,
  resolveContactQrLink,
} from '../../server/utils/recipe/contact-qr-link'
import { updateContactContentRequestSchema } from '../../shared/schemas/site-content'

const databases: Database.Database[] = []

function databaseWithAsset() {
  const sqlite = new Database(':memory:')
  databases.push(sqlite)
  sqlite.exec(`
    CREATE TABLE assets (
      id TEXT PRIMARY KEY,
      private_object_key TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL
    );
    INSERT INTO assets (id, private_object_key, role, status)
    VALUES ('asset-1', 'private/contact/qq.png', 'contact_qr', 'READY');
  `)
  return sqlite
}

afterEach(() => {
  databases.splice(0).forEach(database => database.close())
})

describe('contact QR link derivation', () => {
  it('accepts only exact HTTPS qm.qq.com short links', () => {
    expect(normalizeContactQrLink(' https://qm.qq.com/q/Abc123 '))
      .toBe('https://qm.qq.com/q/Abc123')
    for (const value of [
      'http://qm.qq.com/q/Abc123',
      'https://example.com/q/Abc123',
      'https://qm.qq.com/q/Abc123?next=https://example.com',
      'javascript:alert(1)',
      'not a URL',
    ]) {
      expect(normalizeContactQrLink(value)).toBeNull()
    }
  })

  it('does not accept a client-supplied derived link', () => {
    const request = {
      expectedVersion: 1,
      payload: {
        email: 'hello@example.com',
        officialChannels: [
          {
            platform: 'qq',
            account: '765678159',
            qrCodeAssetId: '00000000-0000-4000-8000-000000000001',
            qrLinkUrl: 'https://qm.qq.com/q/ClientValue',
          },
          {
            platform: 'qq_group',
            account: '1040925427',
            qrCodeAssetId: '00000000-0000-4000-8000-000000000002',
          },
        ],
        antiScam: null,
      },
    }
    expect(updateContactContentRequestSchema.safeParse(request).success).toBe(false)
    delete (request.payload.officialChannels[0] as {
      qrLinkUrl?: string
    }).qrLinkUrl
    expect(updateContactContentRequestSchema.safeParse(request).success).toBe(true)
  })

  it('reuses an unchanged asset result including null', async () => {
    const sqlite = databaseWithAsset()
    const readPrivate = vi.fn(async () => Buffer.from('unused'))
    await expect(resolveContactQrLink(
      sqlite,
      { qrCodeAssetId: 'asset-1' },
      { qrCodeAssetId: 'asset-1', qrLinkUrl: null },
      { readPrivate },
    )).resolves.toBeNull()
    expect(readPrivate).not.toHaveBeenCalled()
  })

  it('reads a changed READY contact QR once and stores only a validated link', async () => {
    const sqlite = databaseWithAsset()
    const readPrivate = vi.fn(async () => Buffer.from('image'))
    const decode = vi.fn(async () => 'https://qm.qq.com/q/Join1234')
    await expect(resolveContactQrLink(
      sqlite,
      { qrCodeAssetId: 'asset-1' },
      undefined,
      { decode, readPrivate },
    )).resolves.toBe('https://qm.qq.com/q/Join1234')
    expect(readPrivate).toHaveBeenCalledOnce()
    expect(decode).toHaveBeenCalledOnce()

    await expect(resolveContactQrLink(
      sqlite,
      { qrCodeAssetId: 'asset-1' },
      undefined,
      { decode: async () => 'https://example.com/not-qq', readPrivate },
    )).resolves.toBeNull()
  })
})
