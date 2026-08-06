import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  setup,
} from '@nuxt/test-utils/e2e'
import {
  describe,
  expect,
  it,
} from 'vitest'
import { migrateDatabase } from '../../server/utils/database'
import { ADMIN_JSON_BODY_MAX_BYTES } from '../../server/utils/route/request-body'
import { LOGIN_RATE_LIMIT } from '../../server/utils/route/request-rate-limit'

const port = 3102
const publicBaseUrl = `http://127.0.0.1:${port}`
const adminBaseUrl = `http://localhost:${port}`
const mediaBaseUrl = `http://127.0.0.2:${port}`

function requestWithHost(
  path: string,
  host: string,
  options: {
    body?: string
    headers?: Record<string, string>
    method?: string
  } = {},
) {
  return new Promise<{
    body: unknown
    retryAfter: string | undefined
    status: number
  }>((resolve, reject) => {
    const clientRequest = request({
      host: '127.0.0.1',
      port,
      path,
      method: options.method,
      headers: {
        ...options.headers,
        host,
      },
    }, (response) => {
      const chunks: Buffer[] = []

      response.on('data', chunk => chunks.push(Buffer.from(chunk)))
      response.on('end', () => {
        resolve({
          body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
          retryAfter: response.headers['retry-after'],
          status: response.statusCode ?? 0,
        })
      })
    })

    clientRequest.on('error', reject)
    if (options.body) {
      const middle = Math.ceil(options.body.length / 2)
      clientRequest.write(options.body.slice(0, middle))
      clientRequest.end(options.body.slice(middle))
    }
    else {
      clientRequest.end()
    }
  })
}

// T19 起公开详情页 SSR 真实查询 works 表：健康边界用例需要已迁移的库。
const databaseFile = resolve(
  tmpdir(),
  `fur-forge-health-${process.pid}.db`,
)
await migrateDatabase(databaseFile)

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
    MEDIA_BASE_URL: mediaBaseUrl,
    OSS_UPLOAD_BASE_URL: 'https://upload.test.invalid',
  },
})

