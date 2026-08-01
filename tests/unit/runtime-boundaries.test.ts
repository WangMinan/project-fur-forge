import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
  dirname,
  resolve,
} from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { ORIGINAL_IMAGE_MAX_BYTES } from '../../shared/constants/project'
import { decideHostAccess } from '../../server/utils/host-policy'
import {
  loadRuntimeConfig,
  RUNTIME_CONFIG_ENV,
  RUNTIME_CONFIG_TYPES,
} from '../../server/utils/runtime-config'
import {
  redactLogText,
  redactLogValue,
  safeLog,
} from '../../server/utils/safe-log'

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
)
const temporaryDirectories: string[] = []

function temporaryDirectory() {
  const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-config-'))
  temporaryDirectories.push(directory)
  return directory
}

function writeRuntimeFile(
  directory: string,
  values: Readonly<Record<string, unknown>>,
) {
  const path = resolve(directory, 'runtime.json')
  writeFileSync(path, JSON.stringify({
    schemaVersion: 1,
    configFileEnv: 'APP_CONFIG_FILE',
    types: RUNTIME_CONFIG_TYPES,
    env: RUNTIME_CONFIG_ENV,
    values,
  }))
  return path
}

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory => rmSync(
    directory,
    {
      force: true,
      recursive: true,
    },
  ))
})

