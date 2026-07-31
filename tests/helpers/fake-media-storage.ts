import { createHash } from 'node:crypto'
import type {
  ConditionalPutInput,
  MediaStorage,
  PrivateImageInfo,
  PrivateObjectPutInput,
  PublicProcessInput,
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
  readonly deletedPublicKeys: string[] = []
  readonly objects = new Map<string, FakeObject>()
  readonly publicObjects = new Map<string, FakeObject>()
  readonly privatePuts: PrivateObjectPutInput[] = []
  readonly processCalls: PublicProcessInput[] = []
  readonly signedPuts: ConditionalPutInput[] = []
  failDelete = false
  failGet = false
  failImageInfo = false
  failPut = false
  failProcess = false
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
    return this.head(this.objects, objectKey)
  }

  async headPublic(objectKey: string) {
    return this.head(this.publicObjects, objectKey)
  }

  private async head(objects: Map<string, FakeObject>, objectKey: string) {
    const object = objects.get(objectKey)
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

  async imageInfoPublic(objectKey: string) {
    const object = this.publicObjects.get(objectKey)
    if (!object) {
      throw Object.assign(new Error('fake public object missing'), {
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

  async processPrivateToPublic(input: PublicProcessInput) {
    if (this.failProcess) {
      throw new Error('fake process failure')
    }
    const source = this.objects.get(input.sourceObjectKey)
    if (!source) {
      throw new Error('fake process source missing')
    }
    this.processCalls.push(input)
    const resize = /resize,[^/]+/u.exec(input.process)?.[0] ?? ''
    const width = Number(/(?:^|,)w_(\d+)/u.exec(resize)?.[1]
      ?? source.imageInfo.width)
    const height = Number(/(?:^|,)h_(\d+)/u.exec(resize)?.[1]
      ?? Math.round(width * source.imageInfo.height / source.imageInfo.width))
    const format = /format,(webp|jpg|png)/u.exec(input.process)?.[1] ?? 'webp'
    const contentType = format === 'jpg' ? 'image/jpeg' : `image/${format}`
    const content = createHash('sha256')
      .update(source.content)
      .update(input.process)
      .digest()
    this.publicObjects.set(input.objectKey, {
      content,
      contentType,
      imageInfo: {
        fileSize: content.length,
        format,
        height,
        orientation: 1,
        width,
      },
      sha256Metadata: null,
    })
  }

  async getPublicAnonymous(objectKey: string) {
    const object = this.publicObjects.get(objectKey)
    if (!object) {
      throw new Error('fake anonymous public object missing')
    }
    return {
      content: Buffer.from(object.content),
      contentType: object.contentType,
    }
  }

  async deletePublic(objectKey: string) {
    if (this.failDelete) {
      throw new Error('fake public delete failure')
    }
    this.deletedPublicKeys.push(objectKey)
    this.publicObjects.delete(objectKey)
  }
}
