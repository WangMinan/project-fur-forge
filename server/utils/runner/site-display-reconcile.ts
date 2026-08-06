import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { getDatabase } from '../database'
import { getMediaStorage } from '../media-storage'
import type { MediaStorage } from '../media-storage'
import {
  assertOperationLease,
  claimOperationLease,
  heartbeatOperationLease,
  holdsOperationLease,
  releaseOperationLease,
} from '../repository/operation-lease'
import { registerOperationResumer } from './operation-recovery'
import { safeLog } from '../safe-log'
import {
  assetSupportsSiteDisplay,
  generateSiteDisplayVariants,
  HOME_ENTRY_USAGES,
  missingSiteDisplayVariantCount,
  SITE_HERO_USAGES,
} from '../recipe/site-display-recipe'
import type { SiteDisplayUsage } from '../recipe/site-display-recipe'
import { adoptionEntrySource } from '../service/site-entry'

/**
 * T34-F1 既有站点展示素材 reconcile。
 *
 * 迁移 0017 只改变数据库身份，不会为既有对象生成文件；已启用 Hero 与既有
 * 已发布领养因此可能仍在依赖旧水印回退。本命令补齐缺失的无水印
 * `site-display-v1` 变体，**不要求管理员手动禁用再启用**。
 *
 * 安全边界：
 * - 只生成站点展示位变体，不生成水印，不触碰作品/领养的水印变体；
 * - 不暴露私有原图，不原位覆盖公开对象：对象 Key 含配方身份哈希，
 *   内容变化必然产生新 Key；
 * - 逐个目标"完整生成 + 校验"后才计入成功，公开投影本身按
 *   completeSiteDisplayVariants 判定，缺失即受控隐藏，因此失败时
 *   旧 Hero fallback 与旧有效页面继续可用；
 * - 单个目标失败只累计 failed 并继续，可重试；
 * - dry-run 只输出脱敏数量摘要；
 * - 重复运行不创建重复行（唯一活跃索引）也不创建重复对象（Key 幂等）。
 */

export type ReconcileScope = 'all' | 'home-hero' | 'commission-hero' | 'home-entry'

export interface ReconcileTarget {
  assetId: string
  kind: 'home-hero' | 'commission-hero' | 'home-entry'
  label: string
  usages: SiteDisplayUsage[]
}

export interface ReconcileResult {
  dryRun: boolean
  failed: number
  generated: number
  operationId: string | null
  scanned: number
  skipped: number
  status: string
}

const RECONCILE_TABLE = 'site_display_reconcile_operations' as const

interface ReconcileRow {
  attempt: number
  failedCount: number
  generatedCount: number
  id: string
  scannedCount: number
  scope: ReconcileScope
  skippedCount: number
  status: string
  version: number
}

const selectOperation = `
  SELECT
    id, scope, status, version, attempt,
    scanned_count AS scannedCount,
    generated_count AS generatedCount,
    skipped_count AS skippedCount,
    failed_count AS failedCount
  FROM ${RECONCILE_TABLE}
`

function findOperation(sqlite: Database.Database, id: string) {
  return sqlite.prepare(`${selectOperation} WHERE id = ?`)
    .get(id) as ReconcileRow | undefined
}

function inScope(scope: ReconcileScope, kind: ReconcileTarget['kind']) {
  return scope === 'all' || scope === kind
}

/**
 * 扫描目标：当前启用的首页 Hero 横竖、当前启用的委托 Hero 横竖、
 * 首页委托入口源、当前符合条件的已发布常规领养入口源。
 */
