import { spawn } from 'node:child_process'
import type Database from 'better-sqlite3'
import ffmpegPath from 'ffmpeg-static'
import jsQR from 'jsqr'
import { getMediaStorage } from '../media-storage'
import { safeLog } from '../safe-log'

const DECODE_SIZE = 512
const QQ_SHORT_LINK_PATH = /^\/q\/[A-Za-z0-9]{4,64}$/u

export function normalizeContactQrLink(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value.trim())
    if (
      url.protocol !== 'https:'
      || url.hostname !== 'qm.qq.com'
      || url.port
      || url.username
      || url.password
      || url.search
      || url.hash
      || !QQ_SHORT_LINK_PATH.test(url.pathname)
    ) {
      return null
    }
    return `https://qm.qq.com${url.pathname}`
  }
  catch {
    return null
  }
}

function toRgba(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg-static is unavailable'))
      return
    }
    const process = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-vf', `scale=${DECODE_SIZE}:${DECODE_SIZE}:flags=neighbor`,
      '-frames:v', '1',
      '-pix_fmt', 'rgba',
      '-f', 'rawvideo', 'pipe:1',
    ])
    const chunks: Buffer[] = []
    process.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    process.stderr.resume()
    process.on('error', reject)
    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with ${code}`))
        return
      }
      resolve(Buffer.concat(chunks))
    })
    process.stdin.on('error', reject)
    process.stdin.end(input)
  })
}

export async function decodeContactQrLink(image: Buffer): Promise<string | null> {
  try {
    const rgba = await toRgba(image)
    const decoded = jsQR(
      new Uint8ClampedArray(rgba),
      DECODE_SIZE,
      DECODE_SIZE,
      { inversionAttempts: 'attemptBoth' },
    )
    const link = normalizeContactQrLink(decoded?.data)
    if (!link) {
      safeLog('warn', 'Contact QR link was rejected.', {
        decoded: Boolean(decoded?.data),
      })
    }
    return link
  }
  catch (error) {
    safeLog('warn', 'Contact QR decode failed.', {
      errorName: (error as { name?: unknown }).name,
    })
    return null
  }
}

interface ResolveContactQrLinkDependencies {
  decode?: (image: Buffer) => Promise<string | null>
  readPrivate?: (objectKey: string) => Promise<Buffer>
}

export async function resolveContactQrLink(
  sqlite: Database.Database,
  channel: { qrCodeAssetId: string | null },
  previous: { qrCodeAssetId: string | null, qrLinkUrl: string | null } | undefined,
  dependencies: ResolveContactQrLinkDependencies = {},
): Promise<string | null> {
  if (!channel.qrCodeAssetId) return null

  // 资产没有变化时复用完整旧结果，包括 null；否则一次解码失败会在每次保存时重跑。
  if (previous?.qrCodeAssetId === channel.qrCodeAssetId) {
    return previous.qrLinkUrl
  }

  const asset = sqlite.prepare(`
    SELECT private_object_key AS privateObjectKey
    FROM assets
    WHERE id = ? AND role = 'contact_qr' AND status = 'READY'
  `).get(channel.qrCodeAssetId) as { privateObjectKey: string } | undefined
  if (!asset) return null

  try {
    const readPrivate = dependencies.readPrivate
      ?? ((objectKey: string) => getMediaStorage().getPrivate(objectKey))
    const decode = dependencies.decode ?? decodeContactQrLink
    const bytes = await readPrivate(asset.privateObjectKey)
    return normalizeContactQrLink(await decode(bytes))
  }
  catch (error) {
    safeLog('warn', 'Contact QR source read failed.', {
      errorName: (error as { name?: unknown }).name,
    })
    return null
  }
}
