import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  EsaClient,
  DescribePurgeTasksRequest,
  PurgeCachesRequest,
  PurgeCachesRequestContent,
} from './esa-sdk.mjs'
import OSS from 'ali-oss'
import Database from 'better-sqlite3'
import {
  contentDigests,
  createSyntheticSourcePng,
  requestIdOf,
  responseHeader,
} from './oss-preflight-core.mjs'
import {
  assertProductionTestObject,
  buildExactPurgeInput,
  createProductionPreflightRunId,
  evaluateDerivativeInventory,
  evaluateLifecycleRules,
  evaluateStrictCorsRules,
  exactEsaMediaUrl,
  EXPECTED_PRIVATE_BUCKET,
  fingerprint,
  maskIdentifier,
  productionPreflightError,
  productionPreflightPrefix,
  REQUIRED_PUT_HEADERS,
  safeErrorSummary,
  validateProductionPreflightConfig,
} from './production-preflight-core.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PNG_CONTENT_TYPE = 'image/png'
const WEBP_CONTENT_TYPE = 'image/webp'

function parseArguments(argv) {
  return parseArgs({
    args: argv,
    options: {
      evidence: { type: 'string' },
      'no-dry-run': { type: 'boolean', default: false },
      'run-id': { type: 'string' },
    },
    strict: true,
  }).values
}

function nonEmpty(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
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
    throw productionPreflightError(
      'invalid-local-runtime-config',
      'Local runtime configuration does not match schema version 1.',
    )
  }

  return parsed.values
}

function loadPreflightConfig() {
  const envFile = resolve(projectRoot, '.env')
  if (existsSync(envFile)) {
    loadEnvFile(envFile)
  }

  const localValues = loadLocalValues()
  const value = (environmentName, fileKey) => (
    nonEmpty(process.env[environmentName])
    ?? nonEmpty(localValues[fileKey])
  )

  return validateProductionPreflightConfig({
    appEnv: value('APP_ENV', 'appEnv'),
    databaseFile: value('DATABASE_FILE', 'databaseFile'),
    publicBaseUrl: value('PUBLIC_BASE_URL', 'publicBaseUrl'),
    adminBaseUrl: value('ADMIN_BASE_URL', 'adminBaseUrl'),
    mediaBaseUrl: value('MEDIA_BASE_URL', 'mediaBaseUrl'),
    uploadBaseUrl: value('OSS_UPLOAD_BASE_URL', 'ossUploadBaseUrl'),
    region: value('OSS_REGION', 'ossRegion'),
    endpoint: value('OSS_ENDPOINT', 'ossEndpoint'),
    privateBucket: value('OSS_PRIVATE_BUCKET', 'ossPrivateBucket'),
    publicBucket: value('OSS_PUBLIC_BUCKET', 'ossPublicBucket'),
    accessKeyId: value('OSS_ACCESS_KEY_ID', 'ossAccessKeyId'),
    accessKeySecret: value('OSS_ACCESS_KEY_SECRET', 'ossAccessKeySecret'),
    esaSiteId: value('ESA_SITE_ID', 'esaSiteId'),
    esaApiEndpoint: value('ESA_API_ENDPOINT', 'esaApiEndpoint'),
  })
}

function createOssClient(config, bucket, upload = false) {
  return new OSS({
    region: config.region,
    endpoint: upload ? config.uploadBaseUrl : config.endpoint,
    bucket,
    cname: upload,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    authorizationV4: true,
    secure: true,
    timeout: 120_000,
  })
}

function createEsaClient(config) {
  return new EsaClient({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    endpoint: new URL(config.esaApiEndpoint).hostname,
    protocol: 'HTTPS',
    regionId: 'cn-hangzhou',
    connectTimeout: 10_000,
    readTimeout: 60_000,
  })
}

function addCheck(evidence, name, status, details = {}) {
  evidence.checks.push({
    name,
    status,
    ...(status === 'fail' && !details.reason
      ? { reason: `${name}-failed` }
      : {}),
    ...details,
  })
}

