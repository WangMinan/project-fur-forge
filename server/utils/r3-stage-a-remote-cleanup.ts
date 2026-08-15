import { setTimeout as delay } from 'node:timers/promises'
import type { RuntimeConfig } from './runtime-config'
import type {
  R3StageACachePurger,
  R3StageAObjectInspection,
  R3StageAObjectScope,
  R3StageAObjectStore,
} from './runner/r3-stage-a-retirement'
import type { PublicMediaCache } from './public-media-cache'
import { MAX_EDGE_PURGE_FILES } from './public-media-cache'

interface OssVersionEntry {
  isLatest?: boolean
  name: string
  size?: number
  versionId: string
}

interface OssVersionsPage {
  deleteMarker?: OssVersionEntry[]
  isTruncated: boolean
  nextKeyMarker?: string | null
  nextVersionIdMarker?: string | null
  objects?: OssVersionEntry[]
}

interface OssCleanupClient {
  delete(objectKey: string): Promise<unknown>
  deleteMulti(
    objects: { key: string, versionId: string }[],
    options?: { quiet?: boolean },
  ): Promise<unknown>
  getBucketVersions(query: {
    keyMarker?: string
    maxKeys?: number
    prefix: string
    versionIdMarker?: string
  }): Promise<OssVersionsPage>
  head(objectKey: string): Promise<{
    res?: { headers?: Record<string, string> }
  }>
}

interface OssConstructor {
  new(options: Record<string, unknown>): OssCleanupClient
}

interface ExactVersionInventory {
  current: boolean
  deleteMarkers: OssVersionEntry[]
  unversionedCurrent: boolean
  versions: OssVersionEntry[]
}

function isMissing(error: unknown) {
  const candidate = error as { code?: string, status?: number }
  return candidate.code === 'NoSuchKey'
    || candidate.code === 'NotFound'
    || candidate.status === 404
}

async function createClient(config: RuntimeConfig, bucket: string) {
  const moduleName = ['ali', 'oss'].join('-')
  const module = await import(moduleName) as { default: OssConstructor }
  return new module.default({
    accessKeyId: config.ossAccessKeyId,
    accessKeySecret: config.ossAccessKeySecret,
    authorizationV4: true,
    bucket,
    endpoint: config.ossEndpoint,
    region: config.ossRegion,
    secure: true,
    timeout: 120_000,
  })
}

async function exactVersions(
  client: OssCleanupClient,
  objectKey: string,
): Promise<ExactVersionInventory> {
  const versions: OssVersionEntry[] = []
  const deleteMarkers: OssVersionEntry[] = []
  let keyMarker: string | undefined
  let versionIdMarker: string | undefined
  let truncated = true
  while (truncated) {
    const page = await client.getBucketVersions({
      prefix: objectKey,
      maxKeys: 1_000,
      ...(keyMarker ? { keyMarker } : {}),
      ...(versionIdMarker ? { versionIdMarker } : {}),
    })
    versions.push(...(page.objects ?? []).filter(item => item.name === objectKey))
    deleteMarkers.push(...(page.deleteMarker ?? [])
      .filter(item => item.name === objectKey))
    truncated = page.isTruncated
    if (!truncated) break
    if (!page.nextKeyMarker) {
      throw new Error('OSS version listing did not advance.')
    }
    keyMarker = page.nextKeyMarker
    versionIdMarker = page.nextVersionIdMarker ?? undefined
  }

  let headExists = false
  try {
    await client.head(objectKey)
    headExists = true
  }
  catch (error) {
    if (!isMissing(error)) throw error
  }
  const explicitCurrent = versions.some(item => item.isLatest)
    && !deleteMarkers.some(item => item.isLatest)
  return {
    current: headExists || explicitCurrent,
    deleteMarkers,
    unversionedCurrent: headExists && versions.length === 0,
    versions,
  }
}

function chunks<T>(items: readonly T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

export class AliOssR3StageAObjectStore implements R3StageAObjectStore {
  readonly #privateClient: Promise<OssCleanupClient>
  readonly #publicClient: Promise<OssCleanupClient>

  constructor(config: RuntimeConfig) {
    if (
      !config.ossPrivateBucket
      || !config.ossPublicBucket
      || !config.ossEndpoint
      || !config.ossRegion
      || !config.ossAccessKeyId
      || !config.ossAccessKeySecret
    ) {
      throw new Error('R3-A OSS configuration is incomplete.')
    }
    this.#privateClient = createClient(config, config.ossPrivateBucket)
    this.#publicClient = createClient(config, config.ossPublicBucket)
  }

  #client(scope: R3StageAObjectScope) {
    return scope === 'private' ? this.#privateClient : this.#publicClient
  }

  async inspect(
    scope: R3StageAObjectScope,
    objectKey: string,
  ): Promise<R3StageAObjectInspection> {
    try {
      const found = await exactVersions(await this.#client(scope), objectKey)
      return {
        current: found.current,
        deleteMarkers: found.deleteMarkers.length,
        versionBytes: found.versions.reduce(
          (total, item) => total + Number(item.size ?? 0),
          0,
        ),
        versions: found.versions.length,
      }
    }
    catch {
      throw new Error('R3-A OSS inventory failed.')
    }
  }

  async deleteAll(scope: R3StageAObjectScope, objectKey: string) {
    const client = await this.#client(scope)
    const found = await exactVersions(client, objectKey)
    const versioned = [...found.versions, ...found.deleteMarkers]
      .filter(item => item.versionId !== '')
      .map(item => ({ key: objectKey, versionId: item.versionId }))
    for (const batch of chunks(versioned, 1_000)) {
      await client.deleteMulti(batch, { quiet: true })
    }
    if (found.unversionedCurrent) {
      await client.delete(objectKey)
    }
  }
}

export class R3StageAEsaCachePurger implements R3StageACachePurger {
  constructor(private readonly cache: PublicMediaCache) {}

  async purgeExactAndWait(urls: readonly string[]) {
    if (!this.cache.enabled) {
      throw new Error('R3-A ESA cache purge is unavailable.')
    }
    for (const batch of chunks(urls, MAX_EDGE_PURGE_FILES)) {
      const taskId = await this.cache.purgeExactFiles(batch)
      let complete = false
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const status = await this.cache.describeExactFilePurge(taskId, batch)
        if (status === 'Complete') {
          complete = true
          break
        }
        if (status === 'Failed') {
          throw new Error('ESA reported a failed purge task.')
        }
        await delay(2_000)
      }
      if (!complete) {
        throw new Error('ESA purge did not complete before the timeout.')
      }
    }
  }
}
