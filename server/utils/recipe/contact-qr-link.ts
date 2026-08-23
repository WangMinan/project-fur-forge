import { spawn } from 'node:child_process'
import type Database from 'better-sqlite3'
import ffmpegPath from 'ffmpeg-static'
import jsQR from 'jsqr'
import { getMediaStorage } from '../media-storage'
import { safeLog } from '../safe-log'

/**
 * 官方渠道二维码 → 其中编码的跳转链接。
 *
 * 为什么必须真的解码：QQ 的加好友/加群短链（`https://qm.qq.com/q/<token>`）里的
 * token 不可从账号推导，只能从二维码图像本身读出。因此不能用 URL 模板拼装，
 * 也不需要调用第三方查询接口。
 *
 * 解码在管理端保存二维码时执行一次，结果随渠道一起入库，公开投影只读结果：
 * 这样既让链接跟着上传的二维码自动同步，又不给每次公开请求增加解码开销。
 */

/** 只接受官方 QQ 短链，避免把任意二维码内容当成站外跳转目标。 */
const ALLOWED_QR_URL = /^https:\/\/qm\.qq\.com\/q\/[A-Za-z0-9]{4,32}$/u

/** 二维码是方形；放大到固定边长保证采样密度足够。 */
const DECODE_SIZE = 512

/** PNG/JPEG → 裸 RGBA。jsQR 需要像素，复用已有的 ffmpeg-static，不新增图像库。 */
function toRgba(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as unknown as string, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-vf', `scale=${DECODE_SIZE}:${DECODE_SIZE}:flags=neighbor`,
      '-frames:v', '1',
      '-pix_fmt', 'rgba',
      '-f', 'rawvideo', 'pipe:1',
    ])
    const chunks: Buffer[] = []
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    proc.stderr.resume()
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with ${code}`))
        return
      }
      resolve(Buffer.concat(chunks))
    })
    proc.stdin.on('error', reject)
    proc.stdin.end(input)
  })
}

/**
 * 解出二维码里的官方跳转链接。
 * 解码失败、内容不是官方 QQ 短链时返回 null，由调用方回退为不可点击卡片，
 * 绝不把无法验证的内容写成站外跳转。
 */
export async function decodeContactQrLink(
  image: Buffer,
): Promise<string | null> {
  try {
    const rgba = await toRgba(image)
    const decoded = jsQR(
      new Uint8ClampedArray(rgba),
      DECODE_SIZE,
      DECODE_SIZE,
    )
    const value = decoded?.data?.trim()
    if (!value || !ALLOWED_QR_URL.test(value)) {
      safeLog('warn', 'Contact QR link was rejected.', {
        decoded: Boolean(value),
      })
      return null
    }
    return value
  }
  catch (error) {
    safeLog('warn', 'Contact QR decode failed.', {
      errorName: (error as { name?: unknown }).name,
    })
    return null
  }
}

/**
 * 解析一个渠道要写入的 `qrLinkUrl`。
 *
 * 二维码没换时直接沿用已存链接，不重复解码 —— contact 分区保存也可能只是改邮箱。
 * 解码失败返回 null，卡片回退为不可点击，不阻塞保存。
 */
export async function resolveContactQrLink(
  sqlite: Database.Database,
  channel: { qrCodeAssetId: string | null },
  previous: { qrCodeAssetId: string | null, qrLinkUrl: string | null } | undefined,
): Promise<string | null> {
  if (!channel.qrCodeAssetId) {
    return null
  }
  if (
    previous?.qrCodeAssetId === channel.qrCodeAssetId
    && previous.qrLinkUrl
  ) {
    return previous.qrLinkUrl
  }

  const asset = sqlite.prepare(`
    SELECT private_object_key AS privateObjectKey
    FROM assets
    WHERE id = ? AND role = 'contact_qr' AND status = 'READY'
  `).get(channel.qrCodeAssetId) as { privateObjectKey: string } | undefined
  if (!asset) {
    return null
  }

  try {
    const bytes = await getMediaStorage().getPrivate(asset.privateObjectKey)
    return await decodeContactQrLink(bytes)
  }
  catch (error) {
    safeLog('warn', 'Contact QR source read failed.', {
      errorName: (error as { name?: unknown }).name,
    })
    return null
  }
}