function rawObjectUrl(bucket, key) {
  const encoded = key.split('/').map(encodeURIComponent).join('/')
  return `https://${bucket}.oss-cn-hangzhou.aliyuncs.com/${encoded}`
}

async function optionalBucketCall(call, notConfiguredCodes) {
  try {
    return await call()
  }
  catch (error) {
    const summary = safeErrorSummary(error)
    if (summary.status === 404 || notConfiguredCodes.includes(summary.code)) {
      return null
    }
    throw error
  }
}

async function getPolicyStatus(client, bucket) {
  const parameters = client._bucketRequestParams(
    'GET',
    bucket,
    'policyStatus',
    {},
  )
  parameters.successStatuses = [200]
  parameters.xmlResponse = true
  const result = await client.request(parameters)
  const value = result.data?.PolicyStatus?.IsPublic
    ?? result.data?.IsPublic

  return {
    isPublic: String(value).toLowerCase() === 'true',
    requestId: requestIdOf(result),
  }
}

async function listAllObjects(client) {
  const objects = []
  let continuationToken

  do {
    const result = await client.listV2({
      'max-keys': 1000,
      ...(continuationToken ? { 'continuation-token': continuationToken } : {}),
    })
    objects.push(...(result.objects ?? []))
    continuationToken = result.isTruncated
      ? result.nextContinuationToken
      : undefined
    if (result.isTruncated && !continuationToken) {
      throw productionPreflightError(
        'missing-object-continuation-token',
        'OSS returned a truncated object list without a continuation token.',
      )
    }
  } while (continuationToken)

  return objects
}

async function scanObjectAcls(client, objects) {
  let unsafeCount = 0
  let checkedCount = 0
  const queue = [...objects]
  const workers = Array.from({ length: Math.min(6, queue.length || 1) }, async () => {
    while (queue.length > 0) {
      const object = queue.shift()
      const result = await client.getACL(object.name)
      checkedCount += 1
      if (!['default', 'private'].includes(String(result.acl))) {
        unsafeCount += 1
      }
    }
  })
  await Promise.all(workers)

  return { checkedCount, unsafeCount }
}

function readReadyDerivativeKeys(databaseFile) {
  const database = new Database(databaseFile, {
    fileMustExist: true,
    readonly: true,
  })
  try {
    return database.prepare(`
      SELECT object_key AS objectKey
      FROM asset_variants
      WHERE storage_scope = 'PUBLIC' AND status = 'READY'
      ORDER BY object_key
    `).all().map(row => row.objectKey)
  }
  finally {
    database.close()
  }
}

