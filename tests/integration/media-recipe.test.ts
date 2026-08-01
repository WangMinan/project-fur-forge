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
import { createSyntheticWatermarkPng } from '../../scripts/oss-preflight-core.mjs'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import {
  CENTERED_WATERMARK_PROFILE,
  generatePublicVariants,
  PUBLIC_RECIPE_VERSION,
} from '../../server/utils/media-recipe'
import { FakeMediaStorage } from '../helpers/fake-media-storage'
import {
  insertActiveWatermarkProfile,
  TEST_WATERMARK_PROFILE_ID,
} from '../helpers/watermark-fixture'

const NOW = Date.UTC(2026, 7, 1)
const ASSET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

let directory: string
let sqlite: Database.Database
let storage: FakeMediaStorage

function sha256(content: Buffer) {
  return createHash('sha256').update(content).digest('hex')
}

function insertReadyAsset(options: {
  byteSize?: number
  id?: string
  objectKey?: string
  role?: 'studio_photo' | 'home_hero_landscape'
} = {}) {
  const content = createSyntheticWatermarkPng()
  const id = options.id ?? ASSET_ID
  const objectKey = options.objectKey
    ?? `test/t16-fixture/original/${id}/source.png`
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size, mime_type,
      width, height, focal_x, focal_y, watermark_anchor,
      created_at, updated_at
    ) VALUES (?, ?, 'READY', ?, ?, ?, 'image/png', 3200, 2400,
              0.2, 0.8, 'bottom-right', ?, ?)
  `).run(
    id,
    options.role ?? 'studio_photo',
    objectKey,
    sha256(content),
    options.byteSize ?? content.length,
    NOW,
    NOW,
  )
  storage.seedPrivate(objectKey, content, 'image/png', sha256(content), {
    fileSize: options.byteSize ?? content.length,
    format: 'png',
    height: 2_400,
    orientation: 1,
    width: 3_200,
  })
  return { content, id, objectKey }
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-recipe-'))
  const databaseFile = resolve(directory, 'recipe.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  storage = new FakeMediaStorage()
  insertActiveWatermarkProfile(sqlite, NOW, {
    environmentPrefix: 'test/t16-fixture',
  })
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('brand-centered-v2 public media generation', () => {
  it('generates only the role usages with OSS-baked watermark identity and is idempotent', async () => {
    insertReadyAsset()

    const first = await generatePublicVariants(
      sqlite,
      storage,
      ASSET_ID,
      undefined,
      NOW,
    )

    expect(first).toHaveLength(12)
    expect(new Set(first.map(variant => variant.usage))).toEqual(
      new Set(['work-card', 'detail']),
    )
    expect(new Set(first.map(variant => variant.format))).toEqual(
      new Set(['webp', 'png']),
    )
    expect(first.every(variant =>
      variant.recipeVersion === PUBLIC_RECIPE_VERSION
      && variant.watermarkProfile === CENTERED_WATERMARK_PROFILE
      && variant.watermarkProfileId === TEST_WATERMARK_PROFILE_ID
      && variant.watermarkAnchor === 'center'
      && variant.watermarkOpacityPercent === 50
      && variant.watermarkScalePercent === 60
      && /^[0-9a-f]{64}$/u.test(variant.logoDigest)
      && variant.objectKey.includes('/web/')
      && !variant.objectKey.includes('/original/'),
    )).toBe(true)
    expect(storage.processCalls).toHaveLength(12)
    expect(storage.processCalls.every((call) => {
      const encodedLogo = /\/watermark,image_([^,]+)/u.exec(call.process)?.[1]
      const width = Number(/\/recipe-v1\/[^/]+\/(\d+)\//u.exec(call.objectKey)?.[1])
      return encodedLogo
        && Buffer.from(encodedLogo, 'base64url').toString('utf8').endsWith(
          '?x-oss-process=image/resize,P_60',
        )
        && width > 0
        && call.process.includes(',t_50,g_center/')
        && !call.process.includes(',x_')
        && !call.process.includes(',y_')
        && call.sourceObjectKey.includes('/original/')
    })).toBe(true)

    const second = await generatePublicVariants(
      sqlite,
      storage,
      ASSET_ID,
      undefined,
      NOW + 1_000,
    )
    expect(second.map(variant => variant.id)).toEqual(
      first.map(variant => variant.id),
    )
    expect(storage.processCalls).toHaveLength(12)
  })

  it('uses the READY private preprocess as the only source above 20 MB', async () => {
    const source = insertReadyAsset({ byteSize: 25_000_000 })
    const preprocessContent = createSyntheticWatermarkPng()
    const preprocessId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const preprocessKey = `test/t16-fixture/processing/${ASSET_ID}/preprocess-v1/source.png`
    const preprocessSha = sha256(preprocessContent)
    storage.seedPrivate(preprocessKey, preprocessContent, 'image/png')
    sqlite.prepare(`
      INSERT INTO asset_variants (
        id, asset_id, storage_scope, status, object_key, input_sha256,
        media_role, usage, width, height, format, quality, crop_identity,
        recipe_version, watermark_profile, logo_digest, watermark_anchor,
        sha256, byte_size, created_at, updated_at
      ) VALUES (?, ?, 'PRIVATE', 'READY', ?, ?, 'studio_photo',
                'preprocess', 3200, 2400, 'png', 100, 'preprocess-v1',
                'preprocess-v1', 'none', 'none', 'none', ?, ?, ?, ?)
    `).run(
      preprocessId,
      ASSET_ID,
      preprocessKey,
      sha256(source.content),
      preprocessSha,
      preprocessContent.length,
      NOW,
      NOW,
    )

    const variants = await generatePublicVariants(
      sqlite,
      storage,
      ASSET_ID,
      ['detail'],
      NOW,
    )
    expect(variants).toHaveLength(6)
    expect(variants.every(variant =>
      variant.sourceVariantId === preprocessId
      && variant.inputSha256 === preprocessSha,
    )).toBe(true)
    expect(storage.processCalls.every(
      call => call.sourceObjectKey === preprocessKey,
    )).toBe(true)
  })

  it('uses a new deterministic key when the active profile changes', async () => {
    insertReadyAsset()
    const first = await generatePublicVariants(
      sqlite,
      storage,
      ASSET_ID,
      ['work-card'],
      NOW,
    )
    insertActiveWatermarkProfile(sqlite, NOW + 1_000, {
      environmentPrefix: 'test/t16-fixture',
      opacityPercent: 55,
      profileId: '77777777-7777-4777-8777-777777777777',
    })
    const second = await generatePublicVariants(
      sqlite,
      storage,
      ASSET_ID,
      ['work-card'],
      NOW + 1_000,
    )
    expect(new Set(second.map(variant => variant.objectKey))).not.toEqual(
      new Set(first.map(variant => variant.objectKey)),
    )
    expect(second.every(
      variant => variant.watermarkAnchor === 'center'
        && variant.watermarkOpacityPercent === 55,
    )).toBe(true)
  })

  it('cleans the exact deterministic public key when OSS processing fails', async () => {
    insertReadyAsset()
    storage.failProcess = true

    await expect(generatePublicVariants(
      sqlite,
      storage,
      ASSET_ID,
      ['detail'],
      NOW,
    )).rejects.toMatchObject({ statusCode: 500 })

    expect(storage.deletedPublicKeys).toHaveLength(1)
    expect(storage.deletedPublicKeys[0]).toMatch(
      /^test\/t16-fixture\/web\/[^/]+\/recipe-v1\/detail\/960\/[0-9a-f]{64}\.webp$/u,
    )
    expect(sqlite.prepare(`
      SELECT count(*) FROM asset_variants WHERE storage_scope = 'PUBLIC'
    `).pluck().get()).toBe(0)
  })

  it('uses the configured private logo across isolated test-run prefixes', async () => {
    insertReadyAsset({
      id: '66666666-6666-4666-8666-666666666666',
      objectKey: 'test/another-scope/original/source/source.png',
    })

    await expect(generatePublicVariants(
      sqlite,
      storage,
      '66666666-6666-4666-8666-666666666666',
      ['work-card'],
      NOW,
    )).resolves.toHaveLength(6)
  })
})
