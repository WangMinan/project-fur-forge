import {
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs'
import {
  isAbsolute,
  resolve,
} from 'node:path'
import { z } from 'zod'
import runtimeExample from '../../config/runtime.example.json'

export const RUNTIME_CONFIG_ENV = {
  appEnv: 'APP_ENV',
  publicBaseUrl: 'PUBLIC_BASE_URL',
  adminBaseUrl: 'ADMIN_BASE_URL',
  mediaBaseUrl: 'MEDIA_BASE_URL',
  ossUploadBaseUrl: 'OSS_UPLOAD_BASE_URL',
  databaseFile: 'DATABASE_FILE',
  ossRegion: 'OSS_REGION',
  ossPrivateBucket: 'OSS_PRIVATE_BUCKET',
  ossPublicBucket: 'OSS_PUBLIC_BUCKET',
  ossEndpoint: 'OSS_ENDPOINT',
  ossAccessKeyId: 'OSS_ACCESS_KEY_ID',
  ossAccessKeySecret: 'OSS_ACCESS_KEY_SECRET',
  esaSiteId: 'ESA_SITE_ID',
  esaAccessKeyId: 'ESA_ACCESS_KEY_ID',
  esaAccessKeySecret: 'ESA_ACCESS_KEY_SECRET',
  sessionSecret: 'SESSION_SECRET',
  icpFilingNumber: 'ICP_FILING_NUMBER',
  icpFilingUrl: 'ICP_FILING_URL',
  policeFilingStatus: 'POLICE_FILING_STATUS',
  policeFilingNumber: 'POLICE_FILING_NUMBER',
  policeFilingUrl: 'POLICE_FILING_URL',
  trustedProxyCidrs: 'TRUSTED_PROXY_CIDRS',
  smtpHost: 'SMTP_HOST',
  smtpPort: 'SMTP_PORT',
  smtpSecure: 'SMTP_SECURE',
  smtpUser: 'SMTP_USER',
  smtpPassword: 'SMTP_PASSWORD',
} as const

export const RUNTIME_CONFIG_TYPES = {
  appEnv: 'environment',
  publicBaseUrl: 'origin',
  adminBaseUrl: 'origin',
  mediaBaseUrl: 'origin',
  ossUploadBaseUrl: 'origin',
  databaseFile: 'filesystem-path',
  ossRegion: 'string',
  ossPrivateBucket: 'string',
  ossPublicBucket: 'string',
  ossEndpoint: 'origin',
  ossAccessKeyId: 'string',
  ossAccessKeySecret: 'string',
  esaSiteId: 'string',
  esaAccessKeyId: 'string',
  esaAccessKeySecret: 'string',
  sessionSecret: 'string',
  icpFilingNumber: 'string',
  icpFilingUrl: 'url',
  policeFilingStatus: 'filing-status',
  policeFilingNumber: 'string',
  policeFilingUrl: 'url',
  trustedProxyCidrs: 'string',
  smtpHost: 'string',
  smtpPort: 'integer',
  smtpSecure: 'boolean',
  smtpUser: 'string',
  smtpPassword: 'string',
} as const

type RuntimeConfigKey = keyof typeof RUNTIME_CONFIG_ENV
type RuntimeEnvironment = Readonly<Record<string, string | undefined>>

const configFileSchema = z.object({
  schemaVersion: z.literal(1),
  configFileEnv: z.literal('APP_CONFIG_FILE'),
  types: z.record(z.string(), z.string()),
  env: z.record(z.string(), z.string()),
  values: z.record(z.string(), z.unknown()),
}).strict()

const emptyToUndefined = (value: unknown) => (
  typeof value === 'string' && value.trim() === ''
    ? undefined
    : value
)

const optionalText = (maximum: number) => z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(maximum).optional(),
)

const optionalPort = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).max(65_535).optional(),
)

const optionalBoolean = z.preprocess((value) => {
  const normalized = emptyToUndefined(value)

  if (normalized === 'true') {
    return true
  }

  if (normalized === 'false') {
    return false
  }

  return normalized
}, z.boolean().optional())

const optionalFilingUrl = z.preprocess(
  emptyToUndefined,
  z.string().url().max(2_048).optional(),
)

const optionalEsaSiteId = z.preprocess(
  emptyToUndefined,
  z.string().trim().regex(/^[1-9]\d{0,31}$/u).optional(),
)

function isOfficialFilingUrl(
  value: string | undefined,
  officialHosts: readonly string[],
  allowHash = false,
) {
  if (!value) {
    return true
  }
  const url = new URL(value)
  return url.protocol === 'https:'
    && officialHosts.includes(url.hostname.toLowerCase())
    && url.username === ''
    && url.password === ''
    && (allowHash || url.hash === '')
}

