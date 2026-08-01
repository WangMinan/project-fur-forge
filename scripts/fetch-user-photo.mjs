// Fetch the user's actual studio photo originals from the real private OSS bucket
// so we can probe the browser preview with the exact bytes that fail for them.
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { AliOssMediaStorage } from '../server/utils/media-storage.ts'
import { getRuntimeConfig } from '../server/utils/runtime-config.ts'

const storage = new AliOssMediaStorage(getRuntimeConfig())
const keys = [
  ['dev/original/5358a434-00cf-4f5d-9517-b96403c41501/5a40eabf7a3007d87cec09013d5a889456846ec1009f2b9b.png', 'user-photo-large.png'],
  ['dev/original/21c86fb0-4180-40d7-8c0f-b726d2c2ec2b/d86e9f14132360ac61877374130a4d1ef2056bdf538f69db.jpg', 'user-photo-small.jpg'],
]
for (const [key, name] of keys) {
  const content = await storage.getPrivate(key)
  const out = resolve(tmpdir(), name)
  writeFileSync(out, content)
  console.log('saved', out, content.length, 'bytes')
}