export function findReconcileTargets(
  sqlite: Database.Database,
  scope: ReconcileScope = 'all',
): ReconcileTarget[] {
  const targets: ReconcileTarget[] = []
  const slides = sqlite.prepare(`
    SELECT
      slide.id, slide.placement,
      slide.landscape_asset_id AS landscapeAssetId,
      slide.portrait_asset_id AS portraitAssetId
    FROM site_hero_slides AS slide
    JOIN assets AS landscape ON landscape.id = slide.landscape_asset_id
    JOIN assets AS portrait ON portrait.id = slide.portrait_asset_id
    WHERE slide.enabled = 1
      AND landscape.status = 'READY' AND portrait.status = 'READY'
    ORDER BY slide.placement, slide.sort_order, slide.id
  `).all() as Array<{
    id: string
    landscapeAssetId: string
    placement: 'home' | 'commission'
    portraitAssetId: string
  }>

  for (const slide of slides) {
    const kind = slide.placement === 'home' ? 'home-hero' : 'commission-hero'
    if (!inScope(scope, kind)) {
      continue
    }
    const usages = SITE_HERO_USAGES[slide.placement]
    targets.push({
      assetId: slide.landscapeAssetId,
      kind,
      label: `${slide.placement}-hero-landscape`,
      usages: [usages.landscape],
    })
    targets.push({
      assetId: slide.portraitAssetId,
      kind,
      label: `${slide.placement}-hero-portrait`,
      usages: [usages.portrait],
    })
    if (slide.placement === 'commission' && inScope(scope, 'home-entry')) {
      // 首页委托入口借用委托 Hero 横版源，但使用独立入口变体与独立公开 URL。
      targets.push({
        assetId: slide.landscapeAssetId,
        kind: 'home-entry',
        label: 'home-entry-commission',
        usages: [HOME_ENTRY_USAGES.commission],
      })
    }
  }

  if (inScope(scope, 'home-entry')) {
    // 至少保证当前入口源可生成 home-entry-adoption；
    // 其余已发布常规领养设定图一并补齐，避免入口源轮换后再次缺图。
    const current = adoptionEntrySource(sqlite)
    const adoptionAssets = sqlite.prepare(`
      SELECT DISTINCT relation.asset_id AS assetId
      FROM works AS work
      JOIN work_assets AS relation ON relation.work_id = work.id
      JOIN assets AS asset ON asset.id = relation.asset_id
      WHERE work.publication_status = 'published'
        AND work.purpose = 'adoption' AND work.adoption_method = 'regular'
        AND relation.role = 'design_sheet' AND asset.status = 'READY'
        AND asset.role = 'design_sheet'
      ORDER BY work.sort_order, work.id
    `).pluck().all() as string[]
    const ordered = current
      ? [current.assetId, ...adoptionAssets.filter(id => id !== current.assetId)]
      : adoptionAssets
    for (const assetId of ordered) {
      targets.push({
        assetId,
        kind: 'home-entry',
        label: 'home-entry-adoption',
        usages: [HOME_ENTRY_USAGES.adoption],
      })
    }
  }

  return targets
}

function variantsForAsset(sqlite: Database.Database, assetId: string) {
  return sqlite.prepare(`
    SELECT
      storage_scope AS storageScope, status, usage, width, height, format,
      recipe_version AS recipeVersion, protection_mode AS protectionMode,
      sha256, byte_size AS byteSize
    FROM asset_variants WHERE asset_id = ?
  `).all(assetId) as Array<{
    byteSize: number | null
    format: 'webp' | 'jpeg' | 'png'
    height: number
    protectionMode: string
    recipeVersion: string
    sha256: string | null
    status: string
    storageScope: string
    usage: string
    width: number
  }>
}

/** 目标是否已经完整；完整目标不重复生成，因此重复运行是幂等的。 */
export function reconcileTargetComplete(
  sqlite: Database.Database,
  target: ReconcileTarget,
) {
  const variants = variantsForAsset(sqlite, target.assetId)
  return target.usages.every(
    usage => missingSiteDisplayVariantCount(usage, variants) === 0,
  )
}

function createReconcileOperation(
  sqlite: Database.Database,
  scope: ReconcileScope,
  scanned: number,
  now: number,
) {
  const id = randomUUID()
  sqlite.prepare(`
    INSERT INTO ${RECONCILE_TABLE} (
      id, scope, status, scanned_count, started_at, updated_at
    ) VALUES (?, ?, 'SCANNING', ?, ?, ?)
  `).run(id, scope, scanned, now, now)
  return findOperation(sqlite, id)!
}

