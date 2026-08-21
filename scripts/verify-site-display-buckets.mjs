import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import OSS from 'ali-oss'
import {
  contentDigests,
  createRunId,
  createSyntheticSourcePng,
  parseImageInfo,
} from './oss-preflight-core.mjs'

/**
 * T34-F1 真实双 Bucket 定向验证。
 *
 * 目标（对应媒体公开与保护策略）：
 * 1. 站点展示变体匿名可读；
 * 2. 私有原图匿名不可读；
 * 3. MIME、尺寸、字节数和摘要正确；
 * 4. 首页/委托 Hero 无水印（处理串不含 watermark 算子）；
 * 5. 首页两个入口无水印，且 URL 与源页面公开 URL 不同；
 * 6. 作品和领养媒体继续有水印；
 * 7. 更换或重新应用水印 profile 后，站点展示 URL 与摘要不变。
 *
 * 安全边界：
 * - 只在本次运行的一次性前缀下创建对象，结束时精确删除；
 * - 输出与日志不打印 Secret、签名 URL 或完整私有 Object Key；
 * - 失败也执行清理。
 */

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadConfig() {
  const envFile = resolve(projectRoot, '.env')
  if (existsSync(envFile)) {
    loadEnvFile(envFile)
  }
  const required = [
    'OSS_REGION',
    'OSS_ENDPOINT',
    'OSS_PRIVATE_BUCKET',
    'OSS_PUBLIC_BUCKET',
    'OSS_ACCESS_KEY_ID',
    'OSS_ACCESS_KEY_SECRET',
  ]
  const missing = required.filter(name => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  return {
    region: process.env.OSS_REGION,
    endpoint: new URL(process.env.OSS_ENDPOINT).origin,
    privateBucket: process.env.OSS_PRIVATE_BUCKET,
    publicBucket: process.env.OSS_PUBLIC_BUCKET,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  }
}

function createClient(config, bucket) {
  return new OSS({
    region: config.region,
    endpoint: config.endpoint,
    bucket,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    authorizationV4: true,
    secure: true,
    timeout: 120_000,
  })
}

/**
 * 与 server/utils/site-display-recipe.ts 一致的无水印处理串：
 * 只有缩放、质量与格式，不含任何 watermark 算子。
 */
function siteDisplayProcess(width, height, format, usage) {
  const resize = `image/resize,m_fill,w_${width},h_${height},g_center`
  return format === 'png'
    ? `${resize}/format,png`
    : `${resize}/quality,q_${format === 'webp' && usage.includes('-hero-') ? 90 : format === 'webp' ? 82 : 86}/format,${format === 'jpeg' ? 'jpg' : 'webp'}`
}

/** 作品保护展示位的处理串：带居中水印，用于确认两类媒体确实不同。 */
function watermarkedProcess(width, height, logoBase64) {
  return [
    `image/resize,m_fill,w_${width},h_${height},g_center`,
    `watermark,image_${logoBase64},g_center,t_50`,
    'quality,q_82/format,webp',
  ].join('/')
}

function urlSafeBase64(value) {
  return Buffer.from(value).toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

function contentTypeFor(format) {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`
}

const checks = []

function record(name, status, detail = {}) {
  // status 放在展开之后：detail 里的同名键不得覆盖检查结论。
  checks.push({ ...detail, name, status })
  const label = status === 'passed' ? 'PASS' : 'FAIL'
  process.stdout.write(`${label} ${name}\n`)
}

async function anonymousFetch(config, bucket, objectKey) {
  const url = `https://${bucket}.${new URL(config.endpoint).host}/${objectKey}`
  const response = await fetch(url)
  return {
    contentType: response.headers.get('content-type'),
    ok: response.ok,
    status: response.status,
    content: response.ok
      ? Buffer.from(await response.arrayBuffer())
      : Buffer.alloc(0),
    // 只保留路径尾段用于人读，不输出完整私有 Key。
    label: objectKey.split('/').slice(-2).join('/'),
  }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { out: { type: 'string' } },
  })
  const config = loadConfig()
  const runId = createRunId()
  const prefix = `test/t34-f1-buckets/${runId}`
  const privateClient = createClient(config, config.privateBucket)
  const publicClient = createClient(config, config.publicBucket)
  const createdPrivate = []
  const createdPublic = []

  try {
    // 一份 Hero 横版源与一份领养设定图源，都是私有原图。
    const heroSource = createSyntheticSourcePng(4000, 2250)
    const heroKey = `${prefix}/original/hero/source.png`
    await privateClient.put(heroKey, heroSource, {
      headers: { 'Content-Type': 'image/png' },
    })
    createdPrivate.push(heroKey)

    const logoKey = `${prefix}/original/logo/logo.png`
    const logoSource = createSyntheticSourcePng(400, 400)
    await privateClient.put(logoKey, logoSource, {
      headers: { 'Content-Type': 'image/png' },
    })
    createdPrivate.push(logoKey)

    // 2. 私有原图匿名不可读。
    const privateAnonymous = await anonymousFetch(
      config,
      config.privateBucket,
      heroKey,
    )
    record(
      'private original rejects anonymous read',
      !privateAnonymous.ok && [403, 404].includes(privateAnonymous.status)
        ? 'passed'
        : 'failed',
      { anonymousStatus: privateAnonymous.status },
    )

    // 1/3/4. 站点展示变体：无水印处理串、匿名可读、元数据正确。
    const siteVariants = [
      { usage: 'home-hero-landscape', width: 1920, height: 1080, format: 'webp' },
      { usage: 'home-hero-landscape', width: 1920, height: 1080, format: 'png' },
      { usage: 'home-hero-landscape', width: 3840, height: 2160, format: 'webp' },
      { usage: 'commission-hero-landscape', width: 1280, height: 720, format: 'webp' },
      { usage: 'home-entry-commission', width: 768, height: 512, format: 'webp' },
      { usage: 'home-entry-adoption', width: 768, height: 512, format: 'webp' },
    ]
    const siteResults = []
    for (const variant of siteVariants) {
      const process_ = siteDisplayProcess(variant.width, variant.height, variant.format, variant.usage)
      if (/watermark/u.test(process_)) {
        throw new Error('Site display process must not contain a watermark operator.')
      }
      const extension = variant.format === 'jpeg' ? 'jpg' : variant.format
      const objectKey = `${prefix}/web/hero/site-display-v2/${variant.usage}/${variant.width}/object.${extension}`
      await privateClient.processObjectSave(
        heroKey,
        objectKey,
        process_,
        config.publicBucket,
      )
      createdPublic.push(objectKey)

      const head = await publicClient.head(objectKey)
      const anonymous = await anonymousFetch(config, config.publicBucket, objectKey)
      const info = parseImageInfo((await publicClient.get(
        objectKey,
        { process: 'image/info' },
      )).content)
      const digests = contentDigests(anonymous.content)
      const byteSize = Number(head.res.headers['content-length'])
      const passed = (
        anonymous.ok
        && anonymous.contentType === contentTypeFor(variant.format)
        && head.res.headers['content-type'] === contentTypeFor(variant.format)
        && byteSize === anonymous.content.length
        && info.width === variant.width
        && info.height === variant.height
        && Number(info.fileSize) === byteSize
      )
      siteResults.push({
        digestSuffix: digests.sha256.slice(-12),
        byteSize,
        objectKey,
        usage: variant.usage,
      })
      record(
        `site display variant is anonymously readable and correct (${variant.usage} ${variant.width} ${variant.format})`,
        passed ? 'passed' : 'failed',
        {
          anonymousStatus: anonymous.status,
          byteSize,
          height: info.height,
          mimeType: anonymous.contentType,
          width: info.width,
        },
      )
    }

    // 5. 首页两个入口的 URL 与 Hero 页面公开 URL 不同。
    const heroUrls = siteResults
      .filter(entry => entry.usage.endsWith('-hero-landscape'))
      .map(entry => entry.objectKey)
    const entryUrls = siteResults
      .filter(entry => entry.usage.startsWith('home-entry-'))
      .map(entry => entry.objectKey)
    record(
      'home entries use their own public objects, distinct from hero objects',
      entryUrls.length === 2
      && entryUrls.every(url => !heroUrls.includes(url))
      && new Set(entryUrls).size === 2
        ? 'passed'
        : 'failed',
      { entryCount: entryUrls.length, heroCount: heroUrls.length },
    )

    // 6. 作品/领养展示位继续有水印：处理串包含 watermark 算子且产出不同对象。
    const logoBase64 = urlSafeBase64(logoKey)
    const watermarkedKey = `${prefix}/web/hero/recipe-v2/detail/1280/object.webp`
    await privateClient.processObjectSave(
      heroKey,
      watermarkedKey,
      watermarkedProcess(1280, 720, logoBase64),
      config.publicBucket,
    )
    createdPublic.push(watermarkedKey)
    const watermarkedAnonymous = await anonymousFetch(
      config,
      config.publicBucket,
      watermarkedKey,
    )
    const unwatermarkedHero = siteResults.find(
      entry => entry.usage === 'home-hero-landscape',
    )
    const watermarkedDigest = contentDigests(watermarkedAnonymous.content)
      .sha256.slice(-12)
    record(
      'work display keeps the active watermark and differs from site display bytes',
      watermarkedAnonymous.ok
      && watermarkedDigest !== unwatermarkedHero.digestSuffix
        ? 'passed'
        : 'failed',
      { anonymousStatus: watermarkedAnonymous.status },
    )

    // 7. 更换水印 profile 后重建作品变体：站点展示对象与摘要不变。
    const rotatedLogoKey = `${prefix}/original/logo/rotated.png`
    await privateClient.put(
      rotatedLogoKey,
      createSyntheticSourcePng(320, 320),
      { headers: { 'Content-Type': 'image/png' } },
    )
    createdPrivate.push(rotatedLogoKey)
    const rebuiltKey = `${prefix}/web/hero/recipe-v2/detail/1280/rotated.webp`
    await privateClient.processObjectSave(
      heroKey,
      rebuiltKey,
      watermarkedProcess(1280, 720, urlSafeBase64(rotatedLogoKey)),
      config.publicBucket,
    )
    createdPublic.push(rebuiltKey)

    const afterRotation = []
    for (const entry of siteResults) {
      const anonymous = await anonymousFetch(
        config,
        config.publicBucket,
        entry.objectKey,
      )
      afterRotation.push({
        byteSize: anonymous.content.length,
        digestSuffix: contentDigests(anonymous.content).sha256.slice(-12),
        objectKey: entry.objectKey,
      })
    }
    const unchanged = siteResults.every((entry, index) => (
      afterRotation[index].objectKey === entry.objectKey
      && afterRotation[index].digestSuffix === entry.digestSuffix
      && afterRotation[index].byteSize === entry.byteSize
    ))
    record(
      'watermark profile rotation leaves site display urls and digests unchanged',
      unchanged ? 'passed' : 'failed',
      { comparedObjects: siteResults.length },
    )
  }
  finally {
    // 精确删除本次运行创建的对象，不使用宽泛 prefix 删除。
    for (const objectKey of createdPublic) {
      await publicClient.delete(objectKey).catch(() => {})
    }
    for (const objectKey of createdPrivate) {
      await privateClient.delete(objectKey).catch(() => {})
    }
  }

  const failed = checks.filter(check => check.status !== 'passed')
  const evidence = {
    checks,
    // 不写入 Bucket 名称之外的任何凭据信息，也不写完整私有 Key。
    privateBucket: config.privateBucket,
    publicBucket: config.publicBucket,
    result: failed.length === 0 ? 'passed' : 'failed',
    runId,
  }
  if (values.out) {
    await mkdir(dirname(resolve(projectRoot, values.out)), { recursive: true })
    await writeFile(
      resolve(projectRoot, values.out),
      `${JSON.stringify(evidence, null, 2)}\n`,
    )
  }
  process.stdout.write(`${JSON.stringify({
    result: evidence.result,
    passed: checks.length - failed.length,
    failed: failed.length,
    runId,
  })}\n`)
  if (failed.length > 0) {
    process.exit(1)
  }
}

await main()
