import type { ConditionalPutDto } from '../../shared/types/contracts'
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

export interface MediaStorage {
  deletePrivate(objectKey: string): Promise<void>
  getPrivate(objectKey: string): Promise<Buffer>
  headPrivate(objectKey: string): Promise<PrivateObjectHead>
  imageInfoPrivate(objectKey: string): Promise<PrivateImageInfo>
  putPrivateConditional(input: PrivateObjectPutInput): Promise<void>
  signConditionalPut(input: ConditionalPutInput): Promise<ConditionalPutDto>
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

  constructor(config: RuntimeConfig) {
    const oss = requiredOssConfig(config)
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

  async headPrivate(objectKey: string) {
    const result = await (await this.privateClient).head(objectKey)
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
    const result = await (await this.privateClient).get(objectKey, {
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
}

let mediaStorage: MediaStorage | undefined

export function getMediaStorage() {
  mediaStorage ??= new AliOssMediaStorage(getRuntimeConfig())
  return mediaStorage
}
