import { parseArgs } from 'node:util'
import type { ReconcileScope } from '../server/utils/runner/site-display-reconcile'

export const SITE_DISPLAY_RECONCILE_SCOPES = [
  'all',
  'home-hero',
  'commission-hero',
  'home-entry',
] as const satisfies readonly ReconcileScope[]

/** Local pnpm and bundled container commands share this exact parser. */
export function parseSiteDisplayUpgradeArgs(args: readonly string[]) {
  const { values } = parseArgs({
    args: args.filter(argument => argument !== '--'),
    allowNegative: true,
    options: {
      'dry-run': { type: 'boolean' },
      scope: { type: 'string' },
    },
  })

  if (values.scope && !SITE_DISPLAY_RECONCILE_SCOPES.includes(values.scope as ReconcileScope)) {
    throw new Error(`--scope must be one of ${SITE_DISPLAY_RECONCILE_SCOPES.join(', ')}`)
  }

  return {
    dryRun: values['dry-run'] !== false,
    scope: (values.scope as ReconcileScope | undefined) ?? 'all',
  }
}
