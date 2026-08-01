import { createHash } from 'node:crypto'
import {
  defineEventHandler,
  getHeader,
  getRequestURL,
  readRawBody,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import { getE2eFakeMediaStorage } from './e2e-fake-media'

const ROUTE_PREFIX = '/api/e2e-fake-oss/'

// 模拟 OSS 条件 PUT：校验 Content-MD5 与禁止覆盖，按真实头元数据落库到内存 fake。
export default defineEventHandler(async (event) => {
  const objectKey = getRequestURL(event).pathname.slice(ROUTE_PREFIX.length)
  if (!objectKey) {
    setResponseStatus(event, 400)
    return { error: 'object key missing' }
  }

  const fake = getE2eFakeMediaStorage()
  if (event.method === 'GET') {
    const object = fake.objects.get(objectKey)
    if (!object) {
      setResponseStatus(event, 404)
      return { error: 'NoSuchKey' }
    }
    setResponseHeader(event, 'content-type', object.contentType)
    return object.content
  }
  if (event.method !== 'PUT') {
    setResponseStatus(event, 405)
    return { error: 'method not allowed' }
  }

  if (fake.rejectNextPut403) {
    // 与真实 OSS 过期 V4 签名一致：PUT 直接被 403 拒绝。
    fake.rejectNextPut403 = false
    setResponseStatus(event, 403)
    return { error: 'AccessDenied', message: 'Request has expired.' }
  }
  const forbidOverwrite = getHeader(event, 'x-oss-forbid-overwrite') ?? null
  if (forbidOverwrite === 'true' && fake.objects.has(objectKey)) {
    setResponseStatus(event, 409)
    return { error: 'FileAlreadyExists' }
  }

  const content = await readRawBody(event, false)
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content ?? '')
  const contentMd5 = getHeader(event, 'content-md5') ?? null
  if (contentMd5) {
    const actual = createHash('md5').update(bytes).digest('base64')
    if (actual !== contentMd5) {
      setResponseStatus(event, 400)
      return { error: 'InvalidDigest' }
    }
  }

  const contentType = getHeader(event, 'content-type') ?? 'application/octet-stream'
  const sha256Metadata = fake.omitSha256OnNextPut
    ? null
    : getHeader(event, 'x-oss-meta-sha256') ?? null
  fake.omitSha256OnNextPut = false

  fake.seedPrivate(objectKey, bytes, contentType, sha256Metadata)
  fake.putRecords.push({
    byteSize: bytes.length,
    contentMd5,
    contentType,
    forbidOverwrite,
    objectKey,
    sha256Metadata,
  })

  setResponseHeader(
    event,
    'etag',
    `"${createHash('md5').update(bytes).digest('hex').toUpperCase()}"`,
  )
  return { ok: true }
})
