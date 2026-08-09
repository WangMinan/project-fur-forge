import tls from 'node:tls'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import {
  parseMeasurementTarget,
  selectEvidenceHeaders,
  summarizeLoadProbe,
  validateLoadProbeOptions,
} from './production-measurement-core.mjs'

const DEFAULT_TIMEOUT_MS = 15000

function parseInteger(value, option) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    throw new Error(`${option} requires an integer.`)
  }
  return parsed
}

function parseArguments(argv) {
  const input = {
    allowLoadProbe: false,
    concurrency: 1,
    loadRequests: 0,
    loadTarget: null,
    output: null,
    rounds: 2,
    targets: [],
  }
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index]
    if (option === '--allow-load-probe') {
      input.allowLoadProbe = true
      continue
    }
    const value = argv[index + 1]
    if (!value) {
      throw new Error(`${option} requires a value.`)
    }
    index += 1
    if (option === '--target') {
      input.targets.push(parseMeasurementTarget(value))
    }
    else if (option === '--rounds') {
      input.rounds = parseInteger(value, option)
    }
    else if (option === '--load-requests') {
      input.loadRequests = parseInteger(value, option)
    }
    else if (option === '--load-concurrency') {
      input.concurrency = parseInteger(value, option)
    }
    else if (option === '--load-target') {
      input.loadTarget = value
    }
    else if (option === '--output') {
      input.output = value
    }
    else {
      throw new Error(`Unknown option ${option}.`)
    }
  }
  if (!input.targets.length) {
    throw new Error('At least one --target name=https://host/path is required.')
  }
  if (new Set(input.targets.map(target => target.name)).size !== input.targets.length) {
    throw new Error('Measurement target names must be unique.')
  }
  if (!Number.isInteger(input.rounds) || input.rounds < 2 || input.rounds > 10) {
    throw new Error('--rounds must be an integer between 2 and 10.')
  }
  validateLoadProbeOptions({
    allow: input.allowLoadProbe,
    concurrency: input.concurrency,
    requests: input.loadRequests,
  })
  if (input.loadTarget && !input.targets.some(target => target.name === input.loadTarget)) {
    throw new Error(`Unknown --load-target ${input.loadTarget}.`)
  }
  return input
}

async function measureResponse(target, round) {
  const startedAt = performance.now()
  const response = await fetch(target.url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,image/avif,image/webp,image/*;q=0.8,*/*;q=0.5',
      'user-agent': 'DiteDog-Production-Baseline/1.0',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  })
  const body = await response.arrayBuffer()
  const durationMs = performance.now() - startedAt
  return {
    observation: round === 0 ? 'first-observed' : 'repeat-observed',
    round: round + 1,
    status: response.status,
    ok: response.ok,
    responseBytes: body.byteLength,
    durationMs: Math.round(durationMs * 100) / 100,
    finalUrl: new URL(response.url).origin + new URL(response.url).pathname,
    cacheEvidenceHeaders: selectEvidenceHeaders(response.headers),
  }
}

async function verifyHttpsRedirect(target) {
  const httpUrl = new URL(target.url)
  httpUrl.protocol = 'http:'
  httpUrl.port = '80'
  const response = await fetch(httpUrl, {
    redirect: 'manual',
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  })
  const location = response.headers.get('location')
  let safeLocation = null
  let exactHttpsRedirect = false
  if (location) {
    const resolved = new URL(location, httpUrl)
    safeLocation = resolved.origin + resolved.pathname
    exactHttpsRedirect = [301, 302, 307, 308].includes(response.status)
      && resolved.protocol === 'https:'
      && resolved.hostname === target.url.hostname
      && resolved.pathname === target.url.pathname
  }
  await response.body?.cancel()
  return {
    status: response.status,
    location: safeLocation,
    exactHttpsRedirect,
  }
}

function inspectCertificate(hostname) {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname })
    const timeout = setTimeout(() => {
      socket.destroy(new Error('TLS inspection timed out.'))
    }, DEFAULT_TIMEOUT_MS)
    socket.once('secureConnect', () => {
      clearTimeout(timeout)
      const certificate = socket.getPeerCertificate()
      const result = {
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ?? null,
        host: hostname,
        issuerCommonName: certificate.issuer?.CN ?? null,
        subjectCommonName: certificate.subject?.CN ?? null,
        validFrom: certificate.valid_from ?? null,
        validTo: certificate.valid_to ?? null,
      }
      socket.end()
      resolvePromise(result)
    })
    socket.once('error', (error) => {
      clearTimeout(timeout)
      rejectPromise(error)
    })
  })
}

async function runLoadProbe(target, requests, concurrency) {
  const samples = []
  let next = 0
  const startedAtMs = performance.now()
  async function worker() {
    while (next < requests) {
      next += 1
      const requestStartedAtMs = performance.now()
      let ok
      try {
        const response = await fetch(target.url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        })
        ok = response.ok
        await response.body?.cancel()
      }
      catch {
        ok = false
      }
      const completedAtMs = performance.now()
      samples.push({
        completedAtMs,
        durationMs: completedAtMs - requestStartedAtMs,
        ok,
      })
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return summarizeLoadProbe(samples, startedAtMs, performance.now())
}

async function main() {
  const input = parseArguments(process.argv.slice(2))
  const timestamp = new Date().toISOString()
  const targets = []
  for (const target of input.targets) {
    const observations = []
    for (let round = 0; round < input.rounds; round += 1) {
      observations.push(await measureResponse(target, round))
    }
    targets.push({
      name: target.name,
      url: target.url.origin + target.url.pathname,
      observations,
      httpsRedirect: await verifyHttpsRedirect(target),
    })
  }

  const certificates = []
  for (const hostname of new Set(input.targets.map(target => target.url.hostname))) {
    certificates.push(await inspectCertificate(hostname))
  }

  const loadTarget = input.targets.find(target => target.name === input.loadTarget)
    ?? input.targets[0]
  const artifact = {
    schemaVersion: 1,
    capturedAt: timestamp,
    operatorWarning: 'This artifact contains first/repeat observations. Treat the first observation as cold only when separate purge or fresh-object evidence proves that condition.',
    secretAndQueryDataRecorded: false,
    thresholdsCalibrated: false,
    targets,
    certificates,
    loadProbe: input.loadRequests > 0
      ? {
          authorized: true,
          target: loadTarget.name,
          concurrency: input.concurrency,
          ...await runLoadProbe(loadTarget, input.loadRequests, input.concurrency),
        }
      : {
          authorized: false,
          target: null,
          result: null,
        },
  }
  const safeTimestamp = timestamp.replaceAll(':', '-').replaceAll('.', '-')
  const output = resolve(input.output ?? `.data/production-baseline-${safeTimestamp}.json`)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, { flag: 'wx' })
  process.stdout.write(`Production baseline measurement PASS: ${output}\n`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown measurement failure.'
  process.stderr.write(`Production baseline measurement FAIL: ${message}\n`)
  process.exitCode = 1
})
