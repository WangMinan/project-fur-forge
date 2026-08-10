import { parseArgs } from 'node:util'
import { reconcileSiteDisplay } from '../server/utils/runner/site-display-reconcile'
import type { ReconcileScope } from '../server/utils/runner/site-display-reconcile'

/**
 * T34-F1 本地入口：pnpm media:reconcile-site-display
 * 默认 dry-run；真正生成需要显式 --no-dry-run。
 */
const SCOPES: ReconcileScope[] = ['all', 'home-hero', 'commission-hero', 'home-entry']

const { values } = parseArgs({
  args: process.argv.slice(2).filter(argument => argument !== '--'),
  allowNegative: true,
  options: {
    'dry-run': { type: 'boolean' },
    scope: { type: 'string' },
  },
})

if (values.scope && !SCOPES.includes(values.scope as ReconcileScope)) {
  throw new Error(`--scope must be one of ${SCOPES.join(', ')}`)
}

const result = await reconcileSiteDisplay({
  dryRun: values['dry-run'] !== false,
  scope: (values.scope as ReconcileScope | undefined) ?? 'all',
})

console.log(JSON.stringify(result))
