import { request } from 'node:http'
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

  it('isolates public and admin paths with one error envelope', async () => {
    const publicAdminResponse = await fetch(
      `${publicBaseUrl}/admin/login`,
    )
    const adminPublicResponse = await fetch(`${adminBaseUrl}/works`)

    expect(publicAdminResponse.status).toBe(404)
    expect(adminPublicResponse.status).toBe(404)
    await expect(publicAdminResponse.json()).resolves.toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource was not found.',
      },
    })
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
