import EsaClient, {
  DescribePurgeTasksRequest,
  PurgeCachesRequest,
  PurgeCachesRequestContent,
} from '@alicloud/esa20240910'
import { $OpenApiUtil } from '@alicloud/openapi-core'
import type { RuntimeConfig } from './runtime-config'
import { getRuntimeConfig } from './runtime-config'

export const MAX_EDGE_PURGE_FILES = 1_000

export type PublicMediaPurgeTaskStatus =
  | 'Complete'
  | 'Failed'
  | 'Missing'
  | 'Refreshing'

export interface PublicMediaCache {
  readonly enabled: boolean
  readonly mediaOrigin: string | null
  describeExactFilePurge(
    taskId: string,
    urls: readonly string[],
  ): Promise<PublicMediaPurgeTaskStatus>
  purgeExactFiles(urls: readonly string[]): Promise<string>
}

export function assertExactPublicMediaUrls(
  urls: readonly string[],
  mediaOrigin: string,
) {
  if (
    urls.length < 1
    || urls.length > MAX_EDGE_PURGE_FILES
    || new Set(urls).size !== urls.length
  ) {
    throw new Error('ESA purge requires 1 to 1000 unique exact file URLs.')
  }

  for (const value of urls) {
    const url = new URL(value)
    if (
      url.origin !== new URL(mediaOrigin).origin
      || !url.pathname.startsWith('/prod/web/')
      || url.pathname.endsWith('/')
      || url.search !== ''
      || url.hash !== ''
      || url.username !== ''
      || url.password !== ''
    ) {
      throw new Error('ESA purge URL must be one exact production media file URL.')
    }
  }
}

export class AliEsaPublicMediaCache implements PublicMediaCache {
  readonly enabled = true
  readonly mediaOrigin: string
  readonly #client: EsaClient
  readonly #siteId: number

  constructor(config: RuntimeConfig) {
    if (
      config.appEnv !== 'production'
      || !config.esaSiteId
      || !config.esaApiEndpoint
      || !config.ossAccessKeyId
      || !config.ossAccessKeySecret
    ) {
      throw new Error('Production ESA cache configuration is incomplete.')
    }
    this.mediaOrigin = config.mediaBaseUrl
    this.#siteId = Number(config.esaSiteId)
    this.#client = new EsaClient(new $OpenApiUtil.Config({
      accessKeyId: config.ossAccessKeyId,
      accessKeySecret: config.ossAccessKeySecret,
      endpoint: new URL(config.esaApiEndpoint).hostname,
      protocol: 'HTTPS',
      regionId: 'cn-hangzhou',
      connectTimeout: 10_000,
      readTimeout: 60_000,
    }))
  }

  async purgeExactFiles(urls: readonly string[]) {
    assertExactPublicMediaUrls(urls, this.mediaOrigin)
    const response = await this.#client.purgeCaches(new PurgeCachesRequest({
      siteId: this.#siteId,
      type: 'file',
      content: new PurgeCachesRequestContent({ files: [...urls] }),
    }))
    const taskId = String(response.body?.taskId ?? '').trim()
    if (response.statusCode !== 200 || taskId === '') {
      throw new Error('ESA exact file purge did not return a task ID.')
    }
    return taskId
  }

  async describeExactFilePurge(taskId: string, urls: readonly string[]) {
    const normalizedTaskId = taskId.trim()
    if (normalizedTaskId === '' || normalizedTaskId.length > 200) {
      throw new Error('ESA purge task ID is invalid.')
    }
    assertExactPublicMediaUrls(urls, this.mediaOrigin)
    const response = await this.#client.describePurgeTasks(
      new DescribePurgeTasksRequest({
        content: urls[0],
        pageNumber: 1,
        pageSize: 50,
        siteId: this.#siteId,
        type: 'file',
      }),
    )
    if (response.statusCode !== 200) {
      throw new Error('ESA purge task query failed.')
    }
    const task = response.body?.tasks?.find(candidate => (
      String(candidate.taskId ?? '') === normalizedTaskId
    ))
    const status = task?.status
    if (
      status === 'Complete'
      || status === 'Failed'
      || status === 'Refreshing'
    ) {
      return status
    }
    return 'Missing'
  }
}

const disabledPublicMediaCache: PublicMediaCache = {
  enabled: false,
  mediaOrigin: null,
  async describeExactFilePurge() {
    throw new Error('ESA cache purge is disabled outside production.')
  },
  async purgeExactFiles() {
    throw new Error('ESA cache purge is disabled outside production.')
  },
}

let cachedPublicMediaCache: PublicMediaCache | undefined
let testPublicMediaCache: PublicMediaCache | undefined

export function getPublicMediaCache() {
  if (testPublicMediaCache) {
    return testPublicMediaCache
  }
  cachedPublicMediaCache ??= getRuntimeConfig().appEnv === 'production'
    ? new AliEsaPublicMediaCache(getRuntimeConfig())
    : disabledPublicMediaCache
  return cachedPublicMediaCache
}

export function setPublicMediaCacheForTests(cache?: PublicMediaCache) {
  if (getRuntimeConfig().appEnv !== 'test') {
    throw new Error('Public media cache overrides are test-only.')
  }
  testPublicMediaCache = cache
}
