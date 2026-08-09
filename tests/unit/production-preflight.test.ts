import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertProductionTestObject,
  buildExactPurgeInput,
  createProductionPreflightRunId,
  evaluateDerivativeInventory,
  evaluateLifecycleRules,
  evaluateStrictCorsRules,
  exactEsaMediaUrl,
  EXPECTED_PRIVATE_BUCKET,
  EXPECTED_PUBLIC_BUCKET,
  productionPreflightPrefix,
  REQUIRED_PUT_HEADERS,
  validateProductionPreflightConfig,
} from '../../scripts/production-preflight-core.mjs'

const temporaryDirectories: string[] = []

function temporaryDirectory() {
  const directory = mkdtempSync(resolve(tmpdir(), 'fur-preflight-'))
  temporaryDirectories.push(directory)
  return directory
}

function validConfig(databaseFile = resolve(temporaryDirectory(), 'production.db')) {
  return {
    appEnv: 'production',
    databaseFile,
    publicBaseUrl: 'https://ditedog.com',
    adminBaseUrl: 'https://admin.ditedog.com',
    mediaBaseUrl: 'https://public-media.ditedog.com',
    uploadBaseUrl:
      'https://project-furry-forge-private.oss-cn-hangzhou.aliyuncs.com',
    region: 'oss-cn-hangzhou',
    endpoint: 'https://oss-cn-hangzhou-internal.aliyuncs.com',
    privateBucket: EXPECTED_PRIVATE_BUCKET,
    publicBucket: EXPECTED_PUBLIC_BUCKET,
    accessKeyId: 'unit-oss-access-key',
    accessKeySecret: 'unit-oss-secret-value',
    esaSiteId: '171890925863148',
    esaAccessKeyId: 'unit-esa-access-key',
    esaAccessKeySecret: 'unit-esa-secret-value',
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('T52-E2 production preflight contract', () => {
  it('locks the production OSS, upload, media, and ESA boundaries', () => {
    expect(validateProductionPreflightConfig(validConfig())).toMatchObject({
      appEnv: 'production',
      mediaBaseUrl: 'https://public-media.ditedog.com',
      endpoint: 'https://oss-cn-hangzhou-internal.aliyuncs.com',
      privateBucket: EXPECTED_PRIVATE_BUCKET,
      publicBucket: EXPECTED_PUBLIC_BUCKET,
    })

    expect(() => validateProductionPreflightConfig({
      ...validConfig(),
      endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
    })).toThrow(expect.objectContaining({
      code: 'wrong-oss-service-endpoint',
      message: expect.stringMatching(/internal service endpoint/u),
    }))
    expect(() => validateProductionPreflightConfig({
      ...validConfig(),
      uploadBaseUrl:
        'https://project-furry-forge-private.oss-cn-hangzhou-internal.aliyuncs.com',
    })).toThrow(/public origin/u)
    expect(() => validateProductionPreflightConfig({
      ...validConfig(),
      esaAccessKeyId: 'unit-oss-access-key',
    })).toThrow(/distinct RAM/u)
    expect(() => validateProductionPreflightConfig({
      ...validConfig(),
      adminBaseUrl: 'https://admin.example.test',
    })).toThrow(/placeholder/u)
  })

  it('uses an exact recoverable test scope', () => {
    const runId = createProductionPreflightRunId(
      new Date('2026-08-09T12:34:56.000Z'),
      Buffer.from('01020304', 'hex'),
    )
    const prefix = productionPreflightPrefix(runId)

    expect(runId).toBe('t52e2-20260809T123456Z-01020304')
    expect(prefix).toBe('prod/preflight/t52e2-20260809T123456Z-01020304/')
    expect(() => assertProductionTestObject({
      bucket: EXPECTED_PRIVATE_BUCKET,
      key: `${prefix}private/source.png`,
      prefix,
    })).not.toThrow()
    expect(() => assertProductionTestObject({
      bucket: EXPECTED_PUBLIC_BUCKET,
      key: 'prod/web/preflight/t52e2-20260809T123456Z-01020304/output.webp',
      prefix,
    })).not.toThrow()
    expect(() => assertProductionTestObject({
      bucket: EXPECTED_PUBLIC_BUCKET,
      key: 'prod/web/another-run/output.webp',
      prefix,
    })).toThrow(/exact/u)
  })

  it('requires one exact CORS rule for the administrator PUT surface', () => {
    const origin = 'https://admin.ditedog.com'
    expect(evaluateStrictCorsRules([{
      allowedOrigin: origin,
      allowedMethod: ['PUT'],
      allowedHeader: REQUIRED_PUT_HEADERS,
    }], origin)).toMatchObject({ safe: true, ruleCount: 1 })
    expect(evaluateStrictCorsRules([{
      allowedOrigin: '*',
      allowedMethod: ['PUT'],
      allowedHeader: ['*'],
    }], origin).safe).toBe(false)
    expect(evaluateStrictCorsRules([{
      allowedOrigin: origin,
      allowedMethod: ['GET', 'PUT'],
      allowedHeader: REQUIRED_PUT_HEADERS,
    }], origin).safe).toBe(false)
  })

  it('rejects destructive lifecycle rules over durable production objects', () => {
    expect(evaluateLifecycleRules([{
      prefix: 'test/',
      expiration: { days: 7 },
      status: 'Enabled',
    }], EXPECTED_PRIVATE_BUCKET).safe).toBe(true)
    expect(evaluateLifecycleRules([{
      prefix: '',
      expiration: { days: 30 },
      status: 'Enabled',
    }], EXPECTED_PRIVATE_BUCKET)).toMatchObject({
      safe: false,
      unsafeRuleCount: 1,
    })
    expect(evaluateLifecycleRules([{
      prefix: 'prod/web/',
      expiration: { days: 30 },
      status: 'Enabled',
    }], EXPECTED_PUBLIC_BUCKET).safe).toBe(false)
  })

  it('binds every derivative object to a READY public database identity', () => {
    const ready = [
      'prod/web/asset/recipe-v2/detail/1280/a.webp',
      'prod/web/asset/site-display-v1/home-entry-commission/960/b.webp',
    ]
    expect(evaluateDerivativeInventory(ready, ready)).toMatchObject({
      safe: true,
      missingCount: 0,
      untrackedCount: 0,
    })
    expect(evaluateDerivativeInventory([
      ready[0]!,
      'prod/original/private.png',
    ], ready)).toMatchObject({
      safe: false,
      unsafeCount: 1,
      untrackedCount: 1,
      missingCount: 1,
    })
  })

  it('constructs only exact public-media file purge inputs', () => {
    const objectKey = 'prod/web/asset/recipe-v2/detail/1280/a.webp'
    const mediaUrl = exactEsaMediaUrl(
      'https://public-media.ditedog.com',
      objectKey,
    )
    expect(buildExactPurgeInput('171890925863148', mediaUrl)).toEqual({
      siteId: 171890925863148,
      type: 'file',
      content: { files: [mediaUrl] },
    })
    expect(() => buildExactPurgeInput(
      '171890925863148',
      'https://public-media.ditedog.com/prod/web/?prefix=true',
    )).toThrow(/exact/u)
    expect(() => buildExactPurgeInput(
      '171890925863148',
      'https://project-furry-forge-public.oss-cn-hangzhou.aliyuncs.com/a.webp',
    )).toThrow(/public-media/u)
  })
})

describe('T52-E2 dry-run CLI', () => {
  it('performs no network or cloud writes and records only redacted evidence', () => {
    const directory = temporaryDirectory()
    const evidencePath = resolve(directory, 'evidence.json')
    const configuration = validConfig(resolve(directory, 'production.db'))
    const result = spawnSync(
      process.execPath,
      [
        resolve(process.cwd(), 'scripts/oss-preflight.mjs'),
        '--run-id',
        't52e2-20260809T123456Z-01020304',
        '--evidence',
        evidencePath,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          APP_ENV: configuration.appEnv,
          DATABASE_FILE: configuration.databaseFile,
          PUBLIC_BASE_URL: configuration.publicBaseUrl,
          ADMIN_BASE_URL: configuration.adminBaseUrl,
          MEDIA_BASE_URL: configuration.mediaBaseUrl,
          OSS_UPLOAD_BASE_URL: configuration.uploadBaseUrl,
          OSS_REGION: configuration.region,
          OSS_ENDPOINT: configuration.endpoint,
          OSS_PRIVATE_BUCKET: configuration.privateBucket,
          OSS_PUBLIC_BUCKET: configuration.publicBucket,
          OSS_ACCESS_KEY_ID: configuration.accessKeyId,
          OSS_ACCESS_KEY_SECRET: configuration.accessKeySecret,
          ESA_SITE_ID: configuration.esaSiteId,
          ESA_ACCESS_KEY_ID: configuration.esaAccessKeyId,
          ESA_ACCESS_KEY_SECRET: configuration.esaAccessKeySecret,
        },
      },
    )

    expect(result.status).toBe(0)
    const evidenceText = readFileSync(evidencePath, 'utf8')
    const evidence = JSON.parse(evidenceText)
    expect(evidence).toMatchObject({
      task: 'T52-E2',
      mode: 'dry-run',
      status: 'passed',
      secretsRecorded: false,
      objectKeysRecorded: false,
      signedUrlsRecorded: false,
    })
    expect(evidence.checks.some((check: { status: string }) => (
      check.status === 'skip'
    ))).toBe(true)
    expect(evidenceText).not.toContain(configuration.accessKeyId)
    expect(evidenceText).not.toContain(configuration.accessKeySecret)
    expect(evidenceText).not.toContain(configuration.esaAccessKeyId)
    expect(evidenceText).not.toContain(configuration.esaAccessKeySecret)
    expect(evidenceText).not.toContain('/original/')
    expect(evidenceText).not.toContain('x-oss-signature')
  })
})