async function bucketReadGate({
  client,
  bucket,
  adminOrigin,
  evidence,
  readyDerivativeKeys,
}) {
  const [info, acl, policyStatus, policy, cors, lifecycle, objects] = await Promise.all([
    client.getBucketInfo(bucket),
    client.getBucketACL(bucket),
    getPolicyStatus(client, bucket),
    optionalBucketCall(
      () => client.getBucketPolicy(bucket),
      ['NoSuchBucketPolicy'],
    ),
    optionalBucketCall(
      () => client.getBucketCORS(bucket),
      ['NoSuchCORSConfiguration'],
    ),
    optionalBucketCall(
      () => client.getBucketLifecycle(bucket),
      ['NoSuchLifecycle'],
    ),
    listAllObjects(client),
  ])
  const bucketInfo = info.bucket
  const blockPublicAccess = String(bucketInfo.BlockPublicAccess).toLowerCase() === 'true'
  const lifecycleResult = evaluateLifecycleRules(lifecycle?.rules ?? [], bucket)
  const objectAclResult = await scanObjectAcls(client, objects)
  const bucketLabel = bucket === EXPECTED_PRIVATE_BUCKET ? 'private' : 'derivative'

  addCheck(evidence, `${bucketLabel}-bucket-identity`, (
    bucketInfo.Name === bucket
    && bucketInfo.Location === 'oss-cn-hangzhou'
  ) ? 'pass' : 'fail', {
    responseStatus: info.res?.status ?? 200,
    requestId: maskIdentifier(requestIdOf(info) ?? ''),
  })
  addCheck(evidence, `${bucketLabel}-bucket-private-bpa`, (
    acl.acl === 'private' && blockPublicAccess
  ) ? 'pass' : 'fail', {
    acl: acl.acl,
    blockPublicAccess,
  })
  addCheck(evidence, `${bucketLabel}-bucket-policy-private`, (
    policyStatus.isPublic === false
  ) ? 'pass' : 'fail', {
    policyConfigured: Boolean(policy?.policy),
    policyReportsPublic: policyStatus.isPublic,
    requestId: maskIdentifier(policyStatus.requestId ?? ''),
  })
  addCheck(evidence, `${bucketLabel}-object-acls-private`, (
    objectAclResult.unsafeCount === 0
  ) ? 'pass' : 'fail', objectAclResult)
  addCheck(evidence, `${bucketLabel}-lifecycle-safe`, (
    lifecycleResult.safe
  ) ? 'pass' : 'fail', lifecycleResult)

  if (bucket === EXPECTED_PRIVATE_BUCKET) {
    const corsResult = evaluateStrictCorsRules(cors?.rules ?? [], adminOrigin)
    addCheck(evidence, 'private-bucket-cors-exact', (
      corsResult.safe
    ) ? 'pass' : 'fail', corsResult)
  }
  else {
    const inventory = evaluateDerivativeInventory(
      objects.map(object => object.name),
      readyDerivativeKeys,
    )
    addCheck(evidence, 'derivative-inventory-database-boundary', (
      inventory.safe
    ) ? 'pass' : 'fail', inventory)
    addCheck(evidence, 'derivative-bucket-no-cors', (
      (cors?.rules ?? []).length === 0
    ) ? 'pass' : 'fail', {
      ruleCount: (cors?.rules ?? []).length,
    })
  }
}

async function verifyEsaAccess(esaClient, siteId, evidence) {
  const response = await esaClient.describePurgeTasks(
    new DescribePurgeTasksRequest({
      pageNumber: 1,
      pageSize: 1,
      siteId: Number(siteId),
      type: 'file',
    }),
  )
  addCheck(evidence, 'esa-describe-purge-tasks-allowed', (
    response.statusCode === 200
  ) ? 'pass' : 'fail', {
    responseStatus: response.statusCode,
    requestId: maskIdentifier(response.body?.requestId ?? ''),
  })

}

function signedPut(client, key, content, expiresSeconds = 300) {
  const digests = contentDigests(content)
  const headers = {
    'Content-MD5': digests.md5Base64,
    'Content-Type': PNG_CONTENT_TYPE,
    'x-oss-forbid-overwrite': 'true',
    'x-oss-meta-sha256': digests.sha256,
  }

  return client.signatureUrlV4(
    'PUT',
    expiresSeconds,
    { headers },
    key,
  ).then(url => ({ digests, headers, url }))
}

async function checkCorsOptions(url, origin) {
  const response = await fetch(url, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': REQUIRED_PUT_HEADERS.join(','),
    },
    redirect: 'manual',
  })

  return {
    allowedHeaders: response.headers.get('access-control-allow-headers') ?? '',
    allowedOrigin: response.headers.get('access-control-allow-origin'),
    allowedMethods: response.headers.get('access-control-allow-methods') ?? '',
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
      if (Number(error?.status) !== 404) {
        throw error
      }
      await new Promise(resolveTimeout => setTimeout(resolveTimeout, 250 * (attempt + 1)))
    }
  }
  throw lastError
}

async function fetchWithRetry(url, expectedStatus, attempts = 10) {
  let response
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    response = await fetch(url, { redirect: 'manual' })
    if (response.status === expectedStatus) {
      return response
    }
    await response.arrayBuffer()
    await new Promise(resolveTimeout => setTimeout(resolveTimeout, 1000 * (attempt + 1)))
  }
  return response
}

