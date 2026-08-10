import { createHash, randomBytes } from 'node:crypto'
import { isAbsolute } from 'node:path'

export const EXPECTED_REGION = 'oss-cn-hangzhou'
export const EXPECTED_PRIVATE_BUCKET = 'project-furry-forge-private'
export const EXPECTED_PUBLIC_BUCKET = 'project-furry-forge-public'
export const EXPECTED_MEDIA_ORIGIN = 'https://public-media.ditedog.com'
export const REQUIRED_PUT_HEADERS = [
  'content-md5',
  'content-type',
  'x-oss-forbid-overwrite',
  'x-oss-meta-sha256',
]

const RUN_ID_PATTERN = /^t52e2-\d{8}T\d{6}Z-[a-f0-9]{8}$/u
const PLACEHOLDER_PATTERN
  = /(?:replace[-_ ]?me|example\.(?:com|test)|test[-_ ]?only|your[-_ ]?(?:key|secret|site))/iu

export function productionPreflightError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function nonEmpty(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''

  return normalized || undefined
}

function credentialFreeHttpsOrigin(value, label) {
  let url

  try {
    url = new URL(value)
  }
  catch {
    throw productionPreflightError('invalid-https-origin', `${label} must be a valid URL.`)
  }

  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
  ) {
    throw productionPreflightError(
      'invalid-https-origin',
      `${label} must be a credential-free HTTPS origin.`,
    )
  }

  return url.origin
}

function required(config, key) {
  const value = nonEmpty(config[key])

  if (!value) {
    throw productionPreflightError(
      'missing-production-config',
      `Missing production preflight configuration: ${key}.`,
    )
  }
  if (PLACEHOLDER_PATTERN.test(value)) {
    throw productionPreflightError(
      'placeholder-production-config',
      `Production preflight configuration contains a placeholder: ${key}.`,
    )
  }

  return value
}

export function validateProductionPreflightConfig(config) {
  const normalized = {
    appEnv: required(config, 'appEnv'),
    databaseFile: required(config, 'databaseFile'),
    publicBaseUrl: credentialFreeHttpsOrigin(
      required(config, 'publicBaseUrl'),
      'PUBLIC_BASE_URL',
    ),
    adminBaseUrl: credentialFreeHttpsOrigin(
      required(config, 'adminBaseUrl'),
      'ADMIN_BASE_URL',
    ),
    mediaBaseUrl: credentialFreeHttpsOrigin(
      required(config, 'mediaBaseUrl'),
      'MEDIA_BASE_URL',
    ),
    uploadBaseUrl: credentialFreeHttpsOrigin(
      required(config, 'uploadBaseUrl'),
      'OSS_UPLOAD_BASE_URL',
    ),
    region: required(config, 'region'),
    endpoint: credentialFreeHttpsOrigin(
      required(config, 'endpoint'),
      'OSS_ENDPOINT',
    ),
    privateBucket: required(config, 'privateBucket'),
    publicBucket: required(config, 'publicBucket'),
    accessKeyId: required(config, 'accessKeyId'),
    accessKeySecret: required(config, 'accessKeySecret'),
    esaSiteId: required(config, 'esaSiteId'),
    esaApiEndpoint: credentialFreeHttpsOrigin(
      required(config, 'esaApiEndpoint'),
      'ESA_API_ENDPOINT',
    ),
  }

  if (normalized.appEnv !== 'production') {
    throw productionPreflightError(
      'wrong-application-environment',
      'Production preflight requires APP_ENV=production.',
    )
  }
  if (!isAbsolute(normalized.databaseFile)) {
    throw productionPreflightError(
      'database-path-not-absolute',
      'Production preflight requires an absolute DATABASE_FILE.',
    )
  }
  if (normalized.publicBaseUrl === normalized.adminBaseUrl) {
    throw productionPreflightError(
      'public-admin-origin-collision',
      'PUBLIC_BASE_URL and ADMIN_BASE_URL must be distinct.',
    )
  }
  if (normalized.mediaBaseUrl !== EXPECTED_MEDIA_ORIGIN) {
    throw productionPreflightError(
      'wrong-media-origin',
      `MEDIA_BASE_URL must be exactly ${EXPECTED_MEDIA_ORIGIN}.`,
    )
  }
  if (normalized.region !== EXPECTED_REGION) {
    throw productionPreflightError(
      'wrong-oss-region',
      'OSS_REGION must be the approved Hangzhou region.',
    )
  }
  if (
    normalized.endpoint
    !== `https://${normalized.region}-internal.aliyuncs.com`
  ) {
    throw productionPreflightError(
      'wrong-oss-service-endpoint',
      'OSS_ENDPOINT must use the Hangzhou internal service endpoint.',
    )
  }
  if (normalized.privateBucket !== EXPECTED_PRIVATE_BUCKET) {
    throw productionPreflightError(
      'wrong-private-bucket',
      'OSS_PRIVATE_BUCKET does not match the approved private Bucket.',
    )
  }
  if (normalized.publicBucket !== EXPECTED_PUBLIC_BUCKET) {
    throw productionPreflightError(
      'wrong-derivative-bucket',
      'OSS_PUBLIC_BUCKET does not match the approved derivative Bucket.',
    )
  }
  if (normalized.privateBucket === normalized.publicBucket) {
    throw productionPreflightError(
      'bucket-collision',
      'Private and derivative Buckets must be distinct.',
    )
  }

  const expectedUploadOrigin
    = `https://${normalized.privateBucket}.${EXPECTED_REGION}.aliyuncs.com`
  if (normalized.uploadBaseUrl !== expectedUploadOrigin) {
    throw productionPreflightError(
      'wrong-upload-origin',
      'OSS_UPLOAD_BASE_URL must be the private Bucket public origin.',
    )
  }
  if (new URL(normalized.uploadBaseUrl).hostname.includes('-internal')) {
    throw productionPreflightError(
      'internal-upload-origin',
      'OSS_UPLOAD_BASE_URL cannot use an internal endpoint.',
    )
  }
  if (!/^esa(?:\.[a-z0-9-]+)?\.aliyuncs\.com$/u.test(
    new URL(normalized.esaApiEndpoint).hostname,
  )) {
    throw productionPreflightError(
      'wrong-esa-api-endpoint',
      'ESA_API_ENDPOINT must use an official Aliyun ESA API host.',
    )
  }
  if (!/^[1-9]\d{0,31}$/u.test(normalized.esaSiteId)) {
    throw productionPreflightError(
      'invalid-esa-site-id',
      'ESA_SITE_ID must be a positive decimal identifier.',
    )
  }

  return normalized
}

