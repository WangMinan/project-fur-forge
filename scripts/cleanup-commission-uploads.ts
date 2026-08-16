import { parseArgs } from 'node:util'
import { getDatabase } from '../server/utils/database'
import { getMediaStorage } from '../server/utils/media-storage'
import { cleanupExpiredCommissionUploads } from '../server/utils/service/commission-management'

/**
 * Anonymous commission cleanup is dry-run by default. Destructive execution
 * requires the explicit --no-dry-run flag and always deletes exact keys.
 */
const { values } = parseArgs({
  args: process.argv.slice(2).filter(argument => argument !== '--'),
  allowNegative: true,
  options: {
    'dry-run': { type: 'boolean' },
    limit: { type: 'string' },
  },
})

const result = await cleanupExpiredCommissionUploads({
  dryRun: values['dry-run'] !== false,
  limit: values.limit ? Number(values.limit) : undefined,
  sqlite: getDatabase().sqlite,
  storage: getMediaStorage(),
})

console.log(JSON.stringify(result))