async function purgeExactTestFile({ esaClient, siteId, url, mediaOrigin, evidence }) {
  const input = buildExactPurgeInput(siteId, url, mediaOrigin)
  const response = await esaClient.purgeCaches(new PurgeCachesRequest({
    siteId: input.siteId,
    type: input.type,
    content: new PurgeCachesRequestContent(input.content),
  }))
  const taskId = response.body?.taskId
  if (response.statusCode !== 200 || !taskId) {
    throw productionPreflightError(
      'esa-purge-missing-task-id',
      'ESA exact file purge did not return a TaskId.',
    )
  }
  addCheck(evidence, 'esa-exact-file-purge-submitted', 'pass', {
    responseStatus: response.statusCode,
    taskId: maskIdentifier(taskId),
    type: 'file',
    fileCount: 1,
  })

  let terminalStatus
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const described = await esaClient.describePurgeTasks(
      new DescribePurgeTasksRequest({
        content: url,
        pageNumber: 1,
        pageSize: 20,
        siteId: Number(siteId),
        type: 'file',
      }),
    )
    const task = described.body?.tasks?.find(item => item.taskId === taskId)
    terminalStatus = task?.status
    if (terminalStatus === 'Complete' || terminalStatus === 'Failed') {
      break
    }
    await new Promise(resolveTimeout => setTimeout(resolveTimeout, 2000))
  }
  addCheck(evidence, 'esa-exact-file-purge-completed', (
    terminalStatus === 'Complete'
  ) ? 'pass' : 'fail', {
    taskId: maskIdentifier(taskId),
    terminalStatus: terminalStatus ?? 'timeout',
  })
}

