import {
  defineEventHandler,
  readBody,
  setResponseStatus,
} from 'h3'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDatabase } from '../../../server/utils/database'
import { getE2eFakeMediaStorage } from './e2e-fake-media'

interface ControlBody {
  action?: string
  flags?: Record<string, boolean>
  imageInfoOverride?: {
    key: string
    info: {
      fileSize: number
      format: string
      height: number
      orientation: number
      width: number
    }
  } | null
}

const FLAG_KEYS = [
  'failDelete',
  'failGet',
  'failImageInfo',
  'failPut',
  'failProcess',
  'failSign',
  'omitSha256OnNextPut',
  'rejectNextPut403',
] as const

function restoreBundledWatermarkCandidate(
  fake: ReturnType<typeof getE2eFakeMediaStorage>,
) {
  const content = readFileSync(resolve('public/brand/logo-full-light.png'))
  const sha256 = createHash('sha256').update(content).digest('hex')
  const keys = getDatabase().sqlite.prepare(`
    SELECT private_object_key FROM assets
    WHERE role = 'watermark_logo' AND status = 'READY' AND sha256 = ?
  `).pluck().all(sha256) as string[]
  keys.forEach(key => fake.seedPrivate(key, content, 'image/png', sha256))
}

// E2E 控制面：查询内存 fake 状态、注入故障。只在 test 构建注册。
export default defineEventHandler(async (event) => {
  const body = await readBody<ControlBody>(event)
  const fake = getE2eFakeMediaStorage()

  if (body?.action === 'state') {
    return {
      data: {
        deletedPrivateKeys: [...fake.deletedPrivateKeys],
        deletedPublicKeys: [...fake.deletedPublicKeys],
        objects: [...fake.objects.keys()],
        processCalls: fake.processCalls.length,
        publicObjects: [...fake.publicObjects.keys()],
        putRecords: fake.putRecords.map(record => ({
          byteSize: record.byteSize,
          contentMd5: record.contentMd5,
          contentType: record.contentType,
          forbidOverwrite: record.forbidOverwrite,
          sha256Metadata: record.sha256Metadata,
        })),
      },
    }
  }

  if (body?.action === 'setFlags') {
    for (const key of FLAG_KEYS) {
      const value = body.flags?.[key]
      if (typeof value === 'boolean') {
        fake[key] = value
      }
    }
    if (body.imageInfoOverride) {
      fake.imageInfoOverrides.set(
        body.imageInfoOverride.key,
        body.imageInfoOverride.info,
      )
    }
    else if (body.imageInfoOverride === null) {
      fake.imageInfoOverrides.clear()
    }
    return { data: { ok: true } }
  }

  if (body?.action === 'reset') {
    fake.resetKnobs()
    restoreBundledWatermarkCandidate(fake)
    return { data: { ok: true } }
  }

  setResponseStatus(event, 400)
  return { error: 'unknown action' }
})
