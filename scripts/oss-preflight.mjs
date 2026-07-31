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
import { parseArgs } from 'node:util'
import OSS from 'ali-oss'
import {
  compressPngForOss,
  OSS_IMAGE_PROCESSING_MAX_BYTES,
} from './embedded-ffmpeg.mjs'
import {
  assertExactObjectScope,
  contentDigests,
  createLargeSyntheticPng,
  createRunId,
  createSyntheticWatermarkPng,
  evaluateCorsRules,
  EXPECTED_PRIVATE_BUCKET,
  EXPECTED_PUBLIC_BUCKET,
  ORIGINAL_IMAGE_MAX_BYTES,
  ossErrorSummary,
  parseImageInfo,
  requestIdOf,
  REQUIRED_PUT_HEADERS,
  responseHeader,
  sha256,
  testPrefixFor,
  urlSafeBase64,
} from './oss-preflight-core.mjs'

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
)
const EXPECTED_ENDPOINT = 'https://oss-cn-hangzhou.aliyuncs.com'
const EXPECTED_REGION = 'oss-cn-hangzhou'
const PNG_CONTENT_TYPE = 'image/png'
const PROCESS_OUTPUT_TYPE = 'image/webp'

function parseArguments(argv) {
  return parseArgs({
    args: argv,
    options: {
      evidence: { type: 'string' },
      origin: { type: 'string' },
      'run-id': { type: 'string' },
    },
    strict: true,
  }).values
}

function nonEmpty(value) {
  const normalized = typeof value === 'string'
    ? value.trim()
    : ''

  return normalized || undefined
}

function loadLocalValues() {
  const explicit = nonEmpty(process.env.APP_CONFIG_FILE)
  const defaultPath = resolve(projectRoot, 'config/runtime.local.json')
  const path = explicit
    ? resolve(projectRoot, explicit)
    : existsSync(defaultPath)
      ? defaultPath
      : undefined

  if (!path) {
    return {}
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8'))

  if (
    parsed?.schemaVersion !== 1
    || typeof parsed.values !== 'object'
    || parsed.values === null
  ) {
    throw new Error('Local runtime configuration does not match schema version 1.')
  }

  return parsed.values
}

function loadPreflightConfig(arguments_) {
  const envFile = resolve(projectRoot, '.env')

  if (existsSync(envFile)) {
    loadEnvFile(envFile)
  }

  const localValues = loadLocalValues()
  const value = (environmentName, fileKey, fallback) => (
    nonEmpty(process.env[environmentName])
    ?? nonEmpty(localValues[fileKey])
    ?? fallback
  )
  const config = {
    region: value('OSS_REGION', 'ossRegion'),
    endpoint: value('OSS_ENDPOINT', 'ossEndpoint'),
    privateBucket: value('OSS_PRIVATE_BUCKET', 'ossPrivateBucket'),
    publicBucket: value('OSS_PUBLIC_BUCKET', 'ossPublicBucket'),
    accessKeyId: value('OSS_ACCESS_KEY_ID', 'ossAccessKeyId'),
    accessKeySecret: value(
      'OSS_ACCESS_KEY_SECRET',
      'ossAccessKeySecret',
    ),
    browserOrigin: arguments_.origin
      ?? value('ADMIN_BASE_URL', 'adminBaseUrl'),
  }
  const missing = Object.entries(config)
    .filter(([, configured]) => !configured)
    .map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(`Missing T10 preflight configuration: ${missing.join(', ')}`)
  }

  if (config.privateBucket !== EXPECTED_PRIVATE_BUCKET) {
    throw new Error('OSS_PRIVATE_BUCKET does not match the T10 private Bucket.')
  }

  if (config.publicBucket !== EXPECTED_PUBLIC_BUCKET) {
    throw new Error('OSS_PUBLIC_BUCKET does not match the T10 public Bucket.')
  }

  if (config.region !== EXPECTED_REGION) {
    throw new Error('OSS_REGION does not match the T10 Hangzhou Region.')
  }

  if (config.privateBucket === config.publicBucket) {
    throw new Error('T10 requires two distinct OSS Buckets.')
  }

  const endpoint = new URL(config.endpoint)
  const origin = new URL(config.browserOrigin)

  if (
    endpoint.protocol !== 'https:'
    || endpoint.pathname !== '/'
    || endpoint.search
    || endpoint.hash
    || endpoint.username
    || endpoint.password
  ) {
    throw new Error('OSS_ENDPOINT must be a credential-free HTTPS origin.')
  }

  if (endpoint.origin !== EXPECTED_ENDPOINT) {
    throw new Error('OSS_ENDPOINT does not match the T10 Hangzhou endpoint.')
  }

  if (origin.username || origin.password || origin.pathname !== '/') {
    throw new Error('The browser origin must be a credential-free origin.')
  }

  return {
    ...config,
    endpoint: endpoint.origin,
    browserOrigin: origin.origin,
  }
}

