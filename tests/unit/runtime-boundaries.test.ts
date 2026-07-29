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
} from 'vitest'
import { ORIGINAL_IMAGE_MAX_BYTES } from '../../shared/constants/project'
import { decideHostAccess } from '../../server/utils/host-policy'
import {
  loadRuntimeConfig,
  RUNTIME_CONFIG_ENV,
  RUNTIME_CONFIG_TYPES,
} from '../../server/utils/runtime-config'
import { redactLogValue } from '../../server/utils/safe-log'

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
    })
    const config = loadRuntimeConfig({
      cwd,
      env: { APP_ENV: 'test' },
      filePath,
    })

    expect(config.databaseFile).toBe('file.db')
    expect(config.publicBaseUrl).toBe('http://localhost:3000')
  })

  it('uses safe fallback without an active file', () => {
    const config = loadRuntimeConfig({
      cwd: temporaryDirectory(),
      env: { APP_ENV: 'test' },
    })

    expect(config.databaseFile).toBe('.data/dev.db')
    expect(config.sessionSecret).toBeUndefined()
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
        OSS_BUCKET: 'test-bucket',
        OSS_ENDPOINT: 'https://oss-cn-hangzhou.aliyuncs.com',
        OSS_ACCESS_KEY_ID: 'test-access-key-id',
        OSS_ACCESS_KEY_SECRET: 'test-access-key-secret',
      },
    })).toThrowError(/sessionSecret/)
  })

  it('keeps the tracked template aligned and hard limits out of config', () => {
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
    expect(template.values).not.toHaveProperty('originalImageMaxBytes')
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
      'admin.test',
      '/admin/login',
      config,
    )).toEqual({ action: 'allow' })
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
})

describe('safe logging', () => {
  it('redacts secrets, customer fields and signed query strings', () => {
    const redacted = JSON.stringify(redactLogValue({
      password: 'plain-password',
      ownerContact: 'private-contact',
      target: 'https://oss.test/object?Signature=private-signature',
      nested: {
        originalObjectKeys: ['private/object.jpg'],
      },
    }))

    expect(redacted).not.toContain('plain-password')
    expect(redacted).not.toContain('private-contact')
    expect(redacted).not.toContain('private-signature')
    expect(redacted).not.toContain('private/object.jpg')
    expect(redacted).toContain('[REDACTED]')
  })
})
