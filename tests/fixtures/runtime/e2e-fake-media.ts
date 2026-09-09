import type {
  ConditionalPutInput,
  MediaStorage,
  PrivateImageInfo,
} from '../../../server/utils/media-storage'
import { setExactObjectStoreForTesting } from '../../../server/utils/exact-object-storage'
import { setMediaStorageForTesting } from '../../../server/utils/media-storage'
import { getRuntimeConfig } from '../../../server/utils/runtime-config'
import { FakeMediaStorage } from '../../helpers/fake-media-storage'

export interface FakePutRecord {
  byteSize: number
  contentMd5: string | null
  contentType: string | null
  forbidOverwrite: string | null
  objectKey: string
  sha256Metadata: string | null
}

// 浏览器 E2E 专用 fake：签名 URL 指向管理端同源测试端点，浏览器因此执行真实的
// 条件 PUT 链路与请求头，而对象只落在 dev server 内存中，不访问真实 Bucket。
// 该单例只由 test 构建注册（nuxt.config 的 includeRuntimeErrorFixtures 分支），
// 生产产物不包含这些模块。
export class E2eFakeMediaStorage extends FakeMediaStorage {
  readonly imageInfoOverrides = new Map<string, PrivateImageInfo>()
  readonly putRecords: FakePutRecord[] = []
  omitSha256OnNextPut = false
  rejectNextPut403 = false

  override async signConditionalPut(input: ConditionalPutInput) {
    if (this.failSign) {
      throw new Error('fake sign failure')
    }
    this.signedPuts.push(input)
    const adminBase = getRuntimeConfig().adminBaseUrl
    return {
      method: 'PUT' as const,
      url: `${adminBase}/api/e2e-fake-oss/${input.objectKey}`,
      expiresAt: new Date(input.expiresAt).toISOString(),
      headers: {
        'Content-Type': input.contentType,
        'Content-MD5': input.contentMd5,
        'x-oss-meta-sha256': input.sha256,
        'x-oss-forbid-overwrite': 'true' as const,
      },
    }
  }

  override async signPrivateGet(objectKey: string, expiresAt: number) {
    if (this.failSign) {
      throw new Error('fake sign failure')
    }
    return {
      url: `${getRuntimeConfig().adminBaseUrl}/api/e2e-fake-oss/${objectKey}`,
      expiresAt: new Date(expiresAt).toISOString(),
    }
  }

  override async imageInfoPrivate(objectKey: string) {
    const override = this.imageInfoOverrides.get(objectKey)
    if (override) {
      return { ...override }
    }
    return super.imageInfoPrivate(objectKey)
  }

  resetKnobs() {
    this.failDelete = false
    this.failGet = false
    this.failImageInfo = false
    this.failPut = false
    this.failProcess = false
    this.failSign = false
    this.omitSha256OnNextPut = false
    this.rejectNextPut403 = false
    this.imageInfoOverrides.clear()
    // 记录与对象随用例重置：断言始终相对当前用例的干净状态。
    this.deletedPrivateKeys.length = 0
    this.deletedPublicKeys.length = 0
    this.objects.clear()
    this.publicObjects.clear()
    this.privatePuts.length = 0
    this.privateProcessCalls.length = 0
    this.processCalls.length = 0
    this.signedPuts.length = 0
    this.putRecords.length = 0
  }
}

let e2eFakeMediaStorage: E2eFakeMediaStorage | undefined

export function getE2eFakeMediaStorage() {
  if (!e2eFakeMediaStorage) {
    throw new Error('E2E fake media storage is not installed.')
  }
  return e2eFakeMediaStorage
}

export function installE2eFakeMediaStorage(): MediaStorage {
  e2eFakeMediaStorage ??= new E2eFakeMediaStorage()
  setMediaStorageForTesting(e2eFakeMediaStorage)
  setExactObjectStoreForTesting({
    async inspect(scope, objectKey) {
      const objects = scope === 'private'
        ? e2eFakeMediaStorage!.objects
        : e2eFakeMediaStorage!.publicObjects
      return {
        current: objects.has(objectKey),
        deleteMarkers: 0,
        versionBytes: 0,
        versions: 0,
      }
    },
    async deleteAll(scope, objectKey) {
      if (scope === 'private') {
        await e2eFakeMediaStorage!.deletePrivate(objectKey)
      }
      else {
        await e2eFakeMediaStorage!.deletePublic(objectKey)
      }
    },
  })
  return e2eFakeMediaStorage
}
