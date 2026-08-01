import type {
  ConditionalPutDto,
  PrivateAssetPreviewDto,
} from '../../shared/types/contracts'
import type { RuntimeConfig } from './runtime-config'
import { getRuntimeConfig } from './runtime-config'

export interface ConditionalPutInput {
  contentMd5: string
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
  expiresAt: number
  objectKey: string
  sha256: string
}

export interface PrivateObjectHead {
  byteSize: number
  contentType: string
  etagMd5Hex: string
  sha256Metadata: string | null
}

export interface PrivateImageInfo {
  fileSize: number
  format: string
  height: number
  orientation: number
  width: number
}

export interface PrivateObjectPutInput {
  content: Buffer
  contentMd5: string
  contentType: 'image/png'
  objectKey: string
  sha256: string
}

export interface PublicProcessInput {
  objectKey: string
  process: string
  sourceObjectKey: string
}

export interface AnonymousPublicObject {
  content: Buffer
  contentType: string
}

export interface MediaStorage {
  deletePrivate(objectKey: string): Promise<void>
  deletePublic(objectKey: string): Promise<void>
  getPrivate(objectKey: string): Promise<Buffer>
  getPublicAnonymous(objectKey: string): Promise<AnonymousPublicObject>
  headPrivate(objectKey: string): Promise<PrivateObjectHead>
  headPublic(objectKey: string): Promise<PrivateObjectHead>
  imageInfoPrivate(objectKey: string): Promise<PrivateImageInfo>
  imageInfoPublic(objectKey: string): Promise<PrivateImageInfo>
  processPrivateToPublic(input: PublicProcessInput): Promise<void>
  putPrivateConditional(input: PrivateObjectPutInput): Promise<void>
  signConditionalPut(input: ConditionalPutInput): Promise<ConditionalPutDto>
  signPrivateGet(objectKey: string, expiresAt: number): Promise<PrivateAssetPreviewDto>
}

interface OssClient {
  delete(objectKey: string): Promise<unknown>
  get(objectKey: string, options?: Record<string, unknown>): Promise<OssResult>
  head(objectKey: string): Promise<OssResult>
  put(
    objectKey: string,
    content: Buffer,
    options: { headers: Record<string, string> },
  ): Promise<unknown>
  processObjectSave(
    sourceObjectKey: string,
    objectKey: string,
    process: string,
    bucket: string,
  ): Promise<unknown>
  signatureUrlV4(
    method: string,
    expires: number,
    options: { headers?: Record<string, string> },
    objectKey: string,
  ): Promise<string>
}

interface OssResult {
  content?: Buffer | string
  headers?: Record<string, string>
  meta?: Record<string, string>
  res?: { headers?: Record<string, string> }
}

interface OssConstructor {
  new(options: Record<string, unknown>): OssClient
}

const ossModuleName = ['ali', 'oss'].join('-')

async function createOssClient(options: Record<string, unknown>) {
  const module = await import(ossModuleName) as {
    default: OssConstructor
  }
  return new module.default(options)
}

function requiredOssConfig(config: RuntimeConfig) {
  const values = {
    accessKeyId: config.ossAccessKeyId,
    accessKeySecret: config.ossAccessKeySecret,
    bucket: config.ossPrivateBucket,
    publicBucket: config.ossPublicBucket,
    endpoint: config.ossEndpoint,
    region: config.ossRegion,
  }
  if (Object.values(values).some(value => !value)) {
    throw new Error('OSS runtime configuration is unavailable.')
  }

  return values as Record<keyof typeof values, string>
}

function responseHeader(result: OssResult, name: string) {
  return result.res?.headers?.[name.toLowerCase()]
    ?? result.headers?.[name.toLowerCase()]
    ?? null
}

function imageInfoValue(
  parsed: Record<string, { value?: string, Value?: string }>,
  name: string,
) {
  return parsed[name]?.value ?? parsed[name]?.Value
}

export class AliOssMediaStorage implements MediaStorage {
  private readonly privateClient: Promise<OssClient>
  private readonly publicBucket: string
  private readonly publicClient: Promise<OssClient>
  private readonly publicMediaBaseUrl: string

  constructor(config: RuntimeConfig) {
    const oss = requiredOssConfig(config)
    this.publicBucket = oss.publicBucket
    this.publicMediaBaseUrl = config.mediaBaseUrl
    this.privateClient = createOssClient({
      region: oss.region,
      endpoint: oss.endpoint,
      bucket: oss.bucket,
      accessKeyId: oss.accessKeyId,
      accessKeySecret: oss.accessKeySecret,
      authorizationV4: true,
      secure: true,
      timeout: 120_000,
    })
    this.publicClient = createOssClient({
      region: oss.region,
      endpoint: oss.endpoint,
      bucket: oss.publicBucket,
      accessKeyId: oss.accessKeyId,
      accessKeySecret: oss.accessKeySecret,
      authorizationV4: true,
      secure: true,
      timeout: 120_000,
    })
  }

