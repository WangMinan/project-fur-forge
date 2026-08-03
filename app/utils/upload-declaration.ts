import { md5Base64 } from './md5'

// 上传声明：浏览器在创建上传会话前对所选文件做预检查并计算摘要/尺寸。
// 声明值只是“浏览器声明”，只有服务端核验通过后才显示为已验证。

export const DECLARABLE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type DeclarableContentType = typeof DECLARABLE_CONTENT_TYPES[number]

export interface UploadDeclaration {
  byteSize: number
  contentMd5: string
  contentType: DeclarableContentType
  height: number
  sha256: string
  width: number
}

export type DeclarationFailure
  = | 'content-type'
    | 'byte-size'
    | 'decode'
    | 'dimensions'

export const DECLARATION_FAILURE_LABELS: Record<DeclarationFailure, string> = {
  'content-type': '仅支持 JPEG、PNG 或 WebP 图片',
  'byte-size': '文件大小需在 1 字节到 30 MB 之间',
  'decode': '浏览器无法解码该文件，请选择有效的图片',
  'dimensions': '图片边长不能超过 12,000 像素',
}

function contentTypeFromBytes(bytes: Uint8Array): DeclarableContentType | null {
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4E
    && bytes[3] === 0x47
    && bytes[4] === 0x0D
    && bytes[5] === 0x0A
    && bytes[6] === 0x1A
    && bytes[7] === 0x0A
  ) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

export async function buildUploadDeclaration(
  file: File,
): Promise<
  | { declaration: UploadDeclaration, ok: true }
  | { ok: false, reason: DeclarationFailure }
> {
  if (file.size < 1 || file.size > 30_000_000) {
    return { ok: false, reason: 'byte-size' }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const declaredContentType = file.type as DeclarableContentType
  const contentType = contentTypeFromBytes(bytes)
  if (!contentType) {
    return {
      ok: false,
      reason: DECLARABLE_CONTENT_TYPES.includes(declaredContentType)
        ? 'decode'
        : 'content-type',
    }
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(
    new Uint8Array(digest),
    byte => byte.toString(16).padStart(2, '0'),
  ).join('')

  let bitmap: ImageBitmap
  try {
    // 默认 imageOrientation: 'from-image'：浏览器按 EXIF 方向解码，
    // 与服务端 OSS imageInfo 的修正后尺寸口径一致。
    bitmap = await createImageBitmap(new Blob([bytes], { type: contentType }))
  }
  catch {
    return { ok: false, reason: 'decode' }
  }
  const { width, height } = bitmap
  bitmap.close()

  if (width < 1 || height < 1 || width > 12_000 || height > 12_000) {
    return { ok: false, reason: 'dimensions' }
  }

  return {
    ok: true,
    declaration: {
      byteSize: bytes.length,
      contentMd5: md5Base64(bytes),
      contentType,
      height,
      sha256,
      width,
    },
  }
}
