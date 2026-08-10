import { describe, expect, it } from 'vitest'
import {
  compressPngForOss,
  OSS_IMAGE_PROCESSING_MAX_BYTES,
  upscaleDesignSheetImage,
  upscaleHeroImage,
  upscaleImageToMinimum,
} from '../../scripts/embedded-ffmpeg.mjs'
import {
  assertExactObjectScope,
  contentDigests,
  createLargeSyntheticPng,
  createRunId,
  createSyntheticSourcePng,
  createSyntheticWatermarkPng,
  evaluateCorsRules,
  EXPECTED_PRIVATE_BUCKET,
  ORIGINAL_IMAGE_MAX_BYTES,
  PREFLIGHT_IMAGE_MIN_BYTES,
  REQUIRED_PUT_HEADERS,
  testPrefixFor,
  urlSafeBase64,
} from '../../scripts/oss-preflight-core.mjs'

describe('T10 OSS preflight scope', () => {
  it('uses a unique, auditable test prefix', () => {
    const runId = createRunId(
      new Date('2026-07-31T12:34:56.000Z'),
      Buffer.from('01020304', 'hex'),
    )

    expect(runId).toBe('t10-20260731T123456Z-01020304')
    expect(testPrefixFor(runId)).toBe(
      'test/t10-20260731T123456Z-01020304/',
    )
  })

  it('allows only an exact object below the run prefix', () => {
    const prefix = 'test/t10-20260731T123456Z-01020304/'
    const valid = {
      bucket: EXPECTED_PRIVATE_BUCKET,
      expectedBucket: EXPECTED_PRIVATE_BUCKET,
      key: `${prefix}private/source.png`,
      prefix,
    }

    expect(() => assertExactObjectScope(valid)).not.toThrow()
    expect(() => assertExactObjectScope({
      ...valid,
      bucket: 'other-bucket',
    })).toThrow(/bucket/u)
    expect(() => assertExactObjectScope({
      ...valid,
      key: 'test/another-run/private/source.png',
    })).toThrow(/prefix/u)
    expect(() => assertExactObjectScope({
      ...valid,
      key: `${prefix}../source.png`,
    })).toThrow(/prefix/u)
  })
})