  async signConditionalPut(input: ConditionalPutInput) {
    const headers = {
      'Content-Type': input.contentType,
      'Content-MD5': input.contentMd5,
      'x-oss-meta-sha256': input.sha256,
      'x-oss-forbid-overwrite': 'true' as const,
    }
    const expiresSeconds = Math.max(
      1,
      Math.ceil((input.expiresAt - Date.now()) / 1_000),
    )
    const url = await (await this.privateClient).signatureUrlV4(
      'PUT',
      expiresSeconds,
      { headers },
      input.objectKey,
    )

    return {
      method: 'PUT' as const,
      url,
      expiresAt: new Date(input.expiresAt).toISOString(),
      headers,
    }
  }

  async signPrivateGet(objectKey: string, expiresAt: number) {
    const expiresSeconds = Math.max(
      1,
      Math.ceil((expiresAt - Date.now()) / 1_000),
    )
    return {
      url: await (await this.privateClient).signatureUrlV4(
        'GET',
        expiresSeconds,
        {},
        objectKey,
      ),
      expiresAt: new Date(expiresAt).toISOString(),
    }
  }

  async headPrivate(objectKey: string) {
    return this.head(await this.privateClient, objectKey)
  }

  async headPublic(objectKey: string) {
    return this.head(await this.publicClient, objectKey)
  }

  private async head(client: OssClient, objectKey: string) {
    const result = await client.head(objectKey)
    return {
      byteSize: Number(responseHeader(result, 'content-length')),
      contentType: responseHeader(result, 'content-type') ?? '',
      etagMd5Hex: (responseHeader(result, 'etag') ?? '')
        .replaceAll('"', '')
        .toLowerCase(),
      sha256Metadata: result.meta?.sha256 ?? null,
    }
  }

  async getPrivate(objectKey: string) {
    const result = await (await this.privateClient).get(objectKey)
    if (result.content === undefined) {
      throw new Error('OSS object body is unavailable.')
    }
    return Buffer.isBuffer(result.content)
      ? result.content
      : Buffer.from(result.content)
  }

  async imageInfoPrivate(objectKey: string) {
    return this.imageInfo(await this.privateClient, objectKey)
  }

  async imageInfoPublic(objectKey: string) {
    return this.imageInfo(await this.publicClient, objectKey)
  }

  private async imageInfo(client: OssClient, objectKey: string) {
    const result = await client.get(objectKey, {
      process: 'image/info',
    })
    const parsed = JSON.parse(Buffer.isBuffer(result.content)
      ? result.content.toString('utf8')
      : String(result.content)) as Record<
        string,
        { value?: string, Value?: string }
      >
    return {
      fileSize: Number(imageInfoValue(parsed, 'FileSize')),
      format: String(imageInfoValue(parsed, 'Format') ?? ''),
      height: Number(imageInfoValue(parsed, 'ImageHeight')),
      orientation: Number(imageInfoValue(parsed, 'Orientation') ?? 1),
      width: Number(imageInfoValue(parsed, 'ImageWidth')),
    }
  }

  async putPrivateConditional(input: PrivateObjectPutInput) {
    try {
      await (await this.privateClient).put(
        input.objectKey,
        input.content,
        {
          headers: {
            'Content-Type': input.contentType,
            'Content-MD5': input.contentMd5,
            'x-oss-meta-sha256': input.sha256,
            'x-oss-forbid-overwrite': 'true',
          },
        },
      )
    }
    catch (error) {
      const candidate = error as { code?: string, status?: number }
      if (candidate.code !== 'FileAlreadyExists' && candidate.status !== 409) {
        throw error
      }
    }
  }

  async processPrivateToPublic(input: PublicProcessInput) {
    await (await this.privateClient).processObjectSave(
      input.sourceObjectKey,
      input.objectKey,
      input.process,
      this.publicBucket,
    )
  }

  async getPublicAnonymous(objectKey: string) {
    const base = new URL(this.publicMediaBaseUrl)
    base.pathname = `${base.pathname.replace(/\/$/u, '')}/${objectKey
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`
    const response = await fetch(base)
    if (!response.ok) {
      throw new Error('Anonymous public object read failed.')
    }
    return {
      content: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? '',
    }
  }

  async deletePrivate(objectKey: string) {
    try {
      await (await this.privateClient).delete(objectKey)
    }
    catch (error) {
      const candidate = error as { code?: string, status?: number }
      if (candidate.code !== 'NoSuchKey' && candidate.status !== 404) {
        throw error
      }
    }
  }

  async deletePublic(objectKey: string) {
    try {
      await (await this.publicClient).delete(objectKey)
    }
    catch (error) {
      const candidate = error as { code?: string, status?: number }
      if (candidate.code !== 'NoSuchKey' && candidate.status !== 404) {
        throw error
      }
    }
  }
}

let mediaStorage: MediaStorage | undefined

export function getMediaStorage() {
  mediaStorage ??= new AliOssMediaStorage(getRuntimeConfig())
  return mediaStorage
}

// 仅限 APP_ENV=test：E2E fake 适配器在服务器启动时替换单例，生产与开发环境
// 调用会直接抛错，浏览器 E2E 因此可以走真实 HTTP 链路而不访问真实 Bucket。
export function setMediaStorageForTesting(storage: MediaStorage | undefined) {
  if (getRuntimeConfig().appEnv !== 'test') {
    throw new Error('Media storage override requires APP_ENV=test.')
  }
  mediaStorage = storage
}
