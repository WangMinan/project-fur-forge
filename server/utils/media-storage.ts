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

export interface MediaStorage {
  deletePrivate(objectKey: string): Promise<void>
  signConditionalPut(input: ConditionalPutInput): Promise<ConditionalPutDto>
}

interface OssClient {
  delete(objectKey: string): Promise<unknown>
  signatureUrlV4(
    method: string,
    expires: number,
    options: { headers?: Record<string, string> },
    objectKey: string,
  ): Promise<string>
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
