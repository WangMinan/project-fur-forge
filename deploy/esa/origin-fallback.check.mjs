// Run: node deploy/esa/origin-fallback.check.mjs
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['deploy/esa/origin-fallback.mjs'],
  bundle: true, format: 'esm', write: false, loader: { '.html': 'text' },
})
const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const saved = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout }
const request = (path = '/', init = {}, host = 'ditedog.com') => new Request(`https://${host}${path}`, {
  headers: { accept: 'text/html', cookie: 'test=synthetic' }, ...init,
})

try {
  for (const status of [200, 302, 401, 403, 404, 429, 500, 502, 503, 504, 521, 598]) {
    const response = new Response('original', { status, headers: { location: '/admin/login', 'set-cookie': 'test=synthetic; HttpOnly' } })
    globalThis.fetch = async (req, options) => {
      assert.equal(req.headers.get('cookie'), 'test=synthetic')
      assert.equal(options.redirect, 'manual')
      assert.equal(options.decompress, 'manual')
      return response
    }
    assert.equal(await handler.fetch(request('/', {}, 'admin.ditedog.com')), response)
  }
  globalThis.fetch = async () => { throw new Error('private upstream detail') }
  const fallback = await handler.fetch(request())
  assert.equal(fallback.status, 503)
  assert.equal(fallback.headers.get('cache-control'), 'no-store')
  assert.equal(fallback.headers.get('retry-after'), '60')
  assert.equal(fallback.headers.get('x-ditedog-fallback'), 'connection-failed')
  const body = await fallback.text()
  assert(body.includes('小狗休息一下'))
  assert(!body.includes('private upstream detail'))
  assert.equal(await (await handler.fetch(request('/', { method: 'HEAD' }))).text(), '')

  globalThis.fetch = async () => {
    await new Promise(resolve => saved.setTimeout(resolve, 6100))
    return new Response('slow but healthy', { status: 200 })
  }
  assert.equal(await (await handler.fetch(request())).text(), 'slow but healthy')

  let timeoutCleared = false
  globalThis.setTimeout = (callback, delay) => { assert.equal(delay, 10000); queueMicrotask(callback); return 42 }
  globalThis.clearTimeout = timer => { assert.equal(timer, 42); timeoutCleared = true }
  globalThis.fetch = () => new Promise(() => {})
  const timeout = await handler.fetch(request())
  assert.equal(timeout.status, 503)
  assert.equal(timeout.headers.get('x-ditedog-fallback'), 'origin-timeout')
  assert(timeoutCleared)
  Object.assign(globalThis, saved)

  const untouched = new Response('api/static error', { status: 503 })
  globalThis.fetch = async () => untouched
  for (const req of [request('/api'), request('/api/admin/session'), request('/', { method: 'POST', body: 'synthetic' }), request('/_nuxt/test.js', { headers: { accept: '*/*' } })]) {
    assert.equal(await handler.fetch(req), untouched)
  }
  globalThis.fetch = async () => { throw new Error('must not fetch unexpected host') }
  assert.equal((await handler.fetch(request('/', {}, 'public-media.ditedog.com'))).status, 421)
  globalThis.fetch = async () => new Response('recovered', { status: 200 })
  assert.equal(await (await handler.fetch(request())).text(), 'recovered')
  console.log('PASS: all HTTP statuses preserved, redirects/cookies, connection failure, slow success, 10s timeout, HEAD, scope, recovery')
}
finally {
  Object.assign(globalThis, saved)
}
