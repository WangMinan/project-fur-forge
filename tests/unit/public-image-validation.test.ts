import { createHash } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { verifyPublicImage } from '../../server/utils/service/public-image-validation'
import type { MediaStorage } from '../../server/utils/media-storage'

it('checks anonymous bytes against storage metadata, digest, format and expected dimensions', async () => {
  const content = Buffer.from('synthetic-image')
  const head = { byteSize: content.length, contentType: 'image/png', etagMd5Hex: createHash('md5').update(content).digest('hex') }
  const info = { fileSize: content.length, format: 'png', width: 64, height: 64 }
  const anonymous = { content, contentType: 'image/png' }
  const storage = {
    headPublic: vi.fn(async () => head), imageInfoPublic: vi.fn(async () => info),
    getPublicAnonymous: vi.fn(async () => anonymous),
  } as unknown as MediaStorage
  const variant = { objectKey: 'test/web/image.png', byteSize: content.length,
    sha256: createHash('sha256').update(content).digest('hex'), width: 64, height: 64, format: 'png' as const }
  await expect(verifyPublicImage(storage, variant)).resolves.toBe(true)
  for (const changed of [{ byteSize: 1 }, { sha256: 'a'.repeat(64) }, { width: 65 }, { height: 65 }, { format: 'jpeg' as const }]) {
    await expect(verifyPublicImage(storage, { ...variant, ...changed })).resolves.toBe(false)
  }
  anonymous.content = Buffer.from('different-bytes')
  await expect(verifyPublicImage(storage, variant)).resolves.toBe(false)
  anonymous.content = content
  head.etagMd5Hex = 'incorrect'
  await expect(verifyPublicImage(storage, variant)).resolves.toBe(false)
})