function createClient(config, bucket) {
  return new OSS({
    region: config.region,
    endpoint: config.endpoint,
    bucket,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    authorizationV4: true,
    secure: true,
    timeout: 120_000,
  })
}

function addCheck(evidence, name, status, summary = {}) {
  evidence.checks.push({
    ...summary,
    name,
    status,
  })
}

async function getCors(client, bucket) {
  try {
    const result = await client.getBucketCORS(bucket)

    return {
      rules: result.rules,
      requestId: requestIdOf(result),
      status: result.res?.status ?? 200,
    }
  }
  catch (error) {
    const summary = ossErrorSummary(error)

    if (summary.status === 404 && summary.code === 'NoSuchCORSConfiguration') {
      return {
        rules: [],
        requestId: summary.requestId,
        status: 404,
      }
    }

    throw error
  }
}

function objectUrl(client, key) {
  return new URL(client._objectUrl(key))
}

async function readOnlyGate({
  config,
  evidence,
  privateClient,
  publicClient,
}) {
  const [privateInfo, publicInfo] = await Promise.all([
    privateClient.getBucketInfo(config.privateBucket),
    publicClient.getBucketInfo(config.publicBucket),
  ])
  const privateBucket = privateInfo.bucket
  const publicBucket = publicInfo.bucket
  const sameOwner = nonEmpty(privateBucket.Owner?.ID)
    && privateBucket.Owner?.ID === publicBucket.Owner?.ID
  const sameRegion = privateBucket.Location === publicBucket.Location
    && privateBucket.Location === config.region
  const endpointHost = new URL(config.endpoint).host
  const endpointMatches = [
    privateBucket.ExtranetEndpoint,
    publicBucket.ExtranetEndpoint,
  ].every(endpoint => endpoint === endpointHost)
  const privateBlockEnabled = String(
    privateBucket.BlockPublicAccess,
  ) === 'true'
  const publicBlockEnabled = String(
    publicBucket.BlockPublicAccess,
  ) === 'true'

  addCheck(evidence, 'bucket-identities', (
    privateBucket.Name === config.privateBucket
    && publicBucket.Name === config.publicBucket
  ) ? 'pass' : 'fail', {
    privateStatus: privateInfo.res?.status,
    publicStatus: publicInfo.res?.status,
    requestIds: [
      requestIdOf(privateInfo),
      requestIdOf(publicInfo),
    ],
  })
  addCheck(evidence, 'same-account', sameOwner ? 'pass' : 'fail')
  addCheck(evidence, 'same-region', sameRegion ? 'pass' : 'fail', {
    configuredRegion: config.region,
    observedPrivateRegion: privateBucket.Location,
    observedPublicRegion: publicBucket.Location,
  })
  addCheck(evidence, 'endpoint', endpointMatches ? 'pass' : 'fail', {
    configuredEndpointOrigin: config.endpoint,
    endpointMatchesBucketInfo: endpointMatches,
  })
  addCheck(
    evidence,
    'private-bucket-acl',
    privateBucket.AccessControlList?.Grant === 'private' ? 'pass' : 'fail',
    { observedAcl: privateBucket.AccessControlList?.Grant },
  )
  addCheck(
    evidence,
    'public-bucket-acl',
    publicBucket.AccessControlList?.Grant === 'public-read'
      ? 'pass'
      : 'warn',
    {
      observedAcl: publicBucket.AccessControlList?.Grant,
      note: 'A private ACL requires an equally precise anonymous GetObject Bucket policy for the generated test/web object.',
    },
  )

  const privateCors = await getCors(privateClient, config.privateBucket)

  addCheck(
    evidence,
    'private-block-public-access',
    privateBlockEnabled ? 'pass' : 'fail',
    {
      enabled: privateBlockEnabled,
      responseStatus: privateInfo.res?.status,
      requestId: requestIdOf(privateInfo),
    },
  )
  addCheck(
    evidence,
    'public-anonymous-read-prerequisite',
    publicBlockEnabled ? 'fail' : 'pass',
    {
      enabled: publicBlockEnabled,
      responseStatus: publicInfo.res?.status,
      requestId: requestIdOf(publicInfo),
      note: publicBlockEnabled
        ? 'Bucket-level Block Public Access prevents the required anonymous derivative GET.'
        : 'The generated object still must pass an anonymous GET after sys/saveas.',
    },
  )

  const cors = evaluateCorsRules(privateCors.rules, {
    origin: config.browserOrigin,
  })
  addCheck(
    evidence,
    'private-bucket-cors',
    cors.sufficient ? 'pass' : 'fail',
    {
      ...cors,
      browserOrigin: config.browserOrigin,
      requiredMethod: 'PUT',
      requiredHeaders: REQUIRED_PUT_HEADERS,
      requestId: privateCors.requestId,
      responseStatus: privateCors.status,
    },
  )

  return !evidence.checks.some(check => check.status === 'fail')
}

