import { randomBytes } from 'node:crypto'
import {
  existsSync,
  readFileSync,
} from 'node:fs'
import {
  mkdir,
  writeFile,
} from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import OSS from 'ali-oss'
import {
  contentDigests,
  EXPECTED_PRIVATE_BUCKET,
  EXPECTED_PUBLIC_BUCKET,
  ossErrorSummary,
  parseImageInfo,
  requestIdOf,
  responseHeader,
  sha256,
  urlSafeBase64,
} from './oss-preflight-core.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runId = `gate07-${new Date().toISOString()
  .replaceAll('-', '')
  .replaceAll(':', '')
  .replace(/\.\d{3}Z$/u, 'Z')}-${randomBytes(4).toString('hex')}`
const prefix = `test/${runId}/`
const evidencePath = resolve(
  projectRoot,
  `test-results/oss-watermark/${runId}.json`,
)
const visualEvidenceDirectory = resolve(
  projectRoot,
  `test-results/oss-watermark/${runId}`,
)

function configuredValue(environmentName, fileValues, fileKey) {
  return process.env[environmentName]?.trim()
    || String(fileValues[fileKey] ?? '').trim()
}

function config() {
  const envFile = resolve(projectRoot, '.env')
  if (existsSync(envFile)) {
    loadEnvFile(envFile)
  }
  const localPath = resolve(projectRoot, 'config/runtime.local.json')
  const local = existsSync(localPath)
    ? JSON.parse(readFileSync(localPath, 'utf8')).values ?? {}
    : {}
  const value = (environmentName, fileKey) => configuredValue(
    environmentName,
    local,
    fileKey,
  )
  const result = {
    accessKeyId: value('OSS_ACCESS_KEY_ID', 'ossAccessKeyId'),
    accessKeySecret: value('OSS_ACCESS_KEY_SECRET', 'ossAccessKeySecret'),
    endpoint: value('OSS_ENDPOINT', 'ossEndpoint'),
    privateBucket: value('OSS_PRIVATE_BUCKET', 'ossPrivateBucket'),
    publicBucket: value('OSS_PUBLIC_BUCKET', 'ossPublicBucket'),
    region: value('OSS_REGION', 'ossRegion'),
  }
  if (Object.values(result).some(value_ => !value_)) {
    throw new Error('Missing OSS watermark preflight configuration.')
  }
  if (
    result.privateBucket !== EXPECTED_PRIVATE_BUCKET
    || result.publicBucket !== EXPECTED_PUBLIC_BUCKET
    || result.region !== 'oss-cn-hangzhou'
    || new URL(result.endpoint).origin !== 'https://oss-cn-hangzhou.aliyuncs.com'
  ) {
    throw new Error('OSS watermark preflight configuration is outside the approved buckets or region.')
  }
  return result
}

function client(settings, bucket) {
  return new OSS({
    region: settings.region,
    endpoint: settings.endpoint,
    bucket,
    accessKeyId: settings.accessKeyId,
    accessKeySecret: settings.accessKeySecret,
    authorizationV4: true,
    secure: true,
    timeout: 120_000,
  })
}

function objectUrl(oss, key) {
  return new URL(oss._objectUrl(key))
}

async function waitForHead(oss, key) {
  let lastError
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await oss.head(key)
    }
    catch (error) {
      lastError = error
      if (ossErrorSummary(error).status !== 404) {
        throw error
      }
      await new Promise(resolveTimeout => setTimeout(
        resolveTimeout,
        250 * (attempt + 1),
      ))
    }
  }
  throw lastError
}

async function imageInfo(oss, key) {
  const result = await oss.get(key, { process: 'image/info' })
  return {
    ...parseImageInfo(result.content),
    requestId: requestIdOf(result),
  }
}

async function signedGet(oss, key) {
  const url = await oss.signatureUrlV4('GET', 60, undefined, key)
  const response = await fetch(url, { redirect: 'manual' })
  if (!response.ok) {
    throw Object.assign(new Error('Private signed GET failed.'), {
      status: response.status,
    })
  }
  return Buffer.from(await response.arrayBuffer())
}

async function anonymousGet(oss, key) {
  const response = await fetch(objectUrl(oss, key), { redirect: 'manual' })
  return {
    content: response.ok
      ? Buffer.from(await response.arrayBuffer())
      : Buffer.alloc(0),
    contentType: response.headers.get('content-type'),
    requestId: response.headers.get('x-oss-request-id'),
    status: response.status,
  }
}

async function putPrivate(oss, object, content) {
  const digests = contentDigests(content)
  const result = await oss.put(object.key, content, {
    headers: {
      'Content-MD5': digests.md5Base64,
      'Content-Type': object.contentType,
      'x-oss-forbid-overwrite': 'true',
      'x-oss-meta-sha256': digests.sha256,
    },
  })
  object.created = true
  const head = await oss.head(object.key)
  const preview = await signedGet(oss, object.key)
  const info = await imageInfo(oss, object.key)
  if (
    result.res?.status !== 200
    || Number(responseHeader(head, 'content-length')) !== content.length
    || responseHeader(head, 'content-type') !== object.contentType
    || head.meta?.sha256 !== digests.sha256
    || sha256(preview) !== digests.sha256
    || info.fileSize !== content.length
  ) {
    throw new Error('Private OSS source verification failed.')
  }
  return {
    bytes: content.length,
    dimensions: { width: info.width, height: info.height },
    requestIds: [requestIdOf(result), requestIdOf(head), info.requestId],
    signedPreviewVerified: true,
  }
}

async function processPreview({
  privateClient,
  publicClient,
  publicBucket,
  source,
  watermarkKey,
  output,
  visualEvidenceDirectory,
}) {
  const watermarkReference = urlSafeBase64(
    `${watermarkKey}?x-oss-process=image/resize,P_60`,
  )
  const watermarkOperation = `watermark,image_${watermarkReference},t_50,g_center`
  const process = [
    `image/${output.resize}`,
    watermarkOperation,
    'format,webp',
  ].join('/')
  if (process.includes(',x_') || process.includes(',y_')) {
    throw new Error('Centered watermark process contains forbidden offsets.')
  }
  const unwatermarked = await privateClient.get(source.key, {
    process: `image/${output.resize}/format,webp`,
  })
  const result = await privateClient.processObjectSave(
    source.key,
    output.key,
    process,
    publicBucket,
  )
  output.created = true
  const head = await waitForHead(publicClient, output.key)
  const info = await imageInfo(publicClient, output.key)
  const anonymous = await anonymousGet(publicClient, output.key)
  const bytes = Number(responseHeader(head, 'content-length'))
  if (
    result.status !== 200
    || responseHeader(head, 'content-type') !== 'image/webp'
    || anonymous.status !== 200
    || anonymous.contentType !== 'image/webp'
    || anonymous.content.length !== bytes
    || info.width !== output.width
    || info.height !== output.height
    || sha256(anonymous.content) === sha256(unwatermarked.content)
  ) {
    throw new Error(`OSS centered watermark preview failed for ${output.kind}.`)
  }
  await Promise.all([
    writeFile(
      resolve(visualEvidenceDirectory, `${output.kind}.webp`),
      anonymous.content,
      { flag: 'wx' },
    ),
    writeFile(
      resolve(visualEvidenceDirectory, `${output.kind}-unwatermarked.webp`),
      unwatermarked.content,
      { flag: 'wx' },
    ),
  ])
  return {
    anonymousPublicReadVerified: true,
    bytes,
    dimensions: { width: info.width, height: info.height },
    differsFromUnwatermarked: true,
    kind: output.kind,
    opacityPercent: 50,
    position: 'center',
    requestIds: [requestIdOf(result), requestIdOf(head), anonymous.requestId],
    scalePercent: 60,
    visualEvidence: [
      `${output.kind}.webp`,
      `${output.kind}-unwatermarked.webp`,
    ],
  }
}

async function cleanup(objects, clients) {
  let passed = true
  for (const object of [...objects].reverse()) {
    if (!object.created) {
      continue
    }
    if (!object.key.startsWith(prefix) || object.key.includes('..')) {
      throw new Error('Cleanup key escaped the exact GATE-07 test prefix.')
    }
    try {
      await clients[object.bucket].delete(object.key)
      object.cleaned = true
    }
    catch (error) {
      object.cleanupError = ossErrorSummary(error)
      passed = false
    }
  }
  for (const object of objects.filter(candidate => candidate.created)) {
    try {
      await clients[object.bucket].head(object.key)
      passed = false
    }
    catch (error) {
      if (ossErrorSummary(error).status !== 404) {
        passed = false
      }
    }
  }
  return passed
}

async function main() {
  const evidence = {
    schemaVersion: 1,
    gate: 'GATE-07',
    profile: 'brand-centered-v2',
    runId,
    testPrefix: prefix,
    startedAt: new Date().toISOString(),
    status: 'running',
    checks: [],
    objects: [],
    secretsRecorded: false,
  }
  let settings
  try {
    settings = config()
  }
  catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
    return
  }
  const privateClient = client(settings, settings.privateBucket)
  const publicClient = client(settings, settings.publicBucket)
  const sources = [
    {
      kind: 'studio',
      key: `${prefix}original/studio/source.jpg`,
      content: readFileSync(resolve(
        projectRoot,
        'agent_docs/需求1-兽装工作室主页/materials/picture-examples/领养/小狗/小狗-1.jpg',
      )),
      contentType: 'image/jpeg',
    },
    {
      kind: 'landscape',
      key: `${prefix}original/landscape/source.jpg`,
      content: readFileSync(resolve(
        projectRoot,
        'agent_docs/需求1-兽装工作室主页/materials/picture-examples/领养/小狗/小狗-2-横版.jpg',
      )),
      contentType: 'image/jpeg',
    },
    {
      kind: 'portrait',
      key: `${prefix}original/portrait/source.jpg`,
      content: readFileSync(resolve(
        projectRoot,
        'agent_docs/需求1-兽装工作室主页/materials/picture-examples/领养/小狗/小狗-1.jpg',
      )),
      contentType: 'image/jpeg',
    },
  ].map(source => ({
    ...source,
    bucket: settings.privateBucket,
    cleaned: false,
    created: false,
  }))
  const watermark = {
    bucket: settings.privateBucket,
    cleaned: false,
    created: false,
    key: `${prefix}original/watermark/logo.png`,
    content: readFileSync(resolve(projectRoot, 'public/brand/logo-full-light.png')),
    contentType: 'image/png',
    kind: 'watermark-logo',
  }
  const outputs = [
    {
      kind: 'work-card', source: sources[0],
      resize: 'resize,m_fill,w_480,h_640,g_center', width: 480, height: 640,
    },
    {
      kind: 'detail-original-ratio', source: sources[0],
      resize: 'resize,m_lfit,w_960', width: 960, height: 1440,
    },
    {
      kind: 'home-hero-landscape', source: sources[1],
      resize: 'resize,m_fill,w_768,h_432,g_center', width: 768, height: 432,
    },
    {
      kind: 'home-hero-portrait', source: sources[2],
      resize: 'resize,m_fill,w_480,h_853,g_center', width: 480, height: 853,
    },
  ].map(output => ({
    ...output,
    bucket: settings.publicBucket,
    cleaned: false,
    created: false,
    key: `${prefix}web/${output.kind}.webp`,
  }))
  const objects = [...sources, watermark, ...outputs]
  evidence.objects = objects.map(object => ({
    kind: object.kind,
    scope: object.bucket === settings.privateBucket ? 'PRIVATE' : 'PUBLIC',
  }))
  let executionPassed = false
  try {
    const [privateInfo, publicInfo] = await Promise.all([
      privateClient.getBucketInfo(settings.privateBucket),
      publicClient.getBucketInfo(settings.publicBucket),
    ])
    if (
      privateInfo.bucket.Location !== settings.region
      || publicInfo.bucket.Location !== settings.region
      || privateInfo.bucket.AccessControlList?.Grant !== 'private'
    ) {
      throw new Error('OSS bucket identity or private ACL verification failed.')
    }
    await mkdir(visualEvidenceDirectory, { recursive: true })
    for (const source of [...sources, watermark]) {
      evidence.checks.push({
        name: `private-${source.kind}`,
        status: 'pass',
        ...await putPrivate(privateClient, source, source.content),
      })
    }
    const anonymousPrivate = await anonymousGet(privateClient, sources[0].key)
    if (anonymousPrivate.status !== 403) {
      throw new Error('Private source was anonymously readable.')
    }
    evidence.checks.push({
      name: 'private-anonymous-read-blocked',
      status: 'pass',
      responseStatus: anonymousPrivate.status,
      requestId: anonymousPrivate.requestId,
    })
    for (const output of outputs) {
      evidence.checks.push({
        name: `preview-${output.kind}`,
        status: 'pass',
        ...await processPreview({
          privateClient,
          publicClient,
          publicBucket: settings.publicBucket,
          source: output.source,
          watermarkKey: watermark.key,
          output,
          visualEvidenceDirectory,
        }),
      })
    }
    executionPassed = true
  }
  catch (error) {
    evidence.failure = ossErrorSummary(error)
  }
  const cleanupPassed = await cleanup(objects, {
    [settings.privateBucket]: privateClient,
    [settings.publicBucket]: publicClient,
  })
  evidence.checks.push({
    name: 'exact-object-cleanup',
    status: cleanupPassed ? 'pass' : 'fail',
    objectCount: objects.filter(object => object.created).length,
    usedObjectListing: false,
  })
  evidence.status = executionPassed && cleanupPassed ? 'passed' : 'failed'
  evidence.finishedAt = new Date().toISOString()
  await mkdir(dirname(evidencePath), { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  })
  process.stdout.write(`${JSON.stringify({
    status: evidence.status,
    runId,
    evidencePath,
    checks: evidence.checks.map(check => ({
      name: check.name,
      status: check.status,
    })),
    secretsRecorded: false,
  }, null, 2)}\n`)
  process.exitCode = evidence.status === 'passed' ? 0 : 1
}

await main()