export function createProductionPreflightRunId(
  now = new Date(),
  entropy = randomBytes(4),
) {
  const timestamp = now.toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/u, 'Z')

  return `t52e2-${timestamp}-${Buffer.from(entropy).toString('hex')}`
}

export function productionPreflightPrefix(runId) {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw productionPreflightError(
      'invalid-preflight-run-id',
      'Run ID does not match the T52-E2 preflight format.',
    )
  }

  return `prod/preflight/${runId}/`
}

export function assertProductionTestObject({ bucket, key, prefix }) {
  const allowed = bucket === EXPECTED_PRIVATE_BUCKET
    ? `${prefix}private/`
    : bucket === EXPECTED_PUBLIC_BUCKET
      ? `prod/web/preflight/${prefix.split('/').at(-2)}/`
      : undefined

  if (
    !allowed
    || !key.startsWith(allowed)
    || key.length <= allowed.length
    || key.includes('\\')
    || key.split('/').includes('..')
  ) {
    throw productionPreflightError(
      'test-object-outside-scope',
      'Object key is outside the exact T52-E2 test scope.',
    )
  }
}

function strings(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item))
  }
  if (value === undefined || value === null) {
    return []
  }
  return [String(value)]
}

export function evaluateStrictCorsRules(rules, adminOrigin) {
  const details = rules.map((rule, index) => {
    const origins = strings(rule.allowedOrigin)
    const methods = strings(rule.allowedMethod).map(value => value.toUpperCase())
    const headers = strings(rule.allowedHeader).map(value => value.toLowerCase())
    const exactOrigin = origins.length === 1 && origins[0] === adminOrigin
    const exactMethods = methods.length === 1 && methods[0] === 'PUT'
    const exactHeaders = !headers.includes('*')
      && REQUIRED_PUT_HEADERS.every(header => headers.includes(header))

    return {
      index,
      exactOrigin,
      exactMethods,
      exactHeaders,
      safe: exactOrigin && exactMethods && exactHeaders,
    }
  })

  return {
    safe: details.length === 1 && details[0]?.safe === true,
    ruleCount: details.length,
    matchingRuleCount: details.filter(rule => rule.safe).length,
  }
}

function lifecyclePrefix(rule) {
  return String(rule.prefix ?? rule.Prefix ?? '')
}