describe('T10 synthetic media', () => {
  it('generates a deterministic 20–30 MB PNG within the product limit', () => {
    const first = createLargeSyntheticPng()
    const second = createLargeSyntheticPng()

    expect(first.subarray(0, 8)).toEqual(
      Buffer.from('89504e470d0a1a0a', 'hex'),
    )
    expect(first.length).toBeGreaterThanOrEqual(PREFLIGHT_IMAGE_MIN_BYTES)
    expect(first.length).toBeLessThanOrEqual(ORIGINAL_IMAGE_MAX_BYTES)
    expect(contentDigests(first).sha256).toBe(
      contentDigests(second).sha256,
    )
    const compressed = compressPngForOss(first)

    expect(compressed.content.length).toBeLessThanOrEqual(
      OSS_IMAGE_PROCESSING_MAX_BYTES,
    )
    expect(compressed.content.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(compressed.contentType).toBe('image/png')
    expect(compressed.dimensions).toEqual({
      width: 4096,
      height: 444,
    })
    expect(compressed.binary).toMatchObject({
      provider: 'ffmpeg-static',
      usedPathLookup: false,
    })
    // 同一个 ffmpeg-static 版本在不同平台打包不同的 ffmpeg 构建
    // （Windows 是 6.1.1-essentials，Linux 是 7.0.2-static），因此不能钉死
    // 具体版本号——本地绿而 CI 必红。真正要守的是：用的是内置二进制、
    // 没有回退到 PATH、且版本号可解析。
    expect(compressed.binary.version).toMatch(/^ffmpeg version \d+\.\d+/u)
    expect(compressed.binary.sha256).toMatch(/^[a-f0-9]{64}$/u)
  }, 30_000)

  it('generates a separate deterministic PNG watermark source', () => {
    const watermark = createSyntheticWatermarkPng()

    expect(watermark.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(watermark.length).toBeLessThan(100_000)
    expect(contentDigests(watermark).sha256).toMatch(/^[a-f0-9]{64}$/u)
  })

  it('generates representative source ratios for watermark previews', () => {
    const source = createSyntheticSourcePng(1200, 1600)

    expect(source.readUInt32BE(16)).toBe(1200)
    expect(source.readUInt32BE(20)).toBe(1600)
    expect(contentDigests(source).sha256).toMatch(/^[a-f0-9]{64}$/u)
  })

  it('uses deterministic Lanczos sizing for confirmed low-resolution hero images', () => {
    const source = createSyntheticSourcePng(320, 180)
    const landscape = upscaleHeroImage(source, 'landscape')
    const portrait = upscaleHeroImage(source, 'portrait')

    expect(landscape.dimensions).toEqual({ width: 1920, height: 1080 })
    expect(portrait.dimensions).toEqual({ width: 1080, height: 1920 })
    expect(landscape.filter).toContain('flags=lanczos')
    expect(landscape.content.length).toBeLessThanOrEqual(
      OSS_IMAGE_PROCESSING_MAX_BYTES,
    )
    expect(source.readUInt32BE(16)).toBe(320)
    expect(source.readUInt32BE(20)).toBe(180)
  }, 30_000)

  it('keeps a low-resolution design sheet proportional while meeting publication minimums', () => {
    const source = createSyntheticSourcePng(1560, 1080)
    const adapted = upscaleDesignSheetImage(source, {
      width: 2400,
      height: 0,
    })

    expect(adapted.dimensions.width).toBe(2400)
    expect(adapted.dimensions.width / adapted.dimensions.height)
      .toBeCloseTo(1560 / 1080, 2)
    expect(adapted.filter).toContain('flags=lanczos')
    expect(adapted.content.length).toBeLessThanOrEqual(
      OSS_IMAGE_PROCESSING_MAX_BYTES,
    )
    expect(source.readUInt32BE(16)).toBe(1560)
    expect(source.readUInt32BE(20)).toBe(1080)
  }, 30_000)

  it('keeps a low-resolution studio photo proportional while meeting detail and card minimums', () => {
    const source = createSyntheticSourcePng(480, 640)
    const adapted = upscaleImageToMinimum(source, {
      width: 2400,
      height: 1600,
    })

    expect(adapted.dimensions).toEqual({ width: 2400, height: 3200 })
    expect(adapted.dimensions.width / adapted.dimensions.height)
      .toBeCloseTo(480 / 640, 2)
    expect(adapted.filter).toContain('force_original_aspect_ratio=increase')
    expect(adapted.filter).toContain('flags=lanczos')
    expect(adapted.content.length).toBeLessThanOrEqual(
      OSS_IMAGE_PROCESSING_MAX_BYTES,
    )
  }, 30_000)

  it('uses URL-safe unpadded Base64 for OSS processing parameters', () => {
    const encoded = urlSafeBase64('test/路径/watermark logo.png')

    expect(encoded).not.toMatch(/[+/=]/u)
    expect(encoded).toBe(
      Buffer.from('test/路径/watermark logo.png')
        .toString('base64url'),
    )
  })
})

describe('T10 CORS capability check', () => {
  const browserOrigin = 'https://admin.example.test'

  it('accepts a rule covering the exact conditional PUT surface', () => {
    const result = evaluateCorsRules([
      {
        allowedOrigin: browserOrigin,
        allowedMethod: ['PUT'],
        allowedHeader: REQUIRED_PUT_HEADERS,
      },
    ], { origin: browserOrigin })

    expect(result).toMatchObject({
      sufficient: true,
      matchingRuleIndex: 0,
      broadOrigin: false,
      broadHeaders: false,
    })
  })

  it('reports a missing signed header or wrong origin', () => {
    expect(evaluateCorsRules([
      {
        allowedOrigin: 'https://other.example.test',
        allowedMethod: ['PUT'],
        allowedHeader: REQUIRED_PUT_HEADERS,
      },
    ], { origin: browserOrigin }).sufficient).toBe(false)

    expect(evaluateCorsRules([
      {
        allowedOrigin: browserOrigin,
        allowedMethod: ['PUT'],
        allowedHeader: REQUIRED_PUT_HEADERS.filter(
          header => header !== 'content-md5',
        ),
      },
    ], { origin: browserOrigin }).sufficient).toBe(false)
  })

  it('identifies broad wildcard rules without hiding capability', () => {
    expect(evaluateCorsRules([
      {
        allowedOrigin: '*',
        allowedMethod: ['PUT'],
        allowedHeader: ['*'],
      },
    ], { origin: browserOrigin })).toMatchObject({
      sufficient: true,
      broadOrigin: true,
      broadHeaders: true,
    })
  })
})
