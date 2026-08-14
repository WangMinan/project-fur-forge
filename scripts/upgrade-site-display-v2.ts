import { reconcileSiteDisplay } from '../server/utils/runner/site-display-reconcile'
import { parseSiteDisplayUpgradeArgs } from './site-display-upgrade-options'

/**
 * Explicit v1 -> v2 operator entry. It is rerunnable and defaults to dry-run;
 * old immutable v1 objects remain available while each complete v2 set is built.
 */
const result = await reconcileSiteDisplay(
  parseSiteDisplayUpgradeArgs(process.argv.slice(2)),
)

console.log(JSON.stringify(result))