function setReconcileStatus(
  sqlite: Database.Database,
  operationId: string,
  status: string,
  counts: { failed?: number, generated?: number, skipped?: number },
  now: number,
) {
  sqlite.prepare(`
    UPDATE ${RECONCILE_TABLE}
    SET status = ?,
        generated_count = COALESCE(?, generated_count),
        skipped_count = COALESCE(?, skipped_count),
        failed_count = COALESCE(?, failed_count),
        internal_error_code = NULL, failure_stage = NULL,
        version = version + 1, updated_at = ?
    WHERE id = ?
  `).run(
    status,
    counts.generated ?? null,
    counts.skipped ?? null,
    counts.failed ?? null,
    now,
    operationId,
  )
}

/**
 * 执行 reconcile 的核心循环。既被 CLI 调用，也被启动恢复复用。
 * 每个目标之前更新心跳；失去 lease 立即停止，避免两个进程并行生成。
 */
async function runReconcile(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  now: number,
): Promise<ReconcileResult> {
  const operation = findOperation(sqlite, operationId)
  if (!operation) {
    throw new Error('Site display reconcile operation was not found.')
  }
  const lease = claimOperationLease(sqlite, RECONCILE_TABLE, operationId, now)
  if (!lease) {
    return summarize(sqlite, operationId, false)
  }

  const targets = findReconcileTargets(sqlite, operation.scope)
  let generated = 0
  let skipped = 0
  let failed = 0
  try {
    sqlite.prepare(`
      UPDATE ${RECONCILE_TABLE}
      SET scanned_count = ?, version = version + 1, updated_at = ?
      WHERE id = ?
    `).run(targets.length, now, operationId)
    setReconcileStatus(
      sqlite,
      operationId,
      'GENERATING_PUBLIC',
      { generated: 0, skipped: 0, failed: 0 },
      now,
    )

    for (const target of targets) {
      if (!heartbeatOperationLease(sqlite, lease)) {
        throw new Error('Site display reconcile lease was lost.')
      }
      if (reconcileTargetComplete(sqlite, target)) {
        skipped += 1
        continue
      }
      if (!assetSupportsSiteDisplay(sqlite, target.assetId, target.usages)) {
        // 源太小：站点展示位受控隐藏，不放大也不改用水印图。
        failed += 1
        safeLog('warn', 'Reconcile target source is too small for site display.', {
          assetId: target.assetId,
          usage: target.label,
        })
        continue
      }
      try {
        await generateSiteDisplayVariants(
          sqlite,
          storage,
          target.assetId,
          target.usages,
          now,
        )
        // 只有完整生成并通过校验才计入成功；投影按完整性判定。
        if (reconcileTargetComplete(sqlite, target)) {
          generated += 1
        }
        else {
          failed += 1
        }
      }
      catch (error) {
        failed += 1
        safeLog('error', 'Reconcile target generation failed.', {
          assetId: target.assetId,
          errorCode: (error as { code?: unknown }).code,
          usage: target.label,
        })
      }
      setReconcileStatus(
        sqlite,
        operationId,
        'GENERATING_PUBLIC',
        { generated, skipped, failed },
        Date.now(),
      )
    }

    if (!heartbeatOperationLease(sqlite, lease)) {
      throw new Error('Site display reconcile lease was lost.')
    }
    setReconcileStatus(
      sqlite,
      operationId,
      'VERIFYING_PUBLIC',
      { generated, skipped, failed },
      Date.now(),
    )
    sqlite.transaction(() => {
      assertOperationLease(sqlite, lease)
      const committed = sqlite.prepare(`
        UPDATE ${RECONCILE_TABLE}
        SET status = ?, generated_count = ?, skipped_count = ?,
            failed_count = ?, internal_error_code = ?, failure_stage = ?,
            lease_owner = NULL, lease_expires_at = NULL,
            version = version + 1, updated_at = ?, completed_at = ?
        WHERE id = ? AND lease_owner = ? AND attempt = ?
      `).run(
        failed > 0 ? 'FAILED' : 'DONE',
        generated,
        skipped,
        failed,
        failed > 0 ? 'SITE_DISPLAY_RECONCILE_INCOMPLETE' : null,
        failed > 0 ? 'GENERATING_PUBLIC' : null,
        Date.now(),
        Date.now(),
        operationId,
        lease.owner,
        lease.attempt,
      )
      if (committed.changes !== 1) {
        throw new Error('Site display reconcile commit lost its lease.')
      }
    })()
  }
  catch (error) {
    if (holdsOperationLease(sqlite, lease)) {
      sqlite.prepare(`
        UPDATE ${RECONCILE_TABLE}
        SET status = 'FAILED',
            internal_error_code = 'SITE_DISPLAY_RECONCILE_FAILED',
            failure_stage = 'GENERATING_PUBLIC',
            generated_count = ?, skipped_count = ?, failed_count = ?,
            version = version + 1, updated_at = ?, completed_at = ?
        WHERE id = ? AND status NOT IN ('FAILED', 'DONE')
      `).run(
        generated,
        skipped,
        Math.max(failed, 1),
        Date.now(),
        Date.now(),
        operationId,
      )
      releaseOperationLease(sqlite, lease, Date.now())
    }
    safeLog('error', 'Site display reconcile failed.', {
      errorName: (error as { name?: unknown }).name,
      operationId,
    })
  }
  return summarize(sqlite, operationId, false)
}