const embeddedContract = configFileSchema.parse(runtimeExample)
const localFallback = Object.fromEntries(
  Object.entries(embeddedContract.values)
    .filter(([, value]) => emptyToUndefined(value) !== undefined),
) as Partial<Record<RuntimeConfigKey, unknown>>

const originSchema = z.string()
  .url()
  .refine((value) => {
    const url = new URL(value)

    return url.username === ''
      && url.password === ''
      && url.pathname === '/'
      && url.search === ''
      && url.hash === ''
  }, '必须是无凭据、路径、查询串和片段的 origin')
  .transform(value => new URL(value).origin)

export const runtimeConfigSchema = z.object({
  appEnv: z.enum([
    'development',
    'test',
    'production',
  ]),
  publicBaseUrl: originSchema,
  adminBaseUrl: originSchema,
  mediaBaseUrl: originSchema,
  ossUploadBaseUrl: originSchema,
  databaseFile: z.string().trim().min(1).max(1_024),
  ossRegion: optionalText(100),
  ossPrivateBucket: optionalText(255),
  ossPublicBucket: optionalText(255),
  ossEndpoint: z.preprocess(
    emptyToUndefined,
    originSchema.optional(),
  ),
  ossAccessKeyId: optionalText(256),
  ossAccessKeySecret: optionalText(256),
  esaSiteId: optionalEsaSiteId,
  esaAccessKeyId: optionalText(256),
  esaAccessKeySecret: optionalText(256),
  sessionSecret: z.preprocess(
    emptyToUndefined,
    z.string().min(32).max(1_024).optional(),
  ),
  icpFilingNumber: optionalText(120),
  icpFilingUrl: optionalFilingUrl,
  policeFilingStatus: z.preprocess(
    emptyToUndefined,
    z.enum(['unconfigured', 'not_applicable', 'filed']).optional(),
  ),
  policeFilingNumber: optionalText(120),
  policeFilingUrl: optionalFilingUrl,
  // T34-F5：可信代理网段列表（逗号分隔 CIDR）。留空表示不解析任何转发链。
  trustedProxyCidrs: optionalText(512),
  smtpHost: optionalText(255),
  smtpPort: optionalPort,
  smtpSecure: optionalBoolean,
  smtpUser: optionalText(320),
  smtpPassword: optionalText(1_024),
}).strict().superRefine((config, context) => {
  const origins = [
    config.publicBaseUrl,
    config.adminBaseUrl,
    config.mediaBaseUrl,
    config.ossUploadBaseUrl,
  ]

  if (new Set(origins).size !== origins.length) {
    context.addIssue({
      code: 'custom',
      message: '公开、后台、媒体和上传 origin 必须互不相同',
    })
  }

  const ossConfig = [
    config.ossRegion,
    config.ossPrivateBucket,
    config.ossPublicBucket,
    config.ossEndpoint,
    config.ossAccessKeyId,
    config.ossAccessKeySecret,
  ]
  const hasAnyOssConfig = ossConfig.some(Boolean)

  if (
    hasAnyOssConfig
    && ossConfig.some(value => !value)
  ) {
    context.addIssue({
      code: 'custom',
      message: 'OSS 配置必须成组提供',
      path: ['ossRegion'],
    })
  }

  if (
    config.ossPrivateBucket
    && config.ossPrivateBucket === config.ossPublicBucket
  ) {
    context.addIssue({
      code: 'custom',
      message: 'OSS 私有 Bucket 与公开 Bucket 必须不同',
      path: ['ossPublicBucket'],
    })
  }

  if (new URL(config.ossUploadBaseUrl).hostname.endsWith('-internal.aliyuncs.com')) {
    context.addIssue({
      code: 'custom',
      message: '浏览器上传 origin 不能使用 OSS 内网地址',
      path: ['ossUploadBaseUrl'],
    })
  }

  const esaConfig = [
    config.esaSiteId,
    config.esaAccessKeyId,
    config.esaAccessKeySecret,
  ]
  const hasAnyEsaConfig = esaConfig.some(Boolean)
  if (hasAnyEsaConfig && esaConfig.some(value => !value)) {
    context.addIssue({
      code: 'custom',
      message: 'ESA Site 与 API 凭据必须成组提供',
      path: ['esaSiteId'],
    })
  }

  if (
    config.ossAccessKeyId
    && config.esaAccessKeyId
    && config.ossAccessKeyId === config.esaAccessKeyId
  ) {
    context.addIssue({
      code: 'custom',
      message: 'OSS 与 ESA API 必须使用不同的 RAM 凭据',
      path: ['esaAccessKeyId'],
    })
  }

  const smtpConfig = [
    config.smtpHost,
    config.smtpPort,
    config.smtpSecure,
    config.smtpUser,
    config.smtpPassword,
  ]
  const hasAnySmtpConfig = smtpConfig.some(
    value => value !== undefined,
  )

  if (
    hasAnySmtpConfig
    && smtpConfig.some(value => value === undefined)
  ) {
    context.addIssue({
      code: 'custom',
      message: 'SMTP 配置必须成组提供',
      path: ['smtpHost'],
    })
  }

  if (Boolean(config.icpFilingNumber) !== Boolean(config.icpFilingUrl)) {
    context.addIssue({
      code: 'custom',
      message: 'ICP 备案号与官方链接必须成对提供',
      path: ['icpFilingNumber'],
    })
  }
  if (!isOfficialFilingUrl(
    config.icpFilingUrl,
    ['beian.miit.gov.cn'],
  )) {
    context.addIssue({
      code: 'custom',
      message: 'ICP 备案链接必须使用工信部 HTTPS 官方域名',
      path: ['icpFilingUrl'],
    })
  }

  const policeHasDisplay = Boolean(
    config.policeFilingNumber || config.policeFilingUrl,
  )
  if (config.policeFilingStatus === 'filed') {
    if (!config.policeFilingNumber || !config.policeFilingUrl) {
      context.addIssue({
        code: 'custom',
        message: '公安备案标记为 filed 时必须提供备案号与链接',
        path: ['policeFilingNumber'],
      })
    }
  }
  else if (policeHasDisplay) {
    context.addIssue({
      code: 'custom',
      message: '只有已完成公安备案时才能配置展示信息',
      path: ['policeFilingStatus'],
    })
  }
  if (!isOfficialFilingUrl(
    config.policeFilingUrl,
    ['beian.gov.cn', 'www.beian.gov.cn', 'beian.mps.gov.cn'],
    true,
  )) {
    context.addIssue({
      code: 'custom',
      message: '公安备案链接必须使用全国互联网安全管理平台 HTTPS 官方域名',
      path: ['policeFilingUrl'],
    })
  }

  if (config.appEnv === 'production') {
    if (config.policeFilingStatus === undefined) {
      context.addIssue({
        code: 'custom',
        message: '生产环境必须显式声明公安备案状态',
        path: ['policeFilingStatus'],
      })
    }
    for (const key of [
      'publicBaseUrl',
      'adminBaseUrl',
      'mediaBaseUrl',
      'ossUploadBaseUrl',
    ] as const) {
      if (new URL(config[key]).protocol !== 'https:') {
        context.addIssue({
          code: 'custom',
          message: '生产 origin 必须使用 HTTPS',
          path: [key],
        })
      }
    }

    if (config.mediaBaseUrl !== 'https://public-media.ditedog.com') {
      context.addIssue({
        code: 'custom',
        message: '生产媒体 origin 必须使用 public-media.ditedog.com',
        path: ['mediaBaseUrl'],
      })
    }

    if (config.ossRegion !== 'oss-cn-hangzhou') {
      context.addIssue({
        code: 'custom',
        message: '生产 OSS Region 必须使用杭州区域',
        path: ['ossRegion'],
      })
    }

    if (
      config.ossEndpoint
      !== 'https://oss-cn-hangzhou-internal.aliyuncs.com'
    ) {
      context.addIssue({
        code: 'custom',
        message: '生产服务端 OSS Endpoint 必须使用杭州内网地址',
        path: ['ossEndpoint'],
      })
    }

    if (config.ossPrivateBucket) {
      const expectedUploadOrigin
        = `https://${config.ossPrivateBucket}.oss-cn-hangzhou.aliyuncs.com`
      if (config.ossUploadBaseUrl !== expectedUploadOrigin) {
        context.addIssue({
          code: 'custom',
          message: '生产浏览器上传 origin 必须是私有 Bucket 的杭州公网域名',
          path: ['ossUploadBaseUrl'],
        })
      }
    }

    if (!isAbsolute(config.databaseFile)) {
      context.addIssue({
        code: 'custom',
        message: '生产数据库文件必须使用绝对路径',
        path: ['databaseFile'],
      })
    }

    for (const key of [
      'ossRegion',
      'ossPrivateBucket',
      'ossPublicBucket',
      'ossEndpoint',
      'ossAccessKeyId',
      'ossAccessKeySecret',
      'esaSiteId',
      'esaAccessKeyId',
      'esaAccessKeySecret',
      'sessionSecret',
    ] as const) {
      if (config[key] === undefined) {
        context.addIssue({
          code: 'custom',
          message: '生产环境必须显式提供该配置',
          path: [key],
        })
      }
    }
  }
})

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>