async function liveObjectGate({
  config,
  evidence,
  esaClient,
  privateClient,
  publicClient,
  uploadClient,
  prefix,
  runId,
}) {
  const sourceKey = `${prefix}private/source.png`
  const forbiddenKey = `${prefix}outside-allowed-prefix.png`
  const outputKey = `prod/web/preflight/${runId}/output.webp`
  const created = []
  for (const [bucket, key] of [
    [config.privateBucket, sourceKey],
    [config.publicBucket, outputKey],
  ]) {
    assertProductionTestObject({ bucket, key, prefix })
  }

  try {
    const optionsUrl = rawObjectUrl(config.privateBucket, sourceKey)
    const [allowedOptions, deniedOptions] = await Promise.all([
      checkCorsOptions(optionsUrl, config.adminBaseUrl),
      checkCorsOptions(optionsUrl, 'https://wrong-origin.invalid'),
    ])
    const optionsPassed = allowedOptions.status >= 200
      && allowedOptions.status < 300
      && allowedOptions.allowedOrigin === config.adminBaseUrl
      && allowedOptions.allowedMethods.toUpperCase().includes('PUT')
      && REQUIRED_PUT_HEADERS.every(header => (
        allowedOptions.allowedHeaders.toLowerCase().split(/\s*,\s*/u).includes(header)
      ))
      && deniedOptions.allowedOrigin !== 'https://wrong-origin.invalid'
    addCheck(evidence, 'browser-cors-origin-boundary', optionsPassed ? 'pass' : 'fail', {
      allowedStatus: allowedOptions.status,
      exactOriginAllowed: allowedOptions.allowedOrigin === config.adminBaseUrl,
      wrongOriginDenied: deniedOptions.allowedOrigin !== 'https://wrong-origin.invalid',
    })
    if (!optionsPassed) {
      throw productionPreflightError(
        'browser-cors-boundary-failed',
        'Browser CORS origin boundary failed.',
      )
    }

    const source = createSyntheticSourcePng(320, 240)
    const signed = await signedPut(uploadClient, sourceKey, source)
    const uploadUrl = new URL(signed.url)
    if (uploadUrl.origin !== config.uploadBaseUrl || uploadUrl.hostname.includes('-internal')) {
      throw productionPreflightError(
        'browser-upload-origin-mismatch',
        'Browser PUT signature used the wrong upload origin.',
      )
    }
    const upload = await fetch(signed.url, {
      method: 'PUT',
      body: source,
      headers: signed.headers,
      redirect: 'manual',
    })
    if (!upload.ok) {
      throw productionPreflightError(
        'browser-conditional-put-failed',
        `Browser conditional PUT failed with HTTP ${upload.status}.`,
      )
    }
    created.push({ bucket: config.privateBucket, key: sourceKey })
    addCheck(evidence, 'browser-conditional-put', 'pass', {
      responseStatus: upload.status,
      uploadOriginMatches: true,
      forbidOverwritePinned: true,
      contentMd5Pinned: true,
    })

    const repeated = await fetch(signed.url, {
      method: 'PUT',
      body: source,
      headers: signed.headers,
      redirect: 'manual',
    })
    addCheck(evidence, 'browser-overwrite-rejected', (
      repeated.status === 409
    ) ? 'pass' : 'fail', { responseStatus: repeated.status })

    const tampered = await signedPut(uploadClient, `${prefix}private/tampered.png`, source)
    const tamperedHeaders = {
      ...tampered.headers,
      'Content-MD5': Buffer.alloc(16, 1).toString('base64'),
    }
    const tamperedResponse = await fetch(tampered.url, {
      method: 'PUT',
      body: source,
      headers: tamperedHeaders,
      redirect: 'manual',
    })
    addCheck(evidence, 'browser-tampered-md5-rejected', (
      tamperedResponse.status === 403
    ) ? 'pass' : 'fail', { responseStatus: tamperedResponse.status })

    const expired = await signedPut(
      uploadClient,
      `${prefix}private/expired.png`,
      source,
      1,
    )
    await new Promise(resolveTimeout => setTimeout(resolveTimeout, 2100))
    const expiredResponse = await fetch(expired.url, {
      method: 'PUT',
      body: source,
      headers: expired.headers,
      redirect: 'manual',
    })
    addCheck(evidence, 'browser-expired-signature-rejected', (
      expiredResponse.status === 403
    ) ? 'pass' : 'fail', { responseStatus: expiredResponse.status })

    const overreach = await signedPut(uploadClient, forbiddenKey, source)
    const overreachResponse = await fetch(overreach.url, {
      method: 'PUT',
      body: source,
      headers: overreach.headers,
      redirect: 'manual',
    })
    if (overreachResponse.ok) {
      created.push({ bucket: config.privateBucket, key: forbiddenKey })
    }
    addCheck(evidence, 'oss-write-prefix-overreach-denied', (
      overreachResponse.status === 403
    ) ? 'pass' : 'fail', { responseStatus: overreachResponse.status })

    const [sourceHead, sourceGet] = await Promise.all([
      privateClient.head(sourceKey),
      privateClient.get(sourceKey),
    ])
    const sourceReadable = sourceHead.status === 200
      && Number(responseHeader(sourceHead, 'content-length')) === source.length
      && sourceGet.res?.status === 200
      && sourceGet.content?.length === source.length
    addCheck(evidence, 'oss-application-head-get-allowed', (
      sourceReadable
    ) ? 'pass' : 'fail', {
      getStatus: sourceGet.res?.status,
      headStatus: sourceHead.status,
    })

    const processResult = await privateClient.processObjectSave(
      sourceKey,
      outputKey,
      'image/resize,w_160/format,webp',
      config.publicBucket,
    )
    await waitForHead(publicClient, outputKey)
    created.push({ bucket: config.publicBucket, key: outputKey })
    addCheck(evidence, 'oss-process-and-cross-bucket-save-allowed', (
      processResult.status === 200
    ) ? 'pass' : 'fail', { responseStatus: processResult.status })

    const [
      privateAnonymousGet,
      privateAnonymousHead,
      publicAnonymousGet,
      publicAnonymousHead,
    ] = await Promise.all([
      fetch(rawObjectUrl(config.privateBucket, sourceKey), { redirect: 'manual' }),
      fetch(rawObjectUrl(config.privateBucket, sourceKey), {
        method: 'HEAD',
        redirect: 'manual',
      }),
      fetch(rawObjectUrl(config.publicBucket, outputKey), { redirect: 'manual' }),
      fetch(rawObjectUrl(config.publicBucket, outputKey), {
        method: 'HEAD',
        redirect: 'manual',
      }),
    ])
    addCheck(evidence, 'raw-oss-anonymous-reads-denied', (
      privateAnonymousGet.status === 403
      && privateAnonymousHead.status === 403
      && publicAnonymousGet.status === 403
      && publicAnonymousHead.status === 403
    ) ? 'pass' : 'fail', {
      privateGetStatus: privateAnonymousGet.status,
      privateHeadStatus: privateAnonymousHead.status,
      derivativeGetStatus: publicAnonymousGet.status,
      derivativeHeadStatus: publicAnonymousHead.status,
    })

    const publicHead = await publicClient.head(outputKey)
    addCheck(evidence, 'oss-application-derivative-read-allowed', (
      publicHead.status === 200
      && responseHeader(publicHead, 'content-type') === WEBP_CONTENT_TYPE
    ) ? 'pass' : 'fail', { responseStatus: publicHead.status })

    const esaOutputUrl = exactEsaMediaUrl(config.mediaBaseUrl, outputKey)
    const esaOutput = await fetchWithRetry(esaOutputUrl, 200)
    const esaResponseMetadata = JSON.stringify([
      esaOutput.url,
      ...esaOutput.headers.entries(),
    ])
    const esaResponseSafe = !esaResponseMetadata.includes('.aliyuncs.com')
      && !esaResponseMetadata.includes(config.privateBucket)
      && !esaResponseMetadata.includes('/prod/original/')
    addCheck(evidence, 'esa-derivative-read-allowed', (
      esaOutput.status === 200
      && esaOutput.headers.get('content-type') === WEBP_CONTENT_TYPE
      && esaResponseSafe
    ) ? 'pass' : 'fail', {
      responseStatus: esaOutput.status,
      mediaOrigin: config.mediaBaseUrl,
      originAndPrivateKeyHidden: esaResponseSafe,
    })
    if (esaOutput.status !== 200) {
      throw productionPreflightError(
        'esa-derivative-read-failed',
        'ESA could not read the generated derivative object.',
      )
    }

    const esaPrivateProbe = await fetch(
      new URL(sourceKey, `${config.mediaBaseUrl}/`),
      { redirect: 'manual' },
    )
    addCheck(evidence, 'esa-does-not-expose-private-bucket', (
      esaPrivateProbe.status !== 200
    ) ? 'pass' : 'fail', { responseStatus: esaPrivateProbe.status })

    await purgeExactTestFile({
      esaClient,
      siteId: config.esaSiteId,
      url: esaOutputUrl,
      mediaOrigin: config.mediaBaseUrl,
      evidence,
    })
  }
  finally {
    let cleanupFailed = 0
    for (const object of [...created].reverse()) {
      try {
        const client = object.bucket === config.privateBucket
          ? privateClient
          : publicClient
        await client.delete(object.key)
      }
      catch {
        cleanupFailed += 1
      }
    }
    addCheck(evidence, 'exact-test-object-cleanup', (
      cleanupFailed === 0
    ) ? 'pass' : 'fail', {
      attemptedCount: created.length,
      failedCount: cleanupFailed,
    })
  }
}