describe('runtime configuration', () => {
  it('uses environment over the active file', () => {
    const cwd = temporaryDirectory()
    const filePath = writeRuntimeFile(cwd, {
      appEnv: 'test',
      databaseFile: 'file.db',
      publicBaseUrl: 'http://public.test',
      adminBaseUrl: 'http://admin.test',
      mediaBaseUrl: 'https://media.test',
      ossUploadBaseUrl: 'https://upload.test',
    })
    const config = loadRuntimeConfig({
      cwd,
      filePath,
      env: {
        APP_ENV: 'test',
        DATABASE_FILE: 'environment.db',
      },
    })

    expect(config.databaseFile).toBe('environment.db')
    expect(config.publicBaseUrl).toBe('http://public.test')
  })

  it('uses the active file over safe fallback', () => {
    const cwd = temporaryDirectory()
    const filePath = writeRuntimeFile(cwd, {
      databaseFile: 'file.db',
      publicBaseUrl: 'http://public.test',
      adminBaseUrl: 'http://admin.test',
      mediaBaseUrl: 'https://media.test',
      ossUploadBaseUrl: 'https://upload.test',
    })
    const config = loadRuntimeConfig({
      cwd,
      env: { APP_ENV: 'test' },
      filePath,
    })

    expect(config.databaseFile).toBe('file.db')
    expect(config.publicBaseUrl).toBe('http://public.test')
  })

  it('uses safe fallback without an active file', () => {
    const config = loadRuntimeConfig({
      cwd: temporaryDirectory(),
      env: {
        APP_ENV: 'test',
        PUBLIC_BASE_URL: 'http://public.test',
        ADMIN_BASE_URL: 'http://admin.test',
        MEDIA_BASE_URL: 'https://media.test',
        OSS_UPLOAD_BASE_URL: 'https://upload.test',
      },
    })

    expect(config.databaseFile).toBe('.data/dev.db')
    expect(config.sessionSecret).toBeUndefined()
  })

  it('requires explicit origins outside tests', () => {
    expect(() => loadRuntimeConfig({
      cwd: temporaryDirectory(),
      env: { APP_ENV: 'development' },
    })).toThrowError(/publicBaseUrl/)
  })

  it('fails safely without leaking invalid values', () => {
    const secret = 'too-short'

    expect(() => loadRuntimeConfig({
      cwd: temporaryDirectory(),
      env: {
        APP_ENV: 'test',
        SESSION_SECRET: secret,
      },
    })).toThrowError(/sessionSecret/)

    try {
      loadRuntimeConfig({
        cwd: temporaryDirectory(),
        env: {
          APP_ENV: 'test',
          SESSION_SECRET: secret,
        },
      })
    }
    catch (error) {
      expect(String(error)).not.toContain(secret)
    }

    const productionCwd = temporaryDirectory()
    const productionBase = {
      APP_ENV: 'production',
      PUBLIC_BASE_URL: 'https://public.test',
      ADMIN_BASE_URL: 'https://admin.test',
      MEDIA_BASE_URL: 'https://media.test',
      OSS_UPLOAD_BASE_URL: 'https://upload.test',
      DATABASE_FILE: resolve(productionCwd, 'studio.db'),
    }

    expect(() => loadRuntimeConfig({
      cwd: productionCwd,
      env: productionBase,
    })).toThrowError(/ossRegion/)

    expect(() => loadRuntimeConfig({
      cwd: productionCwd,
      env: {
        ...productionBase,
        OSS_REGION: 'oss-cn-hangzhou',
        OSS_PRIVATE_BUCKET: 'test-private-bucket',
        OSS_PUBLIC_BUCKET: 'test-public-bucket',
        OSS_ENDPOINT: 'https://oss-cn-hangzhou.aliyuncs.com',
        OSS_ACCESS_KEY_ID: 'test-access-key-id',
        OSS_ACCESS_KEY_SECRET: 'test-access-key-secret',
      },
    })).toThrowError(/sessionSecret/)

    const productionRequired = {
      ...productionBase,
      OSS_REGION: 'oss-cn-hangzhou',
      OSS_PRIVATE_BUCKET: 'test-private-bucket',
      OSS_PUBLIC_BUCKET: 'test-public-bucket',
      OSS_ENDPOINT: 'https://oss-cn-hangzhou.aliyuncs.com',
      OSS_ACCESS_KEY_ID: 'test-access-key-id',
      OSS_ACCESS_KEY_SECRET: 'test-access-key-secret',
      SESSION_SECRET: 'production-session-secret-at-least-32-characters',
    }

    const productionWithoutSmtp = loadRuntimeConfig({
      cwd: productionCwd,
      env: productionRequired,
    })
    expect(productionWithoutSmtp).toMatchObject({
      appEnv: 'production',
    })
    expect(productionWithoutSmtp.smtpHost).toBeUndefined()
    expect(productionWithoutSmtp.smtpPassword).toBeUndefined()
    expect(() => loadRuntimeConfig({
      cwd: productionCwd,
      env: {
        ...productionRequired,
        SMTP_HOST: 'smtp.example.test',
      },
    })).toThrowError(/smtpHost/)
    expect(loadRuntimeConfig({
      cwd: productionCwd,
      env: {
        ...productionRequired,
        SMTP_HOST: 'smtp.example.test',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'mailer@example.test',
        SMTP_PASSWORD: 'test-smtp-password',
      },
    })).toMatchObject({
      smtpHost: 'smtp.example.test',
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: 'mailer@example.test',
    })
  })

  it('requires distinct private and public buckets and rejects OSS_BUCKET', () => {
    const cwd = temporaryDirectory()
    const ossBase = {
      APP_ENV: 'test',
      PUBLIC_BASE_URL: 'http://public.test',
      ADMIN_BASE_URL: 'http://admin.test',
      MEDIA_BASE_URL: 'https://media.test',
      OSS_UPLOAD_BASE_URL: 'https://upload.test',
      OSS_REGION: 'oss-cn-hangzhou',
      OSS_ENDPOINT: 'https://oss-cn-hangzhou.aliyuncs.com',
      OSS_ACCESS_KEY_ID: 'test-access-key-id',
      OSS_ACCESS_KEY_SECRET: 'test-access-key-secret',
    }

    expect(() => loadRuntimeConfig({
      cwd,
      env: {
        ...ossBase,
        OSS_PRIVATE_BUCKET: 'test-private-bucket',
      },
    })).toThrowError(/ossRegion/)

    expect(() => loadRuntimeConfig({
      cwd,
      env: {
        ...ossBase,
        OSS_PRIVATE_BUCKET: 'same-bucket',
        OSS_PUBLIC_BUCKET: 'same-bucket',
      },
    })).toThrowError(/ossPublicBucket/)

    expect(() => loadRuntimeConfig({
      cwd,
      env: {
        APP_ENV: 'test',
        OSS_BUCKET: 'legacy-bucket',
      },
    })).toThrowError(
      /OSS_BUCKET is no longer supported; use OSS_PRIVATE_BUCKET and OSS_PUBLIC_BUCKET/,
    )

    expect(() => loadRuntimeConfig({
      cwd,
      env: {
        APP_ENV: 'test',
        OSS_BUCKET: '',
      },
    })).toThrowError(
      /OSS_BUCKET is no longer supported; use OSS_PRIVATE_BUCKET and OSS_PUBLIC_BUCKET/,
    )

    expect(() => loadRuntimeConfig({
      cwd,
      env: { APP_ENV: 'test' },
      filePath: writeRuntimeFile(cwd, {
        ossBucket: 'legacy-bucket',
      }),
    })).toThrowError(/ossBucket\/OSS_BUCKET is no longer supported/)
  })

  it('keeps the tracked template aligned and hard limits out of config', () => {
    const nuxtConfig = readFileSync(
      resolve(projectRoot, 'nuxt.config.ts'),
      'utf8',
    )
    const envTemplateNames = readFileSync(
      resolve(projectRoot, '.env.example'),
      'utf8',
    )
      .split(/\r?\n/u)
      .flatMap((line) => {
        const match = line.match(/^([A-Z][A-Z0-9_]*)=/u)
        return match?.[1] ? [match[1]] : []
      })
    const template = JSON.parse(readFileSync(
      resolve(projectRoot, 'config/runtime.example.json'),
      'utf8',
    )) as {
      env: Record<string, string>
      types: Record<string, string>
      values: Record<string, unknown>
    }

    expect(template.env).toEqual(RUNTIME_CONFIG_ENV)
    expect(template.types).toEqual(RUNTIME_CONFIG_TYPES)
    expect(envTemplateNames).toEqual([
      'APP_CONFIG_FILE',
      ...Object.values(RUNTIME_CONFIG_ENV),
    ])
    expect(new Set(envTemplateNames).size).toBe(envTemplateNames.length)
    expect(template.values).toHaveProperty('ossPrivateBucket', '')
    expect(template.values).toHaveProperty('ossPublicBucket', '')
    expect(template.values).toMatchObject({
      publicBaseUrl: '',
      adminBaseUrl: '',
      mediaBaseUrl: '',
      ossUploadBaseUrl: '',
    })
    expect(template.values).not.toHaveProperty('ossBucket')
    expect(template.values).not.toHaveProperty('originalImageMaxBytes')
    expect(nuxtConfig).not.toContain('process.env.SESSION_SECRET')
    expect(ORIGINAL_IMAGE_MAX_BYTES).toBe(30_000_000)
  })
})