export interface LoadRuntimeConfigOptions {
  cwd?: string
  env?: RuntimeEnvironment
  filePath?: string
}

export class RuntimeConfigError extends Error {
  override name = 'RuntimeConfigError'
}

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function readConfigFile(filePath: string) {
  if (statSync(filePath).size > 256_000) {
    throw new RuntimeConfigError('Runtime config file exceeds 256 KB.')
  }

  let content: unknown

  try {
    content = JSON.parse(readFileSync(filePath, 'utf8'))
  }
  catch {
    throw new RuntimeConfigError('Runtime config file is not valid JSON.')
  }

  const parsed = configFileSchema.safeParse(content)

  if (!parsed.success) {
    throw new RuntimeConfigError('Runtime config file shape is invalid.')
  }

  if (
    Object.hasOwn(parsed.data.values, 'ossBucket')
    || parsed.data.env.ossBucket === 'OSS_BUCKET'
  ) {
    throw new RuntimeConfigError(
      'ossBucket/OSS_BUCKET is no longer supported; use separate private and public Bucket settings.',
    )
  }

  const expectedEntries = Object.entries(RUNTIME_CONFIG_ENV)
  const expectedTypes = Object.entries(RUNTIME_CONFIG_TYPES)

  if (
    Object.keys(parsed.data.env).length !== expectedEntries.length
    || expectedEntries.some(
      ([key, envName]) => parsed.data.env[key] !== envName,
    )
  ) {
    throw new RuntimeConfigError('Runtime config environment mapping drifted.')
  }

  if (
    Object.keys(parsed.data.types).length !== expectedTypes.length
    || expectedTypes.some(
      ([key, type]) => parsed.data.types[key] !== type,
    )
  ) {
    throw new RuntimeConfigError('Runtime config type mapping drifted.')
  }

  return Object.fromEntries(
    Object.entries(parsed.data.values)
      .filter(([, value]) => emptyToUndefined(value) !== undefined),
  )
}

