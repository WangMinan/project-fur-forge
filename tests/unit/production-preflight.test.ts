import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  evaluateCorsRules,
  REQUIRED_PUT_HEADERS,
} from '../../scripts/oss-preflight-core.mjs'
import {
  assertProductionTestObject,
  buildExactPurgeInput,
  createProductionPreflightRunId,
  evaluateLifecycleRules,
  exactEsaMediaUrl,
  EXPECTED_PRIVATE_BUCKET,
  EXPECTED_PUBLIC_BUCKET,
  productionPreflightPrefix,
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
    esaApiEndpoint: 'https://esa.cn-hangzhou.aliyuncs.com',
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
      mediaBaseUrl: 'https://media.attacker.invalid',
    })).toThrow(expect.objectContaining({
      code: 'wrong-media-origin',
      message: expect.stringMatching(/exactly/u),
    }))
    expect(() => validateProductionPreflightConfig({
      ...validConfig(),
      esaApiEndpoint: 'https://esa.invalid-provider.cn',
    })).toThrow(/official Aliyun/u)
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

  it('accepts exact or wildcard CORS when the administrator PUT surface works', () => {
    const origin = 'https://admin.ditedog.com'
    expect(evaluateCorsRules([{
      allowedOrigin: origin,
      allowedMethod: ['PUT'],
      allowedHeader: REQUIRED_PUT_HEADERS,
    }], { origin })).toMatchObject({
      sufficient: true,
      broadOrigin: false,
      broadHeaders: false,
    })
    expect(evaluateCorsRules([{
      allowedOrigin: '*',
      allowedMethod: ['PUT'],
      allowedHeader: ['*'],
    }], { origin })).toMatchObject({
      sufficient: true,
      broadOrigin: true,
      broadHeaders: true,
    })
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

  it('constructs only exact public-media file purge inputs', () => {
    const objectKey = 'prod/web/asset/recipe-v2/detail/1280/a.webp'
    const mediaUrl = exactEsaMediaUrl(
      'https://public-media.ditedog.com',
      objectKey,
    )
    expect(buildExactPurgeInput(
      '171890925863148',
      mediaUrl,
      'https://public-media.ditedog.com',
    )).toEqual({
      siteId: 171890925863148,
      type: 'file',
      content: { files: [mediaUrl] },
    })
    expect(() => buildExactPurgeInput(
      '171890925863148',
      'https://public-media.ditedog.com/prod/web/?prefix=true',
      'https://public-media.ditedog.com',
    )).toThrow(/exact/u)
    expect(() => buildExactPurgeInput(
      '171890925863148',
      'https://project-furry-forge-public.oss-cn-hangzhou.aliyuncs.com/a.webp',
      'https://public-media.ditedog.com',
    )).toThrow(/public-media/u)
  })
})

describe('T52-E2 dry-run CLI', () => {
  it('performs no network or cloud writes and records only redacted evidence', () => {
    const directory = temporaryDirectory()
    const evidencePath = resolve(directory, 't52e2-20260809T123456Z-01020304.json')
    const configuration = validConfig(resolve(directory, 'production.db'))
    const result = spawnSync(
      process.execPath,
      [
        resolve(process.cwd(), 'scripts/oss-preflight.mjs'),
        '--run-id',
        't52e2-20260809T123456Z-01020304',
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
          ESA_API_ENDPOINT: configuration.esaApiEndpoint,
          PREFLIGHT_EVIDENCE_DIR: directory,
        },
      },
    )

    expect(result.status).toBe(0)
    const evidenceText = readFileSync(evidencePath, 'utf8')
    const evidence = JSON.parse(evidenceText)
    expect(evidence).toMatchObject({
      schemaVersion: 3,
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
    const checkNames = evidence.checks.map((check: { name: string }) => check.name)
    expect(checkNames).toContain(
      'cors-upload-capability-and-browser-conditional-put-failures',
    )
    expect(checkNames).not.toContain('derivative-inventory-database-boundary')
    expect(checkNames).not.toContain('derivative-bucket-no-cors')
    expect(evidenceText).not.toContain(configuration.accessKeyId)
    expect(evidenceText).not.toContain(configuration.accessKeySecret)
    expect(evidenceText).not.toContain('/original/')
    expect(evidenceText).not.toContain('x-oss-signature')
  })
})
