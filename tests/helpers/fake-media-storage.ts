import type {
  ConditionalPutInput,
  MediaStorage,
} from '../../server/utils/media-storage'

export class FakeMediaStorage implements MediaStorage {
  readonly deletedPrivateKeys: string[] = []
  readonly signedPuts: ConditionalPutInput[] = []
  failDelete = false
  failSign = false

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
  }
}