function summarize(
  sqlite: Database.Database,
  operationId: string,
  dryRun: boolean,
): ReconcileResult {
  const row = findOperation(sqlite, operationId)!
  return {
    dryRun,
    failed: row.failedCount,
    generated: row.generatedCount,
    operationId: row.id,
    scanned: row.scannedCount,
    skipped: row.skippedCount,
    status: row.status,
  }
}

function activeOperation(sqlite: Database.Database, scope: ReconcileScope) {
  return sqlite.prepare(`
    ${selectOperation}
    WHERE scope = ? AND status NOT IN ('FAILED', 'DONE')
    ORDER BY started_at DESC LIMIT 1
  `).get(scope) as ReconcileRow | undefined
}

/**
 * 运维入口：`pnpm media:reconcile-site-display` 与容器 ops 子命令共用。
 * 默认 dry-run，只输出脱敏数量摘要，不创建 operation 也不生成对象。
 */
export async function reconcileSiteDisplay(options: {
  dryRun?: boolean
  now?: number
  scope?: ReconcileScope
  sqlite?: Database.Database
  storage?: MediaStorage
} = {}): Promise<ReconcileResult> {
  const sqlite = options.sqlite ?? getDatabase().sqlite
  const now = options.now ?? Date.now()
  const scope = options.scope ?? 'all'
  const dryRun = options.dryRun !== false

  if (dryRun) {
    const targets = findReconcileTargets(sqlite, scope)
    const complete = targets.filter(
      target => reconcileTargetComplete(sqlite, target),
    ).length
    return {
      dryRun: true,
      failed: 0,
      generated: 0,
      operationId: null,
      scanned: targets.length,
      skipped: complete,
      status: 'SCANNING',
    }
  }

  // 已有未完成 operation 时接着推进它，而不是并行创建第二条。
  const existing = activeOperation(sqlite, scope)
  const operation = existing
    ?? createReconcileOperation(
      sqlite,
      scope,
      findReconcileTargets(sqlite, scope).length,
      now,
    )
  const storage = options.storage ?? getMediaStorage()
  return runReconcile(sqlite, storage, operation.id, now)
}

export function getSiteDisplayReconcileOperation(
  sqlite: Database.Database,
  operationId: string,
) {
  const row = findOperation(sqlite, operationId)
  return row ? summarize(sqlite, operationId, false) : null
}

registerOperationResumer({
  table: RECONCILE_TABLE,
  matches: (sqlite, operationId) => Boolean(findOperation(sqlite, operationId)),
  failure: () => ({
    stage: 'GENERATING_PUBLIC',
    code: 'SITE_DISPLAY_RECONCILE_INTERRUPTED',
  }),
  resume: async (sqlite, storage, operationId, now) => {
    const result = await runReconcile(sqlite, storage, operationId, now)
    if (result.status !== 'DONE' && result.status !== 'FAILED') {
      throw new Error('Site display reconcile did not reach a terminal state.')
    }
  },
})