function hasDestructiveLifecycleAction(rule) {
  return Boolean(
    rule.expiration
    ?? rule.Expiration
    ?? rule.transition
    ?? rule.Transition
    ?? rule.noncurrentVersionExpiration
    ?? rule.NoncurrentVersionExpiration
  )
}

function overlapsProductionData(prefix, bucket) {
  const protectedPrefixes = bucket === EXPECTED_PRIVATE_BUCKET
    ? ['prod/original/', 'prod/processing/']
    : ['prod/web/']

  return protectedPrefixes.some(protectedPrefix => (
    prefix === ''
    || protectedPrefix.startsWith(prefix)
    || prefix.startsWith(protectedPrefix)
  ))
}

export function evaluateLifecycleRules(rules, bucket) {
  const activeRules = (rules ?? []).filter((rule) => {
    const status = String(rule.status ?? rule.Status ?? 'Enabled').toLowerCase()
    return status !== 'disabled'
  })
  const unsafe = activeRules.filter(rule => (
    hasDestructiveLifecycleAction(rule)
    && overlapsProductionData(lifecyclePrefix(rule), bucket)
  ))

  return {
    safe: unsafe.length === 0,
    activeRuleCount: activeRules.length,
    unsafeRuleCount: unsafe.length,
  }
}

export function isAllowedDerivativeObjectKey(key) {
  return typeof key === 'string'
    && key.startsWith('prod/web/')
    && key.length > 'prod/web/'.length
    && !key.includes('\\')
    && !key.split('/').includes('..')
    && !['/original/', '/processing/', '/preview/'].some(marker => (
      key.includes(marker)
    ))
}

export function evaluateDerivativeInventory(objectNames, readyDatabaseKeys) {
  const objects = new Set(objectNames)
  const ready = new Set(readyDatabaseKeys)
  const unsafeNames = objectNames.filter(name => !isAllowedDerivativeObjectKey(name))
  const untrackedNames = objectNames.filter(name => !ready.has(name))
  const missingNames = readyDatabaseKeys.filter(name => !objects.has(name))

  return {
    safe: unsafeNames.length === 0
      && untrackedNames.length === 0
      && missingNames.length === 0,
    objectCount: objectNames.length,
    readyDatabaseCount: readyDatabaseKeys.length,
    unsafeCount: unsafeNames.length,
    untrackedCount: untrackedNames.length,
    missingCount: missingNames.length,
  }
}

export function exactEsaMediaUrl(mediaOrigin, objectKey) {
  if (!isAllowedDerivativeObjectKey(objectKey)) {
    throw productionPreflightError(
      'invalid-derivative-object-key',
      'ESA media URL requires an approved derivative object key.',
    )
  }
  const url = new URL(objectKey, `${mediaOrigin}/`)

  if (
    url.origin !== new URL(mediaOrigin).origin
    || url.search
    || url.hash
  ) {
    throw productionPreflightError(
      'invalid-esa-media-url',
      'ESA media URL must be an exact public-media file URL.',
    )
  }

  return url.toString()
}

export function buildExactPurgeInput(siteId, mediaUrl, mediaOrigin) {
  const url = new URL(mediaUrl)

  if (
    url.origin !== new URL(mediaOrigin).origin
    || url.search
    || url.hash
    || url.pathname === '/'
  ) {
    throw productionPreflightError(
      'invalid-exact-purge-url',
      'ESA purge input must be one exact public-media file URL.',
    )
  }

  return {
    siteId: Number(siteId),
    type: 'file',
    content: { files: [url.toString()] },
  }
}

export function isAccessDenied(error) {
  const status = Number(error?.statusCode ?? error?.status ?? error?.response?.status)
  const code = String(error?.code ?? error?.name ?? '')

  return status === 403 || /(?:accessdenied|forbidden|unauthorized)/iu.test(code)
}

export function safeErrorSummary(error) {
  const requestId = String(
    error?.requestId
    ?? error?.data?.RequestId
    ?? error?.response?.headers?.['x-acs-request-id']
    ?? '',
  )

  return {
    code: String(error?.code ?? error?.name ?? 'UnknownError').slice(0, 96),
    status: Number(error?.statusCode ?? error?.status ?? error?.response?.status) || null,
    requestId: requestId ? maskIdentifier(requestId) : null,
  }
}

export function maskIdentifier(value) {
  const normalized = String(value)
  if (normalized.length <= 8) {
    return '***'
  }
  return `${normalized.slice(0, 4)}…${normalized.slice(-4)}`
}

export function fingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
}