describe('host boundary', () => {
  const config = loadRuntimeConfig({
    cwd: temporaryDirectory(),
    env: {
      APP_ENV: 'test',
      PUBLIC_BASE_URL: 'http://public.test',
      ADMIN_BASE_URL: 'http://admin.test',
      MEDIA_BASE_URL: 'https://media.test',
      OSS_UPLOAD_BASE_URL: 'https://upload.test',
    },
  })

  it('isolates public and admin routes', () => {
    expect(decideHostAccess(
      'public.test',
      '/works',
      config,
    )).toEqual({ action: 'allow' })
    expect(decideHostAccess(
      'public.test',
      '/api/auth/login',
      config,
    )).toMatchObject({
      action: 'reject',
      statusCode: 404,
    })
    expect(decideHostAccess(
      'public.test',
      '/api/_auth/session',
      config,
    )).toMatchObject({
      action: 'reject',
      statusCode: 404,
    })
    expect(decideHostAccess(
      'admin.test',
      '/admin/login',
      config,
    )).toEqual({ action: 'allow' })
    expect(decideHostAccess(
      'admin.test',
      '/api/_auth/session',
      config,
    )).toMatchObject({
      action: 'reject',
      statusCode: 404,
    })
    expect(decideHostAccess(
      'admin.test',
      '/works',
      config,
    )).toMatchObject({
      action: 'reject',
      statusCode: 404,
    })
    expect(decideHostAccess(
      'unknown.test',
      '/api/health',
      config,
    )).toMatchObject({
      action: 'reject',
      statusCode: 421,
    })
  })

  it('allows E2E fake OSS endpoints only in test environment', () => {
    expect(decideHostAccess(
      'admin.test',
      '/api/e2e-fake-oss/test/run/original/id/token.png',
      config,
    )).toEqual({ action: 'allow' })
    expect(decideHostAccess(
      'admin.test',
      '/api/e2e-fake-media-control',
      config,
    )).toEqual({ action: 'allow' })

    const productionConfig = loadRuntimeConfig({
      cwd: temporaryDirectory(),
      env: {
        APP_ENV: 'production',
        PUBLIC_BASE_URL: 'https://public.example',
        ADMIN_BASE_URL: 'https://admin.example',
        MEDIA_BASE_URL: 'https://media.example',
        OSS_UPLOAD_BASE_URL: 'https://upload.example',
        DATABASE_FILE: '/srv/app/data.db',
        OSS_REGION: 'oss-cn-hangzhou',
        OSS_PRIVATE_BUCKET: 'private-bucket',
        OSS_PUBLIC_BUCKET: 'public-bucket',
        OSS_ENDPOINT: 'https://oss-cn-hangzhou.aliyuncs.com',
        OSS_ACCESS_KEY_ID: 'test-access-key-id',
        OSS_ACCESS_KEY_SECRET: 'test-access-key-secret',
        SESSION_SECRET: 'test-only-session-secret-with-32-chars',
      },
    })
    expect(decideHostAccess(
      'admin.example',
      '/api/e2e-fake-oss/test/run/original/id/token.png',
      productionConfig,
    )).toMatchObject({
      action: 'reject',
      statusCode: 404,
    })
  })
})