function consoleActionsFor(evidence) {
  const failed = new Set(
    evidence.checks
      .filter(check => check.status === 'fail')
      .map(check => check.name),
  )
  const actions = []

  if (failed.has('private-bucket-cors')) {
    actions.push({
      target: EXPECTED_PRIVATE_BUCKET,
      location: 'OSS 控制台 > 权限控制 > 跨域设置',
      change: '新增一条精确 CORS 规则',
      values: {
        allowedOrigin: evidence.config.browserOrigin,
        allowedMethods: ['PUT'],
        allowedHeaders: REQUIRED_PUT_HEADERS,
        exposeHeaders: [
          'ETag',
          'x-oss-request-id',
        ],
      },
      rollback: '删除本次新增的这条 CORS 规则',
    })
  }

  if (failed.has('public-anonymous-read-prerequisite')) {
    actions.push({
      target: EXPECTED_PUBLIC_BUCKET,
      location: 'OSS 控制台 > 权限控制',
      change: '仅关闭公开 Bucket 的 Bucket 级 Block Public Access，并将匿名 GetObject 限定到网页衍生对象；不得改动私有 Bucket',
      preferredBoundary: '公开 Bucket ACL 设为 public-read，且继续只允许应用写入 web/ 与 test/<run-id>/web/ 衍生对象；或使用等价的精确匿名 GetObject Bucket Policy',
      rollback: '恢复公开 Bucket 原 ACL/Policy，并重新开启其 Bucket 级 Block Public Access',
    })
  }

  return actions
}

async function browserOptionsCheck({
  client,
  evidence,
  key,
  origin,
}) {
  const response = await fetch(objectUrl(client, key), {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': REQUIRED_PUT_HEADERS.join(','),
    },
    redirect: 'manual',
  })
  const allowedOrigin = response.headers.get('access-control-allow-origin')
  const allowedMethods = response.headers
    .get('access-control-allow-methods')
    ?.split(',')
    .map(method => method.trim().toUpperCase()) ?? []
  const passed = response.status >= 200
    && response.status < 300
    && (allowedOrigin === origin || allowedOrigin === '*')
    && allowedMethods.includes('PUT')

  addCheck(
    evidence,
    'browser-options-conditional-put',
    passed ? 'pass' : 'fail',
    {
      status: response.status,
      allowedOriginMatches: allowedOrigin === origin,
      wildcardOrigin: allowedOrigin === '*',
      putAllowed: allowedMethods.includes('PUT'),
      requestId: response.headers.get('x-oss-request-id'),
    },
  )

  if (!passed) {
    throw new Error('Browser OPTIONS preflight did not allow the conditional PUT.')
  }
}

async function v4Put({
  client,
  content,
  contentType,
  digests,
  key,
}) {
  const headers = {
    'Content-MD5': digests.md5Base64,
    'Content-Type': contentType,
    'x-oss-forbid-overwrite': 'true',
    'x-oss-meta-sha256': digests.sha256,
  }
  const signedUrl = await client.signatureUrlV4(
    'PUT',
    300,
    { headers },
    key,
  )
  const response = await fetch(signedUrl, {
    method: 'PUT',
    headers,
    body: content,
    redirect: 'manual',
  })

  return {
    response,
    signedUrl,
  }
}

