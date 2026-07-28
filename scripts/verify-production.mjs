import { spawn } from 'node:child_process'

const host = '127.0.0.1'
const port = '3101'
const baseURL = `http://${host}:${port}`

const server = spawn(
  process.execPath,
  [
    '.output/server/index.mjs',
  ],
  {
    env: {
      ...process.env,
      NITRO_HOST: host,
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

  const [healthResponse, publicResponse, adminResponse] = await Promise.all([
    fetch(`${baseURL}/api/health`),
    fetch(`${baseURL}/`),
    fetch(`${baseURL}/admin/login`),
  ])

  const [health, publicHtml, adminHtml] = await Promise.all([
    healthResponse.json(),
    publicResponse.text(),
    adminResponse.text(),
  ])

  assert(healthResponse.ok, 'Health endpoint did not return 2xx.')
  assert(health.status === 'ok', 'Health endpoint did not report ok.')
  assert(publicResponse.ok, 'Public homepage did not return 2xx.')
  assert(
    publicHtml.includes('data-testid="public-home"')
    && publicHtml.includes('有点小狗工作室')
    && publicHtml.includes('dite dog'),
    'Public homepage was not rendered into the server HTML.',
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
  server.kill()
}
