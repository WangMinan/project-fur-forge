import { reconcileSiteDisplay } from '../server/utils/runner/site-display-reconcile'
import { parseSiteDisplayUpgradeArgs } from './site-display-upgrade-options'

/**
 * T34-F1 本地入口：pnpm media:reconcile-site-display
 * 默认 dry-run；真正生成需要显式 --no-dry-run。
 */
const options = parseSiteDisplayUpgradeArgs(process.argv.slice(2))

const result = await reconcileSiteDisplay(options)

console.log(JSON.stringify(result))
