import type { MediaStorage } from '../media-storage'
import { contentTypeForFormat, digest, normalizedFormat } from '../recipe/media-source'
import type { PublicFormat } from '../recipe/media-source'

/** Validate the stored object and the bytes actually served to an anonymous visitor. */
export async function verifyPublicImage(storage: MediaStorage, variant: {
  objectKey: string
  byteSize: number | null
  sha256: string | null
  width: number
  height: number
  format: PublicFormat
}) {
  const [head, info, anonymous] = await Promise.all([
    storage.headPublic(variant.objectKey),
    storage.imageInfoPublic(variant.objectKey),
    storage.getPublicAnonymous(variant.objectKey),
  ])
  return head.byteSize === variant.byteSize
    && head.byteSize === anonymous.content.length
    && head.etagMd5Hex === digest('md5', anonymous.content)
    && head.contentType === contentTypeForFormat(variant.format)
    && anonymous.contentType === contentTypeForFormat(variant.format)
    && info.fileSize === head.byteSize
    && normalizedFormat(info.format) === variant.format
    && info.width === variant.width
    && info.height === variant.height
    && digest('sha256', anonymous.content) === variant.sha256
}
