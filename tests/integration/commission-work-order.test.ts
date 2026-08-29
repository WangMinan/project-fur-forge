import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { PDFDocument } from 'pdf-lib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSyntheticTransparentPng } from '../../scripts/oss-preflight-core.mjs'
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import {
  buildCommissionWorkOrderPdf,
  commissionWorkOrderFontFile,
} from '../../server/utils/service/commission-work-order'
import { FakeMediaStorage } from '../helpers/fake-media-storage'

const NOW = Date.UTC(2026, 7, 29)
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ASSET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SUBMISSION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-work-order-'))
  const databaseFile = resolve(directory, 'work-order.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()

  const image = createSyntheticTransparentPng()
  const objectKey = `test/commission/${ASSET_ID}.png`
  const digest = createHash('sha256').update(image).digest('hex')
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'pdf-admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size, mime_type,
      width, height, fit_mode, created_at, updated_at
    ) VALUES (?, 'commission_design_reference', 'READY', ?, ?, ?,
              'image/png', 160, 64, 'contain', ?, ?)
  `).run(ASSET_ID, objectKey, digest, image.length, NOW, NOW)
  sqlite.prepare(`
    INSERT INTO commission_submissions (
      id, receipt_code, nickname, species, phone_country_code, phone_number,
      qq, height_cm, weight_kg_tenths, design_asset_id, status, internal_note,
      handled_at, handled_by, version, created_at, updated_at
    ) VALUES (?, 'DD-PDFTEST01', '制作单测试', '犬科', '+86', '19900000000',
              '100001', 170, 605, ?, 'accepted', '注意核对角色配色',
              ?, ?, 2, ?, ?)
  `).run(SUBMISSION_ID, ASSET_ID, NOW, USER_ID, NOW - 1_000, NOW)
  storage.seedPrivate(objectKey, image, 'image/png', digest)
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('commission work order PDF', () => {
  it('loads the runtime font path and emits a two-page PDF', async () => {
    expect(commissionWorkOrderFontFile('production', '/app'))
      .toBe(resolve('/app/.output/public/fonts/noto-serif-sc-regular.otf'))
    expect(commissionWorkOrderFontFile('production', '/app', 'common'))
      .toBe(resolve('/app/.output/public/fonts/noto-serif-sc-work-order-common.otf'))

    const result = await buildCommissionWorkOrderPdf(sqlite, storage, SUBMISSION_ID)
    const pdf = await PDFDocument.load(result.content)
    expect(pdf.getPageCount()).toBe(2)
    expect(result.fontVariant).toBe('common')
    expect(result.content.length).toBeLessThan(3_000_000)
    expect(result.fileName).toBe('commission-work-order-DD-PDFTEST01.pdf')
  })

  it('falls back to the complete font for uncommon characters', async () => {
    sqlite.prepare(`
      UPDATE commission_submissions SET internal_note = ? WHERE id = ?
    `).run('生僻字兜底：\u9F98', SUBMISSION_ID)

    const result = await buildCommissionWorkOrderPdf(sqlite, storage, SUBMISSION_ID)
    const pdf = await PDFDocument.load(result.content)
    expect(pdf.getPageCount()).toBe(2)
    expect(result.fontVariant).toBe('full')
    expect(result.content.length).toBeGreaterThan(9_000_000)
  })
})
