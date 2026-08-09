import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const host = '127.0.0.1'
const port = '3101'
const baseURL = `http://${host}:${port}`
const adminBaseURL = `http://localhost:${port}`
const databaseFile = resolve(
  tmpdir(),
  `fur-forge-production-verify-${process.pid}.db`,
)
const verificationEnv = {
  ...process.env,
  ADMIN_BASE_URL: adminBaseURL,
  APP_ENV: 'test',
  DATABASE_FILE: databaseFile,
  MEDIA_BASE_URL: 'https://public-media.ditedog.com',
  OSS_UPLOAD_BASE_URL:
    'https://verify-private.oss-cn-hangzhou.aliyuncs.com',
  OSS_REGION: 'oss-cn-hangzhou',
  OSS_PRIVATE_BUCKET: 'verify-private',
  OSS_PUBLIC_BUCKET: 'verify-public',
  OSS_ENDPOINT: 'https://oss-cn-hangzhou-internal.aliyuncs.com',
  OSS_ACCESS_KEY_ID: 'production-verify-oss-access-key-id',
  OSS_ACCESS_KEY_SECRET: 'production-verify-oss-access-key-secret',
  ESA_SITE_ID: '1234567890',
  ESA_ACCESS_KEY_ID: 'production-verify-esa-access-key-id',
  ESA_ACCESS_KEY_SECRET: 'production-verify-esa-access-key-secret',
  PUBLIC_BASE_URL: baseURL,
  TRUSTED_PROXY_CIDRS: '172.30.250.1/32,192.0.2.0/24',
}

function cleanupDatabase() {
  for (const file of [databaseFile, `${databaseFile}-shm`, `${databaseFile}-wal`]) {
    rmSync(file, { force: true })
  }
}

const migration = spawnSync(
  process.execPath,
  ['node_modules/tsx/dist/cli.mjs', 'scripts/db-migrate.ts'],
  {
    encoding: 'utf8',
    env: verificationEnv,
  },
)
if (migration.status !== 0) {
  cleanupDatabase()
  throw new Error(`Production verification migration failed.\n${migration.stderr}`)
}

const server = spawn(
  process.execPath,
  [
    '.output/server/index.mjs',
  ],
  {
    env: {
      ...verificationEnv,
      NITRO_HOST: '0.0.0.0',
      NITRO_PORT: port,
    },
    stdio: [
      'ignore',
      'pipe',
      'pipe',
    ],
  },
)

let serverOutput = ''

server.stdout.setEncoding('utf8')
server.stderr.setEncoding('utf8')
server.stdout.on('data', (chunk) => {
  serverOutput += chunk
})
server.stderr.on('data', (chunk) => {
  serverOutput += chunk
})

async function waitUntilReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Production server exited early.\n${serverOutput}`)
    }

    try {
      const response = await fetch(`${baseURL}/api/health`)
      if (response.ok) {
        return
      }
    }
    catch {
      // The server is still starting.
    }

    await new Promise(resolve => setTimeout(resolve, 250))
  }

  throw new Error(`Production server did not become ready.\n${serverOutput}`)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

try {
  await waitUntilReady()

  const publicApiPaths = [
    '/api/public/v1/home-aggregate',
    '/api/public/v1/works',
    '/api/public/v1/adoptions',
    '/api/public/v1/returns',
  ]
  const [
    healthResponse,
    publicResponse,
    adminResponse,
    ...publicApiResponses
  ] = await Promise.all([
    fetch(`${baseURL}/api/health`),
    fetch(`${baseURL}/`),
    fetch(`${adminBaseURL}/admin/login`),
    ...publicApiPaths.map(path => fetch(`${baseURL}${path}`)),
  ])

  const [health, publicHtml, adminHtml, ...publicApiBodies] = await Promise.all([
    healthResponse.json(),
    publicResponse.text(),
    adminResponse.text(),
    ...publicApiResponses.map(response => response.text()),
  ])

  assert(healthResponse.ok, 'Health endpoint did not return 2xx.')
  assert(health.status === 'ok', 'Health endpoint did not report ok.')
  assert(
    publicResponse.ok,
    `Public homepage returned ${publicResponse.status}.\n${serverOutput}`,
  )
  assert(
    publicHtml.includes('data-testid="public-home"'),
    'Public homepage marker was not rendered into the server HTML.',
  )
  assert(
    publicHtml.includes('有点小狗'),
    'Public navigation brand was not rendered into the server HTML.',
  )
  assert(
    publicHtml.includes('DITE DOG FURSUIT'),
    'Public English brand was not rendered into the server HTML.',
  )
  publicApiResponses.forEach((response, index) => assert(
    response.ok,
    `Public API ${publicApiPaths[index]} returned ${response.status}.`,
  ))
  const publicProjection = [publicHtml, ...publicApiBodies].join('\n')
  for (const forbidden of [
    '.oss-cn-hangzhou.aliyuncs.com',
    '/prod/original/',
    '/prod/processing/',
    '/prod/preview/',
    'privateObjectKey',
    'signedUrl',
  ]) {
    assert(
      !publicProjection.includes(forbidden),
      `Public SSR/API projection exposed forbidden media data: ${forbidden}`,
    )
  }
  const projectedProductionMediaUrls = publicProjection.match(
    /https?:\/\/[^"\\\s]+\/prod\/web\/[^"\\\s]+/gu,
  ) ?? []
  assert(
    projectedProductionMediaUrls.every(url => (
      url.startsWith('https://public-media.ditedog.com/prod/web/')
    )),
    'Public SSR/API projection used a non-ESA production media URL.',
  )
  assert(adminResponse.ok, 'Admin login did not return 2xx.')
  assert(
    !adminHtml.includes('data-testid="admin-login"')
    && !adminHtml.includes('管理端最小 CSR 切片已运行'),
    'Admin login content unexpectedly appeared in the server HTML.',
  )
  assert(
    adminResponse.headers.get('x-robots-tag')
    === 'noindex, nofollow, noarchive',
    'Admin login is missing the noindex response header.',
  )

  console.log('Production verification passed: health, public SSR, admin CSR.')
}
finally {
  if (server.exitCode === null) {
    server.kill()
    await once(server, 'exit')
  }
  cleanupDatabase()
}