describe('runtime request boundaries', () => {
  it('allows health checks on both configured hosts', async () => {
    const [publicResponse, adminResponse] = await Promise.all([
      fetch(`${publicBaseUrl}/api/health`),
      fetch(`${adminBaseUrl}/api/health`),
    ])

    await expect(publicResponse.json()).resolves.toEqual({
      status: 'ok',
      service: 'project-fur-paws',
    })
    expect(adminResponse.ok).toBe(true)
  })

  /**
   * T34-F6：liveness 只证明进程能响应，readiness 才检查数据库与迁移。
   * 两者必须区分：等待服务启动的探针（Playwright webServer、容器编排）用
   * liveness，否则数据库尚未迁移时会把"未就绪"误判为"启动失败"。
   */
  it('separates liveness from readiness and never leaks internals', async () => {
    const [live, ready, legacy] = await Promise.all([
      fetch(`${publicBaseUrl}/api/health/live`),
      fetch(`${publicBaseUrl}/api/health/ready`),
      fetch(`${publicBaseUrl}/api/health`),
    ])

    // liveness 不触碰数据库，因此永远 200。
    expect(live.status).toBe(200)
    await expect(live.json()).resolves.toEqual({ status: 'live' })
    expect(live.headers.get('cache-control')).toBe('no-store')

    // 本套件的库已迁移，因此 readiness 与旧兼容端点都应为就绪。
    expect(ready.status).toBe(200)
    expect(legacy.status).toBe(200)
    const readyBody = await ready.json() as {
      checks: Record<string, unknown>
      status: string
    }
    expect(readyBody.status).toBe('ready')
    // checks 只有布尔项，不含路径、SQL、表名或栈。
    expect(Object.values(readyBody.checks)
      .every(value => typeof value === 'boolean')).toBe(true)
    const serialized = JSON.stringify(readyBody)
    expect(serialized).not.toContain('studio.db')
    expect(serialized).not.toContain('SELECT')
    expect(serialized).not.toContain('__drizzle_migrations')
    expect(serialized).not.toMatch(/Error|at \w+ \(/u)
  })

  it('keeps page failures as HTML and API failures as JSON', async () => {
    const publicAdminResponse = await fetch(
      `${publicBaseUrl}/admin/login`,
      {
        headers: {
          accept: 'text/html',
        },
      },
    )
    const adminPublicResponse = await fetch(`${adminBaseUrl}/works`, {
      headers: {
        accept: 'text/html',
      },
    })
    const publicAdminApiResponse = await fetch(
      `${publicBaseUrl}/api/auth/login`,
    )

    expect(publicAdminResponse.status).toBe(404)
    expect(adminPublicResponse.status).toBe(404)
    expect(publicAdminResponse.headers.get('content-type')).toContain(
      'text/html',
    )
    expect(adminPublicResponse.headers.get('content-type')).toContain(
      'text/html',
    )
    expect(await publicAdminResponse.text()).toContain('<title>')
    expect(publicAdminApiResponse.status).toBe(404)
    expect(publicAdminApiResponse.headers.get('content-type')).toContain(
      'application/json',
    )
    await expect(publicAdminApiResponse.json()).resolves.toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource was not found.',
      },
    })
  })

  it('returns media-host failures without recursing into the HTML renderer', async () => {
    const mediaResponse = await requestWithHost(
      '/dev/web/missing.webp',
      new URL(mediaBaseUrl).host,
    )

    expect(mediaResponse.status).toBe(404)
    expect(mediaResponse.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource was not found.',
      },
    })
    expect((await fetch(`${publicBaseUrl}/api/health`)).status).toBe(200)
  })

  it('rejects oversized chunked login JSON while streaming', async () => {
    const response = await requestWithHost(
      '/api/auth/login',
      new URL(adminBaseUrl).host,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': adminBaseUrl,
          'transfer-encoding': 'chunked',
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'x'.repeat(ADMIN_JSON_BODY_MAX_BYTES),
        }),
      },
    )

    expect(response.status).toBe(413)
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request body is too large.',
      },
    })
  })

  it('rate limits login requests before password verification', async () => {
    let limited: Awaited<ReturnType<typeof requestWithHost>> | undefined

    for (let attempt = 0; attempt <= LOGIN_RATE_LIMIT; attempt += 1) {
      const response = await requestWithHost(
        '/api/auth/login',
        new URL(adminBaseUrl).host,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminBaseUrl,
          },
          body: '{}',
        },
      )
      if (response.status === 429) {
        limited = response
        break
      }
      expect(response.status).toBe(400)
    }

    expect(limited?.retryAfter).toMatch(/^\d+$/)
    expect(limited?.body).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Try again later.',
      },
    })
  })

  it('marks previews private without changing public SSR headers', async () => {
    const [preview, homepage] = await Promise.all([
      fetch(`${publicBaseUrl}/preview/work/missing`, {
        headers: { accept: 'text/html' },
      }),
      fetch(publicBaseUrl, {
        headers: { accept: 'text/html' },
      }),
    ])

    expect(preview.status).toBe(404)
    expect(preview.headers.get('cache-control')).toBe(
      'no-store, max-age=0',
    )
    expect(preview.headers.get('pragma')).toBe('no-cache')
    expect(preview.headers.get('x-robots-tag')).toBe(
      'noindex, nofollow, noarchive',
    )
    expect(homepage.status).toBe(200)
    expect(homepage.headers.get('x-robots-tag')).toBeNull()
    expect(homepage.headers.get('cache-control')).not.toBe(
      'no-store, max-age=0',
    )
  })

  it('renders page 404/500 HTML and keeps API 404/500 envelopes', async () => {
    const [pageNotFound, pageFailure, apiNotFound, apiFailure] =
      await Promise.all([
        fetch(`${publicBaseUrl}/works/not-exist`, {
          headers: { accept: 'text/html' },
        }),
        fetch(`${publicBaseUrl}/__test__/page-error`, {
          headers: { accept: 'text/html' },
        }),
        fetch(`${publicBaseUrl}/api/not-exist`),
        fetch(`${publicBaseUrl}/api/__test__/error`),
      ])

    expect(pageNotFound.status).toBe(404)
    expect(pageNotFound.headers.get('content-type')).toContain('text/html')
    const notFoundHtml = await pageNotFound.text()
    expect(notFoundHtml).toContain('<title>404 · 页面未找到')
    expect(notFoundHtml).toContain('访问的页面不存在、尚未发布或已经下架')

    expect(pageFailure.status).toBe(500)
    expect(pageFailure.headers.get('content-type')).toContain('text/html')
    const failureHtml = await pageFailure.text()
    expect(failureHtml).toContain('<title>500 · 页面暂时无法显示')
    expect(failureHtml).toContain('服务器暂时无法完成请求，请稍后重试')
    expect(failureHtml).not.toContain('test-contact@example.invalid')
    expect(failureHtml).not.toContain('prod/original/private.jpg')

    expect(apiNotFound.status).toBe(404)
    expect(apiNotFound.headers.get('content-type')).toContain(
      'application/json',
    )
    await expect(apiNotFound.json()).resolves.toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource was not found.',
      },
    })

    expect(apiFailure.status).toBe(500)
    expect(apiFailure.headers.get('content-type')).toContain(
      'application/json',
    )
    expect(apiFailure.headers.get('x-request-id')).toMatch(
      /^[A-Za-z0-9._:-]{8,128}$/,
    )
    const apiFailureBody = await apiFailure.json()
    expect(apiFailureBody).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error.',
      },
    })
    expect(JSON.stringify(apiFailureBody)).not.toContain(
      'test-contact@example.invalid',
    )
  })

  it('redirects the admin root and rejects unknown hosts', async () => {
    const redirectResponse = await fetch(adminBaseUrl, {
      redirect: 'manual',
    })
    const unknownHostResponse = await requestWithHost(
      '/api/health',
      `unknown.example:${port}`,
    )

    expect(redirectResponse.status).toBe(302)
    expect(redirectResponse.headers.get('location')).toBe('/admin/login')
    expect(unknownHostResponse.status).toBe(421)
    expect(unknownHostResponse.body).toEqual({
      error: {
        code: 'HOST_NOT_ALLOWED',
        message: 'Host is not allowed.',
      },
    })
  })
})