describe('safe logging', () => {
  it('redacts sensitive keys and sensitive strings in structured context', () => {
    const redacted = JSON.stringify(redactLogValue({
      password: 'plain-password',
      ownerContact: 'private-contact',
      target: 'https://oss.test/object?Signature=private-signature',
      detail: 'Cookie: session=test-session owner@example.invalid',
      message: 'AccessKeyId=test-key-id AccessKeySecret=test-key-secret',
      nested: {
        originalObjectKeys: ['private/object.jpg'],
        note: 'prod/original/asset/private.jpg',
      },
    }))

    expect(redacted).not.toContain('plain-password')
    expect(redacted).not.toContain('private-contact')
    expect(redacted).not.toContain('private-signature')
    expect(redacted).not.toContain('test-session')
    expect(redacted).not.toContain('owner@example.invalid')
    expect(redacted).not.toContain('test-key-id')
    expect(redacted).not.toContain('test-key-secret')
    expect(redacted).not.toContain('private/object.jpg')
    expect(redacted).not.toContain('prod/original/asset/private.jpg')
    expect(redacted).toContain('[REDACTED]')
  })

  it('redacts message strings before logging', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const message = [
      'request failed',
      'password=plain-password',
      'Bearer test-session',
      'Cookie: browser-session',
      'AccessKeyId=test-key-id',
      'AccessKeySecret=test-key-secret',
      'owner@example.invalid',
      'https://oss.test/prod/original/private.jpg?Signature=test-signature',
    ].join(' ')

    expect(redactLogText(message)).not.toContain('plain-password')
    safeLog('error', message, {
      detail: 'ownerContact=private-contact',
      requestBody: {
        characterName: 'private-name',
      },
    })

    const output = JSON.stringify(error.mock.calls)
    expect(output).not.toContain('plain-password')
    expect(output).not.toContain('test-session')
    expect(output).not.toContain('browser-session')
    expect(output).not.toContain('test-key-id')
    expect(output).not.toContain('test-key-secret')
    expect(output).not.toContain('owner@example.invalid')
    expect(output).not.toContain('test-signature')
    expect(output).not.toContain('private-contact')
    expect(output).not.toContain('private-name')
    expect(output).toContain('[REDACTED]')
    error.mockRestore()
  })
})