export function loadRuntimeConfig(
  options: LoadRuntimeConfigOptions = {},
): RuntimeConfig {
  const cwd = options.cwd ?? process.cwd()
  const dotenvFile = resolve(cwd, '.env')

  if (!options.env && existsSync(dotenvFile)) {
    process.loadEnvFile(dotenvFile)
  }

  const env = options.env ?? process.env

  if (Object.hasOwn(env, 'OSS_BUCKET')) {
    throw new RuntimeConfigError(
      'OSS_BUCKET is no longer supported; use OSS_PRIVATE_BUCKET and OSS_PUBLIC_BUCKET.',
    )
  }

  const explicitFile = options.filePath ?? nonEmpty(env.APP_CONFIG_FILE)
  const defaultLocalFile = resolve(cwd, 'config/runtime.local.json')
  const filePath = explicitFile
    ? resolve(cwd, explicitFile)
    : existsSync(defaultLocalFile)
      ? defaultLocalFile
      : undefined

  if (explicitFile && filePath && !existsSync(filePath)) {
    throw new RuntimeConfigError('APP_CONFIG_FILE does not exist.')
  }

  const fileValues = filePath
    ? readConfigFile(filePath)
    : {}
  const preliminaryEnvironment = nonEmpty(env.APP_ENV)
    ?? (typeof fileValues.appEnv === 'string'
      ? fileValues.appEnv
      : undefined)
    ?? localFallback.appEnv
  const fallback = preliminaryEnvironment === 'production'
    ? { appEnv: 'production' }
    : localFallback
  const environmentValues = Object.fromEntries(
    Object.entries(RUNTIME_CONFIG_ENV)
      .flatMap(([key, envName]) => {
        const value = nonEmpty(env[envName])
        return value === undefined ? [] : [[key, value]]
      }),
  )
  const parsed = runtimeConfigSchema.safeParse({
    ...fallback,
    ...fileValues,
    ...environmentValues,
  })

  if (!parsed.success) {
    const invalidPaths = Array.from(new Set(
      parsed.error.issues.map(issue => issue.path.join('.') || 'config'),
    )).join(', ')

    throw new RuntimeConfigError(
      `Runtime config is invalid: ${invalidPaths}.`,
    )
  }

  return Object.freeze(parsed.data)
}

let cachedRuntimeConfig: RuntimeConfig | undefined

export function getRuntimeConfig() {
  cachedRuntimeConfig ??= loadRuntimeConfig()
  return cachedRuntimeConfig
}