function responseCode(content) {
  return content.match(/<Code>([^<]+)<\/Code>/u)?.[1] ?? null
}

async function verifyV4Put({
  client,
  content,
  contentType,
  digests,
  evidence,
  key,
  label,
}) {
  const first = await v4Put({
    client,
    content,
    contentType,
    digests,
    key,
  })

  if (!first.response.ok) {
    const code = responseCode(await first.response.text())
    const error = new Error('V4 conditional PUT failed.')
    error.code = code ?? 'V4PutFailed'
    error.status = first.response.status
    error.requestId = first.response.headers.get('x-oss-request-id')
    throw error
  }

  addCheck(evidence, `${label}-v4-put`, 'pass', {
    status: first.response.status,
    bytes: content.length,
    contentType,
    contentMd5Pinned: true,
    sha256MetadataPinned: true,
    forbidOverwritePinned: true,
    signatureVersion: new URL(first.signedUrl)
      .searchParams.get('x-oss-signature-version'),
    requestId: first.response.headers.get('x-oss-request-id'),
  })

  return first
}

async function verifyOverwriteRejected({
  client,
  content,
  contentType,
  digests,
  evidence,
  key,
}) {
  const repeated = await v4Put({
    client,
    content,
    contentType,
    digests,
    key,
  })
  const code = responseCode(await repeated.response.text())
  const passed = repeated.response.status === 409
    && code === 'FileAlreadyExists'

  addCheck(
    evidence,
    'source-overwrite-rejected',
    passed ? 'pass' : 'fail',
    {
      status: repeated.response.status,
      code,
      requestId: repeated.response.headers.get('x-oss-request-id'),
    },
  )

  if (!passed) {
    throw new Error('x-oss-forbid-overwrite did not reject the repeated PUT.')
  }
}

async function verifyHead({
  client,
  digests,
  evidence,
  expectedBytes,
  expectedContentType,
  key,
  label,
}) {
  const result = await client.head(key)
  const observedBytes = Number(responseHeader(result, 'content-length'))
  const observedContentType = responseHeader(result, 'content-type')
  const observedEtag = responseHeader(result, 'etag')
    ?.replaceAll('"', '')
    .toLowerCase()
  const metadataMatches = digests
    ? result.meta?.sha256 === digests.sha256
    : true
  const passed = result.status === 200
    && observedBytes === expectedBytes
    && observedContentType === expectedContentType
    && metadataMatches
    && (!digests || observedEtag === digests.md5Hex)

  addCheck(evidence, `${label}-head`, passed ? 'pass' : 'fail', {
    status: result.status,
    bytes: observedBytes,
    contentType: observedContentType,
    etagMatchesMd5: digests ? observedEtag === digests.md5Hex : null,
    sha256MetadataMatches: digests ? metadataMatches : null,
    requestId: requestIdOf(result),
  })

  if (!passed) {
    throw new Error(`${label} HEAD validation failed.`)
  }

  return result
}

async function imageInfo(client, key) {
  const result = await client.get(key, {
    process: 'image/info',
  })

  return {
    info: parseImageInfo(result.content),
    requestId: requestIdOf(result),
    status: result.res?.status,
  }
}

async function signedGet(client, key) {
  const signedUrl = await client.signatureUrlV4(
    'GET',
    60,
    undefined,
    key,
  )
  const response = await fetch(signedUrl, {
    redirect: 'manual',
  })

  if (!response.ok) {
    const error = new Error('Signed GET failed.')
    error.code = 'SignedGetFailed'
    error.status = response.status
    error.requestId = response.headers.get('x-oss-request-id')
    throw error
  }

  return {
    content: Buffer.from(await response.arrayBuffer()),
    requestId: response.headers.get('x-oss-request-id'),
    status: response.status,
  }
}

async function anonymousGet(client, key) {
  const response = await fetch(objectUrl(client, key), {
    redirect: 'manual',
  })

  return {
    content: response.ok
      ? Buffer.from(await response.arrayBuffer())
      : Buffer.alloc(0),
    contentType: response.headers.get('content-type'),
    requestId: response.headers.get('x-oss-request-id'),
    status: response.status,
  }
}

