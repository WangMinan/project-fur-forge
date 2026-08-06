import { parseArgs } from 'node:util'
import { cleanupExpiredUploads } from '../server/utils/upload-cleanup'

/**
 * T34-F5 本地入口：pnpm media:cleanup-expired-uploads
 * 默认 dry-run；真正删除需要显式 --no-dry-run。
 */
const { values } = parseArgs({
  args: process.argv.slice(2).filter(argument => argument !== '--'),
  options: {
    'dry-run': { type: 'boolean' },
    limit: { type: 'string' },
  },
})

const result = await cleanupExpiredUploads({
  dryRun: values['dry-run'] !== false,
  limit: values.limit ? Number(values.limit) : undefined,
})

console.log(JSON.stringify(result))
