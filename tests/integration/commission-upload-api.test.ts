import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setup } from '@nuxt/test-utils/e2e'
import {
  describe,
  expect,
  it,
} from 'vitest'
import { createSyntheticSourcePng } from '../../scripts/oss-preflight-core.mjs'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import { initializeAdmin } from '../../server/utils/service/auth'
import { PUBLIC_COMMISSION_JSON_BODY_MAX_BYTES } from '../../server/utils/route/request-body'

const port = 3104
const publicBaseUrl = `http://127.0.0.1:${port}`
const adminBaseUrl = `http://localhost:${port}`
const databaseFile = resolve(
  tmpdir(),
  `fur-forge-commission-upload-api-${process.pid}.db`,
)
const content = createSyntheticSourcePng(640, 480) as Buffer
const expected = {
  contentType: 'image/png',
  byteSize: content.length,
  contentMd5: createHash('md5').update(content).digest('base64'),
  sha256: createHash('sha256').update(content).digest('hex'),
  width: 640,
  height: 480,
}

await migrateDatabase(databaseFile)
const setupDatabase = openDatabase(databaseFile)
await initializeAdmin(setupDatabase.sqlite, {
  username: 'admin',
  password: 'commission admin test password',
})
setupDatabase.sqlite.close()

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  browser: false,
  server: true,
  port,
  env: {
    APP_ENV: 'test',
    DATABASE_FILE: databaseFile,
    PUBLIC_BASE_URL: publicBaseUrl,
    ADMIN_BASE_URL: adminBaseUrl,
    MEDIA_BASE_URL: `http://127.0.0.2:${port}`,
    OSS_UPLOAD_BASE_URL: 'https://upload.test.invalid',
    SESSION_SECRET: 'test-commission-session-secret-32-characters',
  },
})

function createRequest(
  body: unknown,
  options: { contentType?: string, origin?: string | null } = {},
) {
  const headers: Record<string, string> = {
    'content-type': options.contentType ?? 'application/json',
  }
  if (options.origin !== null) {
    headers.origin = options.origin ?? publicBaseUrl
  }
  return fetch(`${publicBaseUrl}/api/public/v1/commission-upload-sessions`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function completeRequest(
  id: string,
  token: string,
  expectedVersion = 1,
) {
  return fetch(
    `${publicBaseUrl}/api/public/v1/commission-upload-sessions/${id}/complete`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        origin: publicBaseUrl,
      },
      body: JSON.stringify({ expectedVersion }),
    },
  )
}

describe('commission upload public API boundaries', () => {
  it('enforces Origin/body/token/rate limits and completes a real conditional PUT', async () => {
    const missingOrigin = await createRequest({ expected }, { origin: null })
    const wrongOrigin = await createRequest(
      { expected },
      { origin: 'https://untrusted.invalid' },
    )
    const wrongContentType = await createRequest(
      { expected },
      { contentType: 'text/plain' },
    )
    expect(missingOrigin.status).toBe(403)
    expect(wrongOrigin.status).toBe(403)
    expect(wrongContentType.status).toBe(400)

    const honeypot = await createRequest({ expected, website: 'filled' })
    expect(honeypot.status).toBe(400)
    expect(JSON.stringify(await honeypot.json())).not.toContain('filled')

    const oversized = await createRequest(JSON.stringify({
      expected,
      padding: 'x'.repeat(PUBLIC_COMMISSION_JSON_BODY_MAX_BYTES),
    }))
    expect(oversized.status).toBe(413)

    const createdResponse = await createRequest({ expected })
    expect(createdResponse.status).toBe(201)
    expect(createdResponse.headers.get('cache-control')).toBe('no-store')
    const created = await createdResponse.json() as {
      data: {
        session: { uploadSessionId: string, version: number }
        token: string
        upload: {
          headers: Record<string, string>
          method: string
          url: string
        }
      }
    }
    const serialized = JSON.stringify(created)
    expect(serialized).not.toContain('privateObjectKey')
    expect(created.data.upload).toMatchObject({
      method: 'PUT',
      headers: {
        'Content-Type': 'image/png',
        'Content-MD5': expected.contentMd5,
        'x-oss-meta-sha256': expected.sha256,
        'x-oss-forbid-overwrite': 'true',
      },
    })

    const put = await fetch(created.data.upload.url, {
      method: 'PUT',
      headers: created.data.upload.headers,
      body: new Uint8Array(content),
    })
    expect(put.status).toBe(200)

    const wrongToken = await completeRequest(
      created.data.session.uploadSessionId,
      'z'.repeat(43),
    )
    expect(wrongToken.status).toBe(404)
    expect(await wrongToken.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Commission upload was not found.',
      },
    })

    const completedResponse = await completeRequest(
      created.data.session.uploadSessionId,
      created.data.token,
    )
    expect(completedResponse.status).toBe(200)
    const completed = await completedResponse.json() as {
      data: { session: { assetId: string, status: string, version: number } }
    }
    expect(completed.data.session).toMatchObject({
      assetId: created.data.session.uploadSessionId,
      status: 'COMPLETED',
      version: 3,
    })
    const repeated = await completeRequest(
      created.data.session.uploadSessionId,
      created.data.token,
    )
    expect(repeated.status).toBe(200)
    await expect(repeated.json()).resolves.toEqual(completed)

    const database = openDatabase(databaseFile)
    try {
      database.sqlite.prepare(`
        INSERT INTO commission_submissions (
          id, receipt_code, nickname, phone_number, qq, height_cm,
          weight_kg_tenths, design_asset_id, created_at, updated_at
        ) VALUES (?, 'DD-API123', '接口测试', '19900000000', '100001',
          170, 605, ?, ?, ?)
      `).run(
        created.data.session.uploadSessionId,
        created.data.session.uploadSessionId,
        Date.now(),
        Date.now(),
      )
    }
    finally {
      database.sqlite.close()
    }

    const unauthenticatedPreview = await fetch(
      `${adminBaseUrl}/api/admin/v1/commissions/${created.data.session.uploadSessionId}/design-reference`,
    )
    expect(unauthenticatedPreview.status).toBe(401)
    expect(unauthenticatedPreview.headers.get('cache-control')).toBe(
      'no-store, max-age=0',
    )

    const login = await fetch(`${adminBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: adminBaseUrl,
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'commission admin test password',
      }),
    })
    expect(login.status).toBe(200)
    const cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? ''
    const preview = await fetch(
      `${adminBaseUrl}/api/admin/v1/commissions/${created.data.session.uploadSessionId}/design-reference`,
      { headers: { cookie } },
    )
    expect(preview.status).toBe(200)
    expect(preview.headers.get('cache-control')).toBe('no-store, max-age=0')
    expect(preview.headers.get('content-type')).toContain('image/png')
    expect(Buffer.from(await preview.arrayBuffer())).toEqual(content)

    let rateLimited: Response | null = null
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await createRequest({ expected, website: 'filled' })
      if (response.status === 429) {
        rateLimited = response
        break
      }
    }
    expect(rateLimited?.status).toBe(429)
    expect(rateLimited?.headers.get('retry-after')).toMatch(/^\d+$/u)
  }, 60_000)
})