async function waitForHead(client, key) {
  let lastError

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await client.head(key)
    }
    catch (error) {
      lastError = error
      const summary = ossErrorSummary(error)

      if (summary.status !== 404) {
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

async function exactCleanup({
  evidence,
  objects,
  prefix,
  privateClient,
  publicClient,
}) {
  const clients = {
    [EXPECTED_PRIVATE_BUCKET]: privateClient,
    [EXPECTED_PUBLIC_BUCKET]: publicClient,
  }
  let passed = true

  for (const object of [...objects].reverse()) {
    try {
      assertExactObjectScope({
        bucket: object.bucket,
        expectedBucket: object.bucket,
        key: object.key,
        prefix,
      })
      const result = await clients[object.bucket].delete(object.key)
      const entry = evidence.objects.find(candidate => (
        candidate.bucket === object.bucket
        && candidate.key === object.key
      ))

      if (entry) {
        entry.cleanup = {
          status: 'deleted',
          requestId: requestIdOf(result),
        }
      }
    }
    catch (error) {
      passed = false
      const entry = evidence.objects.find(candidate => (
        candidate.bucket === object.bucket
        && candidate.key === object.key
      ))

      if (entry) {
        entry.cleanup = {
          status: 'failed',
          error: ossErrorSummary(error),
        }
      }
    }
  }

  for (const object of objects) {
    try {
      await clients[object.bucket].head(object.key)
      passed = false
    }
    catch (error) {
      const summary = ossErrorSummary(error)

      if (summary.status !== 404) {
        passed = false
      }
    }
  }

  addCheck(
    evidence,
    'exact-object-cleanup',
    passed ? 'pass' : 'fail',
    {
      objectCount: objects.length,
      fullPrefixRechecked: prefix,
      bucketNamesRechecked: [
        EXPECTED_PRIVATE_BUCKET,
        EXPECTED_PUBLIC_BUCKET,
      ],
      usedObjectListing: false,
    },
  )

  return passed
}

async function writeEvidence(path, evidence) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(
    path,
    `${JSON.stringify(evidence, null, 2)}\n`,
    {
      encoding: 'utf8',
      flag: 'wx',
    },
  )
}

async function main() {
  const startedAt = new Date()
  let arguments_

  try {
    arguments_ = parseArguments(process.argv.slice(2))
  }
  catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
    return
  }

  const runId = arguments_['run-id'] ?? createRunId(startedAt)
  const prefix = testPrefixFor(runId)
  const evidencePath = resolve(
    projectRoot,
    arguments_.evidence
      ?? `test-results/oss-preflight/${runId}.json`,
  )
  let config

  try {
    config = loadPreflightConfig(arguments_)
  }
  catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
    return
  }

  const evidence = {
    schemaVersion: 1,
    task: 'T10',
    extGate: 'EXT-02',
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    status: 'running',
    testPrefix: prefix,
    config: {
      environment: 'test',
      region: config.region,
      endpointOrigin: config.endpoint,
      privateBucket: config.privateBucket,
      publicBucket: config.publicBucket,
      browserOrigin: config.browserOrigin,
      credentialsPresent: true,
      credentialsRecorded: false,
    },
    checks: [],
    objects: [],
    consoleActions: [],
    failure: null,
  }
  const privateClient = createClient(config, config.privateBucket)
  const publicClient = createClient(config, config.publicBucket)
  const objectManifest = [
    {
      bucket: config.privateBucket,
      key: `${prefix}private/limit-29360568.png`,
      role: 'synthetic-large-upload-boundary',
    },
    {
      bucket: config.privateBucket,
      key: `${prefix}private/processing-source.png`,
      role: 'embedded-ffmpeg-processing-source',
    },
    {
      bucket: config.privateBucket,
      key: `${prefix}private/watermark-logo.png`,
      role: 'synthetic-watermark-source',
    },
    {
      bucket: config.publicBucket,
      key: `${prefix}web/processed-watermarked.webp`,
      role: 'public-watermarked-derivative',
    },
  ]

  evidence.objects = objectManifest.map(object => ({
    ...object,
    generated: false,
    verified: false,
    cleanup: {
      status: 'not-created',
    },
  }))

  try {
    const gatePassed = await readOnlyGate({
      config,
      evidence,
      privateClient,
      publicClient,
    })

    if (!gatePassed) {
      evidence.status = 'blocked'
      evidence.consoleActions = consoleActionsFor(evidence)
      addCheck(evidence, 'write-phase', 'skip', {
        reason: 'Read-only configuration gate failed; no OSS objects were written.',
      })
      process.exitCode = 2
      return
    }

    for (const object of objectManifest) {
      assertExactObjectScope({
        bucket: object.bucket,
        expectedBucket: object.bucket,
        key: object.key,
        prefix,
      })
    }

    const largeObject = objectManifest[0]
    const sourceObject = objectManifest[1]
    const watermarkObject = objectManifest[2]
    const outputObject = objectManifest[3]

    await browserOptionsCheck({
      client: privateClient,
      evidence,
      key: largeObject.key,
      origin: config.browserOrigin,
    })

    const largeSource = createLargeSyntheticPng()
    const localCompression = compressPngForOss(largeSource)
    const source = localCompression.content
    const watermark = createSyntheticWatermarkPng()
    const largeSourceDigests = contentDigests(largeSource)
    const sourceDigests = contentDigests(source)
    const watermarkDigests = contentDigests(watermark)

    if (largeSource.length > ORIGINAL_IMAGE_MAX_BYTES) {
      throw new Error('Synthetic source exceeds 30,000,000 bytes.')
    }

    if (source.length > OSS_IMAGE_PROCESSING_MAX_BYTES) {
      throw new Error('Embedded FFmpeg output exceeds the OSS 20 MB image-processing limit.')
    }

    addCheck(evidence, 'embedded-ffmpeg-local-compression', 'pass', {
      inputBytes: largeSource.length,
      outputBytes: source.length,
      outputContentType: localCompression.contentType,
      outputDimensions: localCompression.dimensions,
      ossImageProcessingLimitBytes: OSS_IMAGE_PROCESSING_MAX_BYTES,
      binary: localCompression.binary,
      developmentCompressionParametersAreFinal: false,
    })

    evidence.objects[0].cleanup.status = 'pending'
    await verifyV4Put({
      client: privateClient,
      content: largeSource,
      contentType: PNG_CONTENT_TYPE,
      digests: largeSourceDigests,
      evidence,
      key: largeObject.key,
      label: 'large-source',
    })
    evidence.objects[0].generated = true
    evidence.objects[0].bytes = largeSource.length
    evidence.objects[0].sha256 = largeSourceDigests.sha256

    await verifyOverwriteRejected({
      client: privateClient,
      content: largeSource,
      contentType: PNG_CONTENT_TYPE,
      digests: largeSourceDigests,
      evidence,
      key: largeObject.key,
    })

    evidence.objects[1].cleanup.status = 'pending'
    await verifyV4Put({
      client: privateClient,
      content: source,
      contentType: localCompression.contentType,
      digests: sourceDigests,
      evidence,
      key: sourceObject.key,
      label: 'processing-source',
    })
    evidence.objects[1].generated = true
    evidence.objects[1].bytes = source.length
    evidence.objects[1].sha256 = sourceDigests.sha256

    evidence.objects[2].cleanup.status = 'pending'
    await verifyV4Put({
      client: privateClient,
      content: watermark,
      contentType: PNG_CONTENT_TYPE,
      digests: watermarkDigests,
      evidence,
      key: watermarkObject.key,
      label: 'watermark-source',
    })
    evidence.objects[2].generated = true
    evidence.objects[2].bytes = watermark.length
    evidence.objects[2].sha256 = watermarkDigests.sha256

    await verifyHead({
      client: privateClient,
      digests: largeSourceDigests,
      evidence,
      expectedBytes: largeSource.length,
      expectedContentType: PNG_CONTENT_TYPE,
      key: largeObject.key,
      label: 'private-large-source',
    })

    const largeInfo = await imageInfo(privateClient, largeObject.key)
    const largeInfoPassed = largeInfo.status === 200
      && largeInfo.info.width === 9_500
      && largeInfo.info.height === 1_030
      && largeInfo.info.fileSize === largeSource.length
      && largeInfo.info.format?.toLowerCase() === 'png'

    addCheck(
      evidence,
      'private-large-source-image-info',
      largeInfoPassed ? 'pass' : 'fail',
      {
        ...largeInfo.info,
        status: largeInfo.status,
        requestId: largeInfo.requestId,
      },
    )

    if (!largeInfoPassed) {
      throw new Error('OSS image/info did not match the large synthetic source.')
    }

    await verifyHead({
      client: privateClient,
      digests: sourceDigests,
      evidence,
      expectedBytes: source.length,
      expectedContentType: localCompression.contentType,
      key: sourceObject.key,
      label: 'private-processing-source',
    })

    const sourceInfo = await imageInfo(privateClient, sourceObject.key)
    const sourceInfoPassed = sourceInfo.status === 200
      && sourceInfo.info.width === localCompression.dimensions.width
      && sourceInfo.info.height === localCompression.dimensions.height
      && sourceInfo.info.fileSize === source.length
      && sourceInfo.info.format?.toLowerCase() === 'png'

    addCheck(
      evidence,
      'private-processing-source-image-info',
      sourceInfoPassed ? 'pass' : 'fail',
      {
        ...sourceInfo.info,
        status: sourceInfo.status,
        requestId: sourceInfo.requestId,
      },
    )

    if (!sourceInfoPassed) {
      throw new Error('OSS image/info did not match the synthetic source.')
    }

    const anonymousPrivate = await anonymousGet(
      privateClient,
      sourceObject.key,
    )
    const anonymousPrivatePassed = anonymousPrivate.status === 403

    addCheck(
      evidence,
      'private-anonymous-get',
      anonymousPrivatePassed ? 'pass' : 'fail',
      {
        status: anonymousPrivate.status,
        requestId: anonymousPrivate.requestId,
      },
    )

    if (!anonymousPrivatePassed) {
      throw new Error('Private source was not rejected for anonymous GET.')
    }

    const unwatermarkedProcess = 'image/resize,w_1600/format,webp'
    const unwatermarked = await privateClient.get(sourceObject.key, {
      process: unwatermarkedProcess,
    })
    const unwatermarkedHash = sha256(unwatermarked.content)
    const watermarkReference = urlSafeBase64(watermarkObject.key)
    const watermarkedProcess = [
      'image/resize,w_1600',
      `watermark,image_${watermarkReference},t_70,g_se,x_24,y_24`,
      'format,webp',
    ].join('/')

    evidence.objects[3].cleanup.status = 'pending'
    const processResult = await privateClient.processObjectSave(
      sourceObject.key,
      outputObject.key,
      watermarkedProcess,
      config.publicBucket,
    )
    await waitForHead(publicClient, outputObject.key)
    evidence.objects[3].generated = true

    addCheck(
      evidence,
      'watermark-resize-format-sys-saveas',
      processResult.status === 200 ? 'pass' : 'fail',
      {
        status: processResult.status,
        processOperations: [
          'resize',
          'image-watermark',
          'format-webp',
          'cross-bucket-sys-saveas',
        ],
        developmentWatermarkParametersAreFinal: false,
        requestId: requestIdOf(processResult),
      },
    )

    if (processResult.status !== 200) {
      throw new Error('OSS sys/saveas processing failed.')
    }

    const outputHead = await publicClient.head(outputObject.key)
    const outputBytes = Number(responseHeader(outputHead, 'content-length'))

    await verifyHead({
      client: publicClient,
      evidence,
      expectedBytes: outputBytes,
      expectedContentType: PROCESS_OUTPUT_TYPE,
      key: outputObject.key,
      label: 'public-output',
    })

    const outputInfo = await imageInfo(publicClient, outputObject.key)
    const outputInfoPassed = outputInfo.status === 200
      && outputInfo.info.width === 1_600
      && outputInfo.info.format?.toLowerCase() === 'webp'

    addCheck(
      evidence,
      'public-output-image-info',
      outputInfoPassed ? 'pass' : 'fail',
      {
        ...outputInfo.info,
        status: outputInfo.status,
        requestId: outputInfo.requestId,
      },
    )

    if (!outputInfoPassed) {
      throw new Error('Public output image/info validation failed.')
    }

    const anonymousPublic = await anonymousGet(publicClient, outputObject.key)
    const outputHash = sha256(anonymousPublic.content)
    const anonymousPublicPassed = anonymousPublic.status === 200
      && anonymousPublic.contentType === PROCESS_OUTPUT_TYPE
      && anonymousPublic.content.length === outputBytes
      && outputHash !== unwatermarkedHash

    addCheck(
      evidence,
      'public-anonymous-get-and-watermark-effect',
      anonymousPublicPassed ? 'pass' : 'fail',
      {
        status: anonymousPublic.status,
        contentType: anonymousPublic.contentType,
        bytes: anonymousPublic.content.length,
        differsFromUnwatermarkedTransform: outputHash !== unwatermarkedHash,
        requestId: anonymousPublic.requestId,
      },
    )

    if (!anonymousPublicPassed) {
      throw new Error('Public anonymous GET or watermark effect validation failed.')
    }

    const [largeOriginalAfterProcessing, processingSourceAfterProcessing]
      = await Promise.all([
        signedGet(privateClient, largeObject.key),
        signedGet(privateClient, sourceObject.key),
      ])
    const largeOriginalUnchanged
      = largeOriginalAfterProcessing.content.length === largeSource.length
        && sha256(largeOriginalAfterProcessing.content)
        === largeSourceDigests.sha256
    const processingSourceUnchanged
      = processingSourceAfterProcessing.content.length === source.length
        && sha256(processingSourceAfterProcessing.content)
        === sourceDigests.sha256

    addCheck(
      evidence,
      'private-large-original-unchanged-after-processing',
      largeOriginalUnchanged ? 'pass' : 'fail',
      {
        status: largeOriginalAfterProcessing.status,
        bytes: largeOriginalAfterProcessing.content.length,
        sha256MatchesOriginal: largeOriginalUnchanged,
        requestId: largeOriginalAfterProcessing.requestId,
      },
    )

    addCheck(
      evidence,
      'private-processing-source-unchanged-after-processing',
      processingSourceUnchanged ? 'pass' : 'fail',
      {
        status: processingSourceAfterProcessing.status,
        bytes: processingSourceAfterProcessing.content.length,
        sha256MatchesOriginal: processingSourceUnchanged,
        requestId: processingSourceAfterProcessing.requestId,
      },
    )

    if (!largeOriginalUnchanged || !processingSourceUnchanged) {
      throw new Error('A private source changed during image processing.')
    }

    evidence.objects[0].verified = true
    evidence.objects[1].verified = true
    evidence.objects[2].verified = true
    evidence.objects[3].verified = true
    evidence.objects[3].bytes = outputBytes
    evidence.objects[3].sha256 = outputHash

    const cleanupPassed = await exactCleanup({
      evidence,
      objects: objectManifest,
      prefix,
      privateClient,
      publicClient,
    })

    if (!cleanupPassed) {
      throw new Error('Exact cleanup verification failed.')
    }

    evidence.status = evidence.checks.every(
      check => ['pass', 'warn'].includes(check.status),
    ) ? 'passed' : 'failed'
    process.exitCode = evidence.status === 'passed' ? 0 : 1
  }
  catch (error) {
    evidence.status = 'failed'
    evidence.failure = ossErrorSummary(error)
    evidence.consoleActions = consoleActionsFor(evidence)

    const cleanupPassed = await exactCleanup({
      evidence,
      objects: objectManifest.filter((object) => {
        const entry = evidence.objects.find(candidate => (
          candidate.bucket === object.bucket
          && candidate.key === object.key
        ))

        return entry?.cleanup.status === 'pending'
      }),
      prefix,
      privateClient,
      publicClient,
    })

    if (!cleanupPassed) {
      evidence.failure.cleanupIncomplete = true
    }

    process.exitCode = 1
  }
  finally {
    evidence.finishedAt = new Date().toISOString()

    try {
      await writeEvidence(evidencePath, evidence)
      const summary = {
        status: evidence.status,
        runId: evidence.runId,
        testPrefix: evidence.testPrefix,
        evidencePath,
        checks: evidence.checks.map(check => ({
          name: check.name,
          status: check.status,
        })),
        consoleActions: evidence.consoleActions,
        secretsRecorded: false,
      }

      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    }
    catch (error) {
      process.stderr.write(`Failed to write redacted evidence: ${error.message}\n`)
      process.exitCode = 1
    }
  }
}

await main()
