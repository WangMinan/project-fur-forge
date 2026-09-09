import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { AliOssMediaStorage } from '../../server/utils/media-storage'
import { loadRuntimeConfig } from '../../server/utils/runtime-config'

describe('AliOssMediaStorage endpoint separation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('signs browser PUTs against the configured public Bucket origin', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const config = loadRuntimeConfig({
      env: {
        APP_ENV: 'test',
        PUBLIC_BASE_URL: 'http://public.test',
        ADMIN_BASE_URL: 'http://admin.test',
        MEDIA_BASE_URL: 'https://media.test',
        OSS_UPLOAD_BASE_URL:
          'https://private-bucket.oss-cn-hangzhou.aliyuncs.com',
        OSS_REGION: 'oss-cn-hangzhou',
        OSS_PRIVATE_BUCKET: 'private-bucket',
        OSS_PUBLIC_BUCKET: 'public-bucket',
        OSS_ENDPOINT: 'https://oss-cn-hangzhou-internal.aliyuncs.com',
        OSS_ACCESS_KEY_ID: 'test-access-key-id',
        OSS_ACCESS_KEY_SECRET: 'test-access-key-secret',
      },
    })
    const storage = new AliOssMediaStorage(config)

    const signed = await storage.signConditionalPut({
      contentMd5: 'AAAAAAAAAAAAAAAAAAAAAA==',
      contentType: 'image/png',
      expiresAt: Date.now() + 300_000,
      objectKey: 'test/upload/example.png',
      sha256: 'd'.repeat(64),
    })
    const url = new URL(signed.url)

    expect(url.origin).toBe(config.ossUploadBaseUrl)
    expect(url.pathname).toBe('/test/upload/example.png')
    expect(url.hostname).not.toContain('-internal')
    expect(url.searchParams.get('x-oss-signature-version'))
      .toBe('OSS4-HMAC-SHA256')
    expect(signed.headers).toMatchObject({
      'Content-MD5': 'AAAAAAAAAAAAAAAAAAAAAA==',
      'x-oss-forbid-overwrite': 'true',
    })
  })
})
