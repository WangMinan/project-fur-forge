import { createHash } from 'node:crypto'
import type {
  ConditionalPutInput,
  MediaStorage,
  PrivateImageInfo,
  PrivateObjectPutInput,
} from '../../server/utils/media-storage'

interface FakeObject {
  content: Buffer
  contentType: string
  imageInfo: PrivateImageInfo
  sha256Metadata: string | null
}

function pngInfo(content: Buffer): PrivateImageInfo {
  return {
    fileSize: content.length,
    format: 'png',
    height: content.readUInt32BE(20),
    orientation: 1,
    width: content.readUInt32BE(16),
  }
}

export class FakeMediaStorage implements MediaStorage {
  readonly deletedPrivateKeys: string[] = []
  readonly objects = new Map<string, FakeObject>()
  readonly privatePuts: PrivateObjectPutInput[] = []
  readonly signedPuts: ConditionalPutInput[] = []
  failDelete = false
  failGet = false
  failImageInfo = false
  failPut = false
  failSign = false

  seedPrivate(
    objectKey: string,
    content: Buffer,
    contentType: string,
    sha256Metadata = createHash('sha256').update(content).digest('hex'),
    imageInfo = pngInfo(content),
  ) {
    this.objects.set(objectKey, {
      content: Buffer.from(content),
      contentType,
      imageInfo,
      sha256Metadata,
    })
  }

  async signConditionalPut(input: ConditionalPutInput) {
    if (this.failSign) {
      throw new Error('fake sign failure')
    }
    this.signedPuts.push(input)
    return {
      method: 'PUT' as const,
      url: `https://upload.test/${input.objectKey}`,
      expiresAt: new Date(input.expiresAt).toISOString(),
      headers: {
        'Content-Type': input.contentType,
        'Content-MD5': input.contentMd5,
        'x-oss-meta-sha256': input.sha256,
        'x-oss-forbid-overwrite': 'true' as const,
      },
    }
  }

  async deletePrivate(objectKey: string) {
    if (this.failDelete) {
      throw new Error('fake delete failure')
    }
    this.deletedPrivateKeys.push(objectKey)
    this.objects.delete(objectKey)
  }

  async headPrivate(objectKey: string) {
    const object = this.objects.get(objectKey)
    if (!object) {
      throw Object.assign(new Error('fake object missing'), {
        code: 'NoSuchKey',
        status: 404,
      })
    }
    return {
      byteSize: object.content.length,
      contentType: object.contentType,
      etagMd5Hex: createHash('md5').update(object.content).digest('hex'),
      sha256Metadata: object.sha256Metadata,
    }
  }

  async getPrivate(objectKey: string) {
    if (this.failGet) {
      throw new Error('fake get failure')
    }
    const object = this.objects.get(objectKey)
    if (!object) {
      throw Object.assign(new Error('fake object missing'), {
        code: 'NoSuchKey',
        status: 404,
      })
    }
    return Buffer.from(object.content)
  }

  async imageInfoPrivate(objectKey: string) {
    if (this.failImageInfo) {
      throw new Error('fake image info failure')
    }
    const object = this.objects.get(objectKey)
    if (!object) {
      throw Object.assign(new Error('fake object missing'), {
        code: 'NoSuchKey',
        status: 404,
      })
    }
    return { ...object.imageInfo }
  }

  async putPrivateConditional(input: PrivateObjectPutInput) {
    if (this.failPut) {
      throw new Error('fake put failure')
    }
    this.privatePuts.push(input)
    if (!this.objects.has(input.objectKey)) {
      this.seedPrivate(
        input.objectKey,
        input.content,
        input.contentType,
        input.sha256,
      )
    }
  }
}
