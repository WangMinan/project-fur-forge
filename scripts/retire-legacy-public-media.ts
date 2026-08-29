import { parseArgs } from 'node:util'
import { getDatabase } from '../server/utils/database'
import { getMediaStorage } from '../server/utils/media-storage'
import { getPublicMediaCache } from '../server/utils/public-media-cache'
import { retireLegacyPublicMedia } from '../server/utils/runner/legacy-public-media-retirement'

const { values } = parseArgs({
  options: {
    confirm: { type: 'string' },
    execute: { type: 'boolean', default: false },
  },
})

console.log(JSON.stringify(await retireLegacyPublicMedia({
  cache: getPublicMediaCache(),
  confirmation: values.confirm,
  execute: values.execute,
  sqlite: getDatabase().sqlite,
  storage: getMediaStorage(),
}), null, 2))
