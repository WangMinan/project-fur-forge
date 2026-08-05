import { parseArgs } from 'node:util'
import { getDatabase } from '../server/utils/database'
import { getMediaStorage } from '../server/utils/media-storage'
import { cleanupExpiredUploadSessions } from '../server/utils/upload-session'

const { values } = parseArgs({
  args: process.argv.slice(2).filter(argument => argument !== '--'),
  options: {
    dryRun: { type: 'boolean', default: false },
    limit: { type: 'string' },
  },
})
const result = await cleanupExpiredUploadSessions(
  getDatabase().sqlite,
  getMediaStorage(),
  {
    dryRun: values.dryRun,
    limit: values.limit ? Number(values.limit) : undefined,
  },
)
console.log(JSON.stringify(result))
