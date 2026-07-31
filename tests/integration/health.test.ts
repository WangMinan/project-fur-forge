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

const port = 3102
const publicBaseUrl = `http://127.0.0.1:${port}`
const adminBaseUrl = `http://localhost:${port}`

function requestWithHost(path: string, host: string) {
  return new Promise<{
    body: unknown
    status: number
  }>((resolve, reject) => {
    const clientRequest = request({
      host: '127.0.0.1',
      port,
      path,
      headers: {
        host,
      },
    }, (response) => {
      const chunks: Buffer[] = []

      response.on('data', chunk => chunks.push(Buffer.from(chunk)))
      response.on('end', () => {
        resolve({
          body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
          status: response.statusCode ?? 0,
        })
      })
    })

    clientRequest.on('error', reject)
    clientRequest.end()
  })
}

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  browser: false,
  server: true,
  port,
  env: {
    APP_ENV: 'test',
    DATABASE_FILE: resolve(
      tmpdir(),
      `fur-forge-health-${process.pid}.db`,
    ),
    PUBLIC_BASE_URL: publicBaseUrl,
    ADMIN_BASE_URL: adminBaseUrl,
    MEDIA_BASE_URL: 'https://media.test.invalid',
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