function redactedConfig(config) {
  return {
    environment: config.appEnv,
    region: config.region,
    serverEndpoint: config.endpoint,
    uploadOrigin: config.uploadBaseUrl,
    mediaOrigin: config.mediaBaseUrl,
    publicOrigin: config.publicBaseUrl,
    adminOrigin: config.adminBaseUrl,
    privateBucket: maskIdentifier(config.privateBucket),
    derivativeBucket: maskIdentifier(config.publicBucket),
    ossCredentialFingerprint: fingerprint(config.accessKeyId),
    aliyunCredentialFingerprint: fingerprint(config.accessKeyId),
    esaSite: maskIdentifier(config.esaSiteId),
    credentialsRecorded: false,
  }
}

function plannedChecks(evidence) {
  for (const name of [
    'bucket-acl-bpa-policy-object-acl-lifecycle',
    'cors-and-browser-conditional-put-failures',
    'application-read-write-process-delete-and-overreach',
    'raw-oss-anonymous-403-and-esa-derivative-200',
    'derivative-inventory-database-boundary',
    'esa-purge-access',
  ]) {
    addCheck(evidence, name, 'skip', { reason: 'dry-run-no-network-or-cloud-writes' })
  }
}

async function writeEvidence(path, evidence) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  })
}

async function main() {
  const startedAt = new Date()
  const evidence = {
    schemaVersion: 2,
    task: 'T52-E2',
    mode: 'dry-run',
    runId: null,
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    status: 'running',
    config: null,
    checks: [],
    failure: null,
    secretsRecorded: false,
    objectKeysRecorded: false,
    signedUrlsRecorded: false,
  }
  let evidencePath

  try {
    const arguments_ = parseArguments(process.argv.slice(2))
    const runId = arguments_['run-id'] ?? createProductionPreflightRunId(startedAt)
    const prefix = productionPreflightPrefix(runId)
    const evidenceDirectory = nonEmpty(process.env.PREFLIGHT_EVIDENCE_DIR)
    evidencePath = arguments_.evidence
      ? resolve(projectRoot, arguments_.evidence)
      : evidenceDirectory
        ? resolve(evidenceDirectory, `${runId}.json`)
        : resolve(projectRoot, `test-results/production-preflight/${runId}.json`)
    evidence.runId = runId
    evidence.mode = arguments_['no-dry-run'] ? 'live' : 'dry-run'

    const config = loadPreflightConfig()
    evidence.config = redactedConfig(config)
    addCheck(evidence, 'production-runtime-contract', 'pass', {
      databasePathAbsolute: true,
      endpointSeparation: true,
      credentialsSeparated: true,
      placeholderFree: true,
    })

    if (!arguments_['no-dry-run']) {
      plannedChecks(evidence)
      evidence.status = 'passed'
      return
    }
    if (!existsSync(config.databaseFile)) {
      throw productionPreflightError(
        'production-database-missing',
        'Production DATABASE_FILE does not exist.',
      )
    }

    const privateClient = createOssClient(config, config.privateBucket)
    const publicClient = createOssClient(config, config.publicBucket)
    const uploadClient = createOssClient(config, config.privateBucket, true)
    const esaClient = createEsaClient(config)
    const readyDerivativeKeys = readReadyDerivativeKeys(config.databaseFile)

    await bucketReadGate({
      client: privateClient,
      bucket: config.privateBucket,
      adminOrigin: config.adminBaseUrl,
      evidence,
      readyDerivativeKeys,
    })
    await bucketReadGate({
      client: publicClient,
      bucket: config.publicBucket,
      adminOrigin: config.adminBaseUrl,
      evidence,
      readyDerivativeKeys,
    })
    await verifyEsaAccess(esaClient, config.esaSiteId, evidence)

    if (evidence.checks.some(check => check.status === 'fail')) {
      addCheck(evidence, 'live-object-gate', 'skip', {
        reason: 'read-only-production-boundary-failed',
      })
      evidence.status = 'blocked'
      process.exitCode = 2
      return
    }

    await liveObjectGate({
      config,
      evidence,
      esaClient,
      privateClient,
      publicClient,
      uploadClient,
      prefix,
      runId,
    })
    evidence.status = evidence.checks.every(check => (
      ['pass', 'skip'].includes(check.status)
    )) ? 'passed' : 'failed'
    process.exitCode = evidence.status === 'passed' ? 0 : 1
  }
  catch (error) {
    evidence.status = 'failed'
    evidence.failure = safeErrorSummary(error)
    process.exitCode = 1
  }
  finally {
    evidence.finishedAt = new Date().toISOString()
    if (!evidencePath) {
      process.stderr.write(`${evidence.failure?.code ?? 'PreflightArgumentError'}\n`)
    }
    else {
      try {
        await writeEvidence(evidencePath, evidence)
        const summary = {
          status: evidence.status,
          mode: evidence.mode,
          runId: evidence.runId,
          evidencePath,
          checks: evidence.checks.map(check => ({
            name: check.name,
            status: check.status,
          })),
          failure: evidence.failure,
          secretsRecorded: false,
          objectKeysRecorded: false,
          signedUrlsRecorded: false,
        }
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
      }
      catch (error) {
        process.stderr.write(`Failed to write redacted evidence: ${safeErrorSummary(error).code}\n`)
        process.exitCode = 1
      }
    }
  }
}

await main()
