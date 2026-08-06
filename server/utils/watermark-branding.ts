import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  watermarkBrandingDtoSchema,
  watermarkOperationDtoSchema,
} from '../../shared/schemas/watermark'
import type {
  WatermarkBrandingDto,
  WatermarkOperationDto,
  WatermarkOperationStatus,
  WatermarkPreviewKind,
} from '../../shared/types/contracts'
import type { MediaStorage } from './media-storage'
import {
  generatePrivateWatermarkPreview,
  generatePublicVariantsForProfile,
  publicVariantCountForUsages,
  workAssetPublicUsages,
} from './media-recipe'
import type { PublicMediaUsage } from './media-recipe'
import {
  assertOperationLease,
  claimOperationLease,
  heartbeatOperationLease,
  holdsOperationLease,
  releaseOperationLease,
} from './operation-lease'
import type { OperationLease } from './operation-lease'
import { registerOperationResumer } from './operation-recovery'
import { ServiceError } from './service-error'
import { SITE_DISPLAY_RECIPE_VERSION } from './site-display-recipe'
import {
  findWatermarkProfile,
  requireSiteBranding,
  requireWatermarkProfile,
  watermarkProfileDto,
  watermarkSource,
} from './watermark-profile'

interface PreviewManifestEntry {
  format: 'webp'
  height: number
  kind: WatermarkPreviewKind
  objectKey: string
  width: number
}

interface CleanupManifestEntry {
  objectKey: string
  scope: 'PRIVATE' | 'PUBLIC'
}

interface WatermarkOperationRow {
  affectedHeroSlideCount: number
  affectedWorkCount: number
  brandingVersion: number
  cleanupObjectKeysJson: string
  completedAt: number | null
  failureStage: string | null
  generatedVariantCount: number
  id: string
  internalErrorCode: string | null
  operationType: 'WATERMARK_PREVIEW' | 'WATERMARK_REBUILD'
  previewManifestJson: string
  profileId: string
  startedAt: number
  status: WatermarkOperationStatus
  targetVariantCount: number
  updatedAt: number
  verifiedVariantCount: number
  version: number
}

interface WatermarkTarget {
  assetId: string
  usages: PublicMediaUsage[]
}

const selectOperation = `
  SELECT
    id, operation_type AS operationType, profile_id AS profileId,
    branding_version AS brandingVersion, status,
    affected_work_count AS affectedWorkCount,
    affected_hero_slide_count AS affectedHeroSlideCount,
    target_variant_count AS targetVariantCount,
    generated_variant_count AS generatedVariantCount,
    verified_variant_count AS verifiedVariantCount,
    preview_manifest_json AS previewManifestJson,
    cleanup_object_keys_json AS cleanupObjectKeysJson,
    internal_error_code AS internalErrorCode,
    failure_stage AS failureStage, version,
    started_at AS startedAt, updated_at AS updatedAt,
    completed_at AS completedAt
  FROM watermark_operations
`

function parseJsonArray<T>(value: string, validate: (item: unknown) => boolean) {
  const parsed = JSON.parse(value) as unknown
  if (!Array.isArray(parsed) || parsed.some(item => !validate(item))) {
    throw new Error('Watermark operation manifest is invalid.')
  }
  return parsed as T[]
}

function previews(row: WatermarkOperationRow) {
  return parseJsonArray<PreviewManifestEntry>(
    row.previewManifestJson,
    item => typeof item === 'object' && item !== null
      && typeof (item as PreviewManifestEntry).objectKey === 'string'
      && typeof (item as PreviewManifestEntry).kind === 'string'
      && typeof (item as PreviewManifestEntry).width === 'number'
      && typeof (item as PreviewManifestEntry).height === 'number'
      && (item as PreviewManifestEntry).format === 'webp',
  )
}

function cleanupEntries(row: WatermarkOperationRow) {
  return parseJsonArray<CleanupManifestEntry>(
    row.cleanupObjectKeysJson,
    item => typeof item === 'object' && item !== null
      && ['PRIVATE', 'PUBLIC'].includes(
        (item as CleanupManifestEntry).scope,
      )
      && typeof (item as CleanupManifestEntry).objectKey === 'string'
      && (item as CleanupManifestEntry).objectKey.length > 0,
  )
}

function findOperation(sqlite: Database.Database, id: string) {
  return sqlite.prepare(`${selectOperation} WHERE id = ?`)
    .get(id) as WatermarkOperationRow | undefined
}

function requireOperation(sqlite: Database.Database, id: string) {
  const operation = findOperation(sqlite, id)
  if (!operation) {
    throw new ServiceError(404, 'NOT_FOUND', 'Watermark operation was not found.')
  }
  return operation
}

function operationDto(row: WatermarkOperationRow): WatermarkOperationDto {
  return watermarkOperationDtoSchema.parse({
    operationId: row.id,
    operationType: row.operationType,
    profileId: row.profileId,
    status: row.status,
    affectedWorkCount: row.affectedWorkCount,
    affectedHeroSlideCount: row.affectedHeroSlideCount,
    targetVariantCount: row.targetVariantCount,
    generatedVariantCount: row.generatedVariantCount,
    verifiedVariantCount: row.verifiedVariantCount,
    cleanupPendingCount: cleanupEntries(row).length,
    previews: previews(row).map(preview => ({
      kind: preview.kind,
      width: preview.width,
      height: preview.height,
      format: preview.format,
      url: `/api/admin/v1/site/branding/watermark-operations/${row.id}/previews/${preview.kind}`,
    })),
    failureCode: row.internalErrorCode,
    version: row.version,
    startedAt: new Date(row.startedAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    completedAt: row.completedAt === null
      ? null
      : new Date(row.completedAt).toISOString(),
  })
}

function targetUsages(
  role: string,
  primary = false,
  hasPrimaryStudioPhoto = false,
): PublicMediaUsage[] {
  if (role === 'studio_photo' || role === 'design_sheet') {
    return workAssetPublicUsages(role, primary, hasPrimaryStudioPhoto)
  }
  throw new Error('Unsupported public watermark target role.')
}

function watermarkTargets(sqlite: Database.Database) {
  const workRows = sqlite.prepare(`
    SELECT DISTINCT
      asset.id AS assetId, asset.role,
      relation.is_primary AS "primary",
      EXISTS (
        SELECT 1 FROM work_assets AS primary_photo
        WHERE primary_photo.work_id = work.id
          AND primary_photo.role = 'studio_photo'
          AND primary_photo.is_primary = 1
      ) AS hasPrimaryStudioPhoto
    FROM works AS work
    JOIN work_assets AS relation ON relation.work_id = work.id
    JOIN assets AS asset ON asset.id = relation.asset_id
    WHERE work.publication_status = 'published' AND asset.status = 'READY'
      AND relation.role IN ('studio_photo', 'design_sheet')
  `).all() as Array<{
    assetId: string
    hasPrimaryStudioPhoto: number
    primary: number
    role: string
  }>
  // T34-F1：站点展示位使用无水印 site-display-v1，不参与 profile 重建。
  const targets = new Map<string, Set<PublicMediaUsage>>()
  for (const row of workRows) {
    const usages = targets.get(row.assetId) ?? new Set<PublicMediaUsage>()
    targetUsages(
      row.role,
      'primary' in row && row.primary === 1,
      'hasPrimaryStudioPhoto' in row && row.hasPrimaryStudioPhoto === 1,
    ).forEach(usage => usages.add(usage))
    targets.set(row.assetId, usages)
  }
  return [...targets].map(([assetId, usages]): WatermarkTarget => ({
    assetId,
    usages: [...usages],
  }))
}

function impact(sqlite: Database.Database, targets = watermarkTargets(sqlite)) {
  return {
    publishedWorkCount: Number(sqlite.prepare(`
      SELECT count(*) FROM works WHERE publication_status = 'published'
    `).pluck().get()),
    targetVariantCount: targets.reduce(
      (count, target) => count + publicVariantCountForUsages(target.usages),
      0,
    ),
    siteDisplayVariantCount: Number(sqlite.prepare(`
      SELECT count(*) FROM asset_variants
      WHERE storage_scope = 'PUBLIC' AND status = 'READY'
        AND protection_mode = 'none'
        AND recipe_version = '${SITE_DISPLAY_RECIPE_VERSION}'
    `).pluck().get()),
  }
}

export function getWatermarkBranding(
  sqlite: Database.Database,
): WatermarkBrandingDto {
  const branding = requireSiteBranding(sqlite)
  const active = branding.activeWatermarkProfileId
    ? requireWatermarkProfile(sqlite, branding.activeWatermarkProfileId)
    : null
  const draft = branding.draftWatermarkProfileId
    ? requireWatermarkProfile(sqlite, branding.draftWatermarkProfileId)
    : null
  const candidates = sqlite.prepare(`
    SELECT
      id AS assetId, version, status, mime_type AS mimeType,
      width, height, sha256, created_at AS createdAt
    FROM assets
    WHERE role = 'watermark_logo' AND status = 'READY'
    ORDER BY created_at DESC, id
  `).all() as Array<{
    assetId: string
    createdAt: number
    height: number
    mimeType: string
    sha256: string
    status: string
    version: number
    width: number
  }>
  return watermarkBrandingDtoSchema.parse({
    version: branding.version,
    activeProfile: active ? watermarkProfileDto(active) : null,
    draftProfile: draft ? watermarkProfileDto(draft) : null,
    lastOperationId: branding.lastWatermarkOperationId,
    candidates: candidates.map(candidate => ({
      assetId: candidate.assetId,
      version: candidate.version,
      status: candidate.status,
      mimeType: candidate.mimeType,
      width: candidate.width,
      height: candidate.height,
      digestSuffix: candidate.sha256.slice(-12),
      createdAt: new Date(candidate.createdAt).toISOString(),
      active: active?.sourceAssetId === candidate.assetId,
      draft: draft?.sourceAssetId === candidate.assetId,
      previewUrl: `/api/admin/v1/site/branding/watermark-assets/${candidate.assetId}/preview`,
    })),
    impact: impact(sqlite),
  })
}

function assertNoActiveOperation(sqlite: Database.Database) {
  const active = sqlite.prepare(`
    SELECT 1 FROM watermark_operations
    WHERE status NOT IN ('FAILED', 'DONE') LIMIT 1
  `).pluck().get()
  if (active) {
    throw new ServiceError(409, 'CONFLICT', 'A watermark operation is already active.', 'ACTIVE_OPERATION_EXISTS')
  }
}

function createOperation(
  sqlite: Database.Database,
  input: {
    brandingVersion: number
    operationType: WatermarkOperationRow['operationType']
    profileId: string
  },
  now: number,
) {
  assertNoActiveOperation(sqlite)
  const id = randomUUID()
  sqlite.transaction(() => {
    sqlite.prepare(`
      INSERT INTO watermark_operations (
        id, operation_type, profile_id, branding_version,
        status, started_at, updated_at
      ) VALUES (?, ?, ?, ?, 'GENERATING_PUBLIC', ?, ?)
    `).run(
      id,
      input.operationType,
      input.profileId,
      input.brandingVersion + 1,
      now,
      now,
    )
    const changed = sqlite.prepare(`
      UPDATE site_branding
      SET last_watermark_operation_id = ?, version = version + 1,
          updated_at = ?
      WHERE id = 'site' AND version = ?
    `).run(id, now, input.brandingVersion)
    if (changed.changes !== 1) {
      throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
    }
  })()
  return requireOperation(sqlite, id)
}

function updateOperation(
  sqlite: Database.Database,
  id: string,
  status: WatermarkOperationStatus,
  now: number,
  fields: {
    cleanup?: CleanupManifestEntry[]
    generated?: number
    preview?: PreviewManifestEntry[]
    target?: number
    verified?: number
  } = {},
) {
  sqlite.prepare(`
    UPDATE watermark_operations
    SET status = ?,
        target_variant_count = COALESCE(?, target_variant_count),
        generated_variant_count = COALESCE(?, generated_variant_count),
        verified_variant_count = COALESCE(?, verified_variant_count),
        preview_manifest_json = COALESCE(?, preview_manifest_json),
        cleanup_object_keys_json = COALESCE(?, cleanup_object_keys_json),
        internal_error_code = NULL, failure_stage = NULL,
        version = version + 1, updated_at = ?
    WHERE id = ?
  `).run(
    status,
    fields.target ?? null,
    fields.generated ?? null,
    fields.verified ?? null,
    fields.preview ? JSON.stringify(fields.preview) : null,
    fields.cleanup ? JSON.stringify(fields.cleanup) : null,
    now,
    id,
  )
}

function failOperation(
  sqlite: Database.Database,
  id: string,
  stage: string,
  code: string,
  cleanup: CleanupManifestEntry[],
  now: number,
) {
  sqlite.transaction(() => {
    sqlite.prepare(`
      UPDATE watermark_operations
      SET status = 'FAILED', cleanup_object_keys_json = ?,
          internal_error_code = ?, failure_stage = ?,
          version = version + 1, updated_at = ?, completed_at = ?
      WHERE id = ?
    `).run(JSON.stringify(cleanup), code, stage, now, now, id)
    const profileId = requireOperation(sqlite, id).profileId
    sqlite.prepare(`
      UPDATE watermark_profiles
      SET status = 'FAILED', version = version + 1, updated_at = ?
      WHERE id = ? AND status = 'APPLYING'
    `).run(now, profileId)
  })()
}

async function cleanupManifest(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  entries: CleanupManifestEntry[],
  now: number,
) {
  let remaining = [...entries]
  for (const entry of entries) {
    try {
      if (entry.scope === 'PUBLIC') {
        await storage.deletePublic(entry.objectKey)
        sqlite.prepare(`
          DELETE FROM asset_variants
          WHERE storage_scope = 'PUBLIC' AND object_key = ?
        `).run(entry.objectKey)
      }
      else {
        await storage.deletePrivate(entry.objectKey)
      }
      remaining = remaining.filter(candidate => candidate !== entry)
      sqlite.prepare(`
        UPDATE watermark_operations
        SET cleanup_object_keys_json = ?, version = version + 1,
            updated_at = ? WHERE id = ?
      `).run(JSON.stringify(remaining), now, operationId)
    }
    catch {
      return remaining
    }
  }
  return remaining
}

function previewSamples(sqlite: Database.Database) {
  const sampleFor = (role: 'design_sheet' | 'studio_photo') => sqlite.prepare(`
    SELECT asset.id AS assetId, asset.private_object_key AS privateObjectKey
    FROM assets AS asset
    LEFT JOIN work_assets AS relation ON relation.asset_id = asset.id
    LEFT JOIN works AS work ON work.id = relation.work_id
    WHERE asset.role = ? AND asset.status = 'READY'
    ORDER BY (work.publication_status = 'published') DESC,
             asset.created_at DESC LIMIT 1
  `).get(role) as { assetId: string, privateObjectKey: string } | undefined
  const work = sampleFor('studio_photo')
  if (!work) {
    throw new ServiceError(409, 'CONFLICT', 'Representative preview assets are unavailable.')
  }
  return {
    work,
    designSheet: sampleFor('design_sheet') ?? work,
  }
}

function previewPrefix(privateObjectKey: string, operationId: string) {
  const marker = privateObjectKey.indexOf('/original/')
  if (marker < 1) {
    throw new Error('Preview sample has no environment prefix.')
  }
  return `${privateObjectKey.slice(0, marker)}/preview/branding/${operationId}`
}

/** 长 OSS 操作前后更新心跳；失去 lease 立即停止后续提交。 */
function requireWatermarkLease(
  sqlite: Database.Database,
  lease: OperationLease,
) {
  if (!heartbeatOperationLease(sqlite, lease)) {
    throw new Error('Watermark operation lease was lost.')
  }
}

async function runPreview(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  now: number,
) {
  const operation = requireOperation(sqlite, operationId)
  const lease = claimOperationLease(sqlite, 'watermark_operations', operationId, now)
  if (!lease) {
    return requireOperation(sqlite, operationId)
  }
  const manifest: PreviewManifestEntry[] = []
  try {
    const samples = previewSamples(sqlite)
    const prefix = previewPrefix(samples.work.privateObjectKey, operation.id)
    const specifications = [
      { kind: 'work-card', assetId: samples.work.assetId, usage: 'work-card', width: 480 },
      { kind: 'detail', assetId: samples.work.assetId, usage: 'detail', width: 960 },
      { kind: 'design-sheet', assetId: samples.designSheet.assetId, usage: 'design-sheet', width: 960 },
    ] as const
    updateOperation(sqlite, operationId, 'GENERATING_PUBLIC', now, {
      target: specifications.length,
      generated: 0,
      verified: 0,
      preview: [],
      cleanup: [],
    })
    for (const specification of specifications) {
      requireWatermarkLease(sqlite, lease)
      const objectKey = `${prefix}/${specification.kind}.webp`
      const result = await generatePrivateWatermarkPreview(
        sqlite,
        storage,
        {
          assetId: specification.assetId,
          objectKey,
          profileId: operation.profileId,
          usage: specification.usage,
          width: specification.width,
        },
      )
      manifest.push({
        kind: specification.kind,
        objectKey,
        ...result,
      })
      requireWatermarkLease(sqlite, lease)
      updateOperation(sqlite, operationId, 'VERIFYING_PUBLIC', now, {
        generated: manifest.length,
        verified: manifest.length,
        preview: manifest,
      })
    }
    const finished = sqlite.prepare(`
      UPDATE watermark_operations
      SET status = 'DONE', lease_owner = NULL, lease_expires_at = NULL,
          version = version + 1, updated_at = ?, completed_at = ?
      WHERE id = ? AND lease_owner = ? AND attempt = ?
    `).run(now, now, operationId, lease.owner, lease.attempt)
    if (finished.changes !== 1) {
      throw new Error('Watermark preview commit lost its lease.')
    }
  }
  catch {
    if (!holdsOperationLease(sqlite, lease)) {
      return requireOperation(sqlite, operationId)
    }
    const cleanup = manifest.map(entry => ({
      scope: 'PRIVATE' as const,
      objectKey: entry.objectKey,
    }))
    const remaining = await cleanupManifest(
      sqlite,
      storage,
      operationId,
      cleanup,
      now,
    )
    failOperation(
      sqlite,
      operationId,
      'VERIFYING_PUBLIC',
      remaining.length > 0
        ? 'WATERMARK_PREVIEW_CLEANUP_FAILED'
        : 'WATERMARK_PREVIEW_FAILED',
      remaining,
      now,
    )
    releaseOperationLease(sqlite, lease, now)
  }
  return requireOperation(sqlite, operationId)
}

export async function createWatermarkPreview(
  sqlite: Database.Database,
  storage: MediaStorage,
  profileId: string,
  expectedProfileVersion: number,
  expectedBrandingVersion: number,
  now = Date.now(),
) {
  const branding = requireSiteBranding(sqlite)
  const profile = requireWatermarkProfile(sqlite, profileId)
  if (
    branding.version !== expectedBrandingVersion
    || branding.draftWatermarkProfileId !== profile.id
    || profile.version !== expectedProfileVersion
    || !['DRAFT', 'FAILED'].includes(profile.status)
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Watermark draft is stale.', 'WATERMARK_DRAFT_STALE')
  }
  watermarkSource(sqlite, profile)
  const operation = createOperation(sqlite, {
    brandingVersion: branding.version,
    operationType: 'WATERMARK_PREVIEW',
    profileId,
  }, now)
  return operationDto(await runPreview(
    sqlite,
    storage,
    operation.id,
    now,
  ))
}

async function runRebuild(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  now: number,
) {
  const operation = requireOperation(sqlite, operationId)
  const lease = claimOperationLease(sqlite, 'watermark_operations', operationId, now)
  if (!lease) {
    return requireOperation(sqlite, operationId)
  }
  let generated = 0
  try {
    const targets = watermarkTargets(sqlite)
    const counts = impact(sqlite, targets)
    sqlite.prepare(`
      UPDATE watermark_operations
      SET affected_work_count = ?, affected_hero_slide_count = ?,
          target_variant_count = ?, generated_variant_count = 0,
          verified_variant_count = 0, version = version + 1, updated_at = ?
      WHERE id = ?
    `).run(
      counts.publishedWorkCount,
      // 站点 Hero 不再随 profile 重建，受影响轮播项恒为 0。
      0,
      counts.targetVariantCount,
      now,
      operationId,
    )
    for (const target of targets) {
      requireWatermarkLease(sqlite, lease)
      const variants = await generatePublicVariantsForProfile(
        sqlite,
        storage,
        target.assetId,
        operation.profileId,
        target.usages,
        now,
      )
      generated += variants.length
      requireWatermarkLease(sqlite, lease)
      updateOperation(sqlite, operationId, 'VERIFYING_PUBLIC', now, {
        generated,
        verified: generated,
      })
    }
    if (generated !== counts.targetVariantCount) {
      throw new Error('Watermark rebuild target set is incomplete.')
    }
    const oldEntries = (sqlite.prepare(`
      SELECT object_key FROM asset_variants
      WHERE storage_scope = 'PUBLIC'
        AND protection_mode = 'watermark'
        AND watermark_profile_id IS NOT ?
    `).pluck().all(operation.profileId) as string[]).map(objectKey => ({
      scope: 'PUBLIC' as const,
      objectKey,
    }))
    requireWatermarkLease(sqlite, lease)
    updateOperation(sqlite, operationId, 'SWITCHING_PROFILE', now)
    sqlite.transaction(() => {
      // profile 切换是本操作的原子提交点：lease CAS 与 branding 版本 CAS 同事务。
      assertOperationLease(sqlite, lease)
      const branding = requireSiteBranding(sqlite)
      if (
        branding.version !== operation.brandingVersion
        || branding.draftWatermarkProfileId !== operation.profileId
      ) {
        throw new ServiceError(409, 'CONFLICT', 'Site branding changed during rebuild.')
      }
      if (branding.activeWatermarkProfileId) {
        sqlite.prepare(`
          UPDATE watermark_profiles
          SET status = 'RETIRED', version = version + 1, updated_at = ?
          WHERE id = ? AND status = 'ACTIVE'
        `).run(now, branding.activeWatermarkProfileId)
      }
      const activated = sqlite.prepare(`
        UPDATE watermark_profiles
        SET status = 'ACTIVE', version = version + 1, updated_at = ?
        WHERE id = ? AND status = 'APPLYING'
      `).run(now, operation.profileId)
      if (activated.changes !== 1) {
        throw new Error('Watermark profile activation failed.')
      }
      const switched = sqlite.prepare(`
        UPDATE site_branding
        SET active_watermark_profile_id = ?, draft_watermark_profile_id = NULL,
            version = version + 1, updated_at = ?
        WHERE id = 'site' AND version = ?
      `).run(operation.profileId, now, operation.brandingVersion)
      if (switched.changes !== 1) {
        throw new Error('Watermark profile switch failed.')
      }
      updateOperation(sqlite, operationId, 'CLEANING_PUBLIC', now, {
        cleanup: oldEntries,
      })
    })()

    const previewEntries = (sqlite.prepare(`
      SELECT preview_manifest_json FROM watermark_operations
      WHERE profile_id = ? AND operation_type = 'WATERMARK_PREVIEW'
        AND preview_manifest_json != '[]'
    `).pluck().all(operation.profileId) as string[])
      .flatMap(value => parseJsonArray<PreviewManifestEntry>(
        value,
        item => typeof item === 'object' && item !== null
          && typeof (item as PreviewManifestEntry).objectKey === 'string',
      ))
      .map(entry => ({
        scope: 'PRIVATE' as const,
        objectKey: entry.objectKey,
      }))
    const cleanup = [...oldEntries, ...previewEntries]
    sqlite.prepare(`
      UPDATE watermark_operations SET cleanup_object_keys_json = ?,
          version = version + 1, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(cleanup), now, operationId)
    const remaining = await cleanupManifest(
      sqlite,
      storage,
      operationId,
      cleanup,
      now,
    )
    if (remaining.length > 0) {
      failOperation(
        sqlite,
        operationId,
        'CLEANING_PUBLIC',
        'WATERMARK_CLEANUP_FAILED',
        remaining,
        now,
      )
      return requireOperation(sqlite, operationId)
    }
    sqlite.transaction(() => {
      sqlite.prepare(`
        UPDATE watermark_operations
        SET preview_manifest_json = '[]', version = version + 1,
            updated_at = ?
        WHERE profile_id = ? AND operation_type = 'WATERMARK_PREVIEW'
      `).run(now, operation.profileId)
      sqlite.prepare(`
        UPDATE watermark_operations
        SET status = 'DONE', cleanup_object_keys_json = '[]',
            lease_owner = NULL, lease_expires_at = NULL,
            version = version + 1, updated_at = ?, completed_at = ?
        WHERE id = ?
      `).run(now, now, operationId)
    })()
  }
  catch {
    if (!holdsOperationLease(sqlite, lease)) {
      return requireOperation(sqlite, operationId)
    }
    const active = requireSiteBranding(sqlite).activeWatermarkProfileId
    if (active === operation.profileId) {
      const remaining = cleanupEntries(requireOperation(sqlite, operationId))
      failOperation(
        sqlite,
        operationId,
        'CLEANING_PUBLIC',
        'WATERMARK_CLEANUP_FAILED',
        remaining,
        now,
      )
      releaseOperationLease(sqlite, lease, now)
      return requireOperation(sqlite, operationId)
    }
    const generatedEntries = (sqlite.prepare(`
      SELECT object_key FROM asset_variants
      WHERE storage_scope = 'PUBLIC' AND protection_mode = 'watermark'
        AND watermark_profile_id = ?
    `).pluck().all(operation.profileId) as string[]).map(objectKey => ({
      scope: 'PUBLIC' as const,
      objectKey,
    }))
    const remaining = await cleanupManifest(
      sqlite,
      storage,
      operationId,
      generatedEntries,
      now,
    )
    failOperation(
      sqlite,
      operationId,
      'GENERATING_PUBLIC',
      remaining.length > 0
        ? 'WATERMARK_CLEANUP_FAILED'
        : 'WATERMARK_REBUILD_FAILED',
      remaining,
      now,
    )
    releaseOperationLease(sqlite, lease, now)
  }
  return requireOperation(sqlite, operationId)
}

function watermarkOperationTypeOf(
  sqlite: Database.Database,
  operationId: string,
) {
  return sqlite.prepare(`
    SELECT operation_type FROM watermark_operations WHERE id = ?
  `).pluck().get(operationId) as string | undefined
}

/**
 * T34-F5：水印预览重启后重跑同一序列；预览对象按 operation id 前缀命名，
 * 因此重跑覆盖自己的对象，不会污染其他 attempt。
 */
registerOperationResumer({
  table: 'watermark_operations',
  matches: (sqlite, operationId) =>
    watermarkOperationTypeOf(sqlite, operationId) === 'WATERMARK_PREVIEW',
  failure: () => ({
    stage: 'VERIFYING_PUBLIC',
    code: 'WATERMARK_PREVIEW_INTERRUPTED',
  }),
  resume: async (sqlite, storage, operationId, now) => {
    const result = await runPreview(sqlite, storage, operationId, now)
    if (result.status !== 'DONE' && result.status !== 'FAILED') {
      throw new Error('Watermark preview did not reach a terminal state.')
    }
  },
})

/**
 * 水印应用重启：若 profile 已经切换为 ACTIVE，runRebuild 的 catch 分支会
 * 从残余 cleanup 清单继续；否则重新生成本 profile 的公开变体。
 * 两种路径都不会删除其他 profile 正在使用的有效对象。
 */
registerOperationResumer({
  table: 'watermark_operations',
  matches: (sqlite, operationId) =>
    watermarkOperationTypeOf(sqlite, operationId) === 'WATERMARK_REBUILD',
  failure: () => ({
    stage: 'GENERATING_PUBLIC',
    code: 'WATERMARK_REBUILD_INTERRUPTED',
  }),
  resume: async (sqlite, storage, operationId, now) => {
    const result = await runRebuild(sqlite, storage, operationId, now)
    if (result.status !== 'DONE' && result.status !== 'FAILED') {
      throw new Error('Watermark rebuild did not reach a terminal state.')
    }
  },
})

export function startWatermarkProfileApplication(
  sqlite: Database.Database,
  profileId: string,
  expectedProfileVersion: number,
  expectedBrandingVersion: number,
  now = Date.now(),
) {
  const branding = requireSiteBranding(sqlite)
  const profile = requireWatermarkProfile(sqlite, profileId)
  if (
    branding.activeWatermarkProfileId === profileId
    && profile.status === 'ACTIVE'
  ) {
    const repeated = sqlite.prepare(`
      ${selectOperation}
      WHERE operation_type = 'WATERMARK_REBUILD' AND profile_id = ?
        AND status = 'DONE' ORDER BY started_at DESC LIMIT 1
    `).get(profileId) as WatermarkOperationRow | undefined
    if (repeated) {
      return operationDto(repeated)
    }
  }
  if (
    branding.version !== expectedBrandingVersion
    || branding.draftWatermarkProfileId !== profile.id
    || profile.version !== expectedProfileVersion
    || !['DRAFT', 'FAILED'].includes(profile.status)
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Watermark draft is stale.', 'WATERMARK_DRAFT_STALE')
  }
  const previewed = sqlite.prepare(`
    SELECT 1 FROM watermark_operations
    WHERE operation_type = 'WATERMARK_PREVIEW' AND profile_id = ?
      AND status = 'DONE' AND verified_variant_count = 3 LIMIT 1
  `).pluck().get(profileId)
  if (!previewed) {
    throw new ServiceError(409, 'CONFLICT', 'A verified watermark preview is required.', 'WATERMARK_PREVIEW_REQUIRED')
  }
  watermarkSource(sqlite, profile)
  const operation = createOperation(sqlite, {
    brandingVersion: branding.version,
    operationType: 'WATERMARK_REBUILD',
    profileId,
  }, now)
  sqlite.prepare(`
    UPDATE watermark_profiles
    SET status = 'APPLYING', version = version + 1, updated_at = ?
    WHERE id = ? AND status IN ('DRAFT', 'FAILED')
  `).run(now, profileId)
  return operationDto(operation)
}

export async function runWatermarkProfileApplication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  now = Date.now(),
) {
  return operationDto(await runRebuild(
    sqlite,
    storage,
    operationId,
    now,
  ))
}

export async function applyWatermarkProfile(
  sqlite: Database.Database,
  storage: MediaStorage,
  profileId: string,
  expectedProfileVersion: number,
  expectedBrandingVersion: number,
  now = Date.now(),
) {
  const operation = startWatermarkProfileApplication(
    sqlite,
    profileId,
    expectedProfileVersion,
    expectedBrandingVersion,
    now,
  )
  return operation.status === 'DONE'
    ? operation
    : runWatermarkProfileApplication(sqlite, storage, operation.operationId, now)
}

export function getWatermarkOperation(
  sqlite: Database.Database,
  operationId: string,
) {
  return operationDto(requireOperation(sqlite, operationId))
}

export async function retryWatermarkOperation(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  expectedVersion: number,
  now = Date.now(),
) {
  let operation = requireOperation(sqlite, operationId)
  if (operation.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  if (operation.status !== 'FAILED') {
    throw new ServiceError(409, 'CONFLICT', 'Watermark operation is not retryable.', 'OPERATION_NOT_RETRYABLE')
  }
  const remaining = await cleanupManifest(
    sqlite,
    storage,
    operationId,
    cleanupEntries(operation),
    now,
  )
  if (remaining.length > 0) {
    failOperation(
      sqlite,
      operationId,
      'CLEANING_PUBLIC',
      'WATERMARK_CLEANUP_FAILED',
      remaining,
      now,
    )
    return operationDto(requireOperation(sqlite, operationId))
  }
  operation = requireOperation(sqlite, operationId)
  if (operation.operationType === 'WATERMARK_PREVIEW') {
    return operationDto(await runPreview(sqlite, storage, operationId, now))
  }
  if (requireSiteBranding(sqlite).activeWatermarkProfileId === operation.profileId) {
    sqlite.prepare(`
      UPDATE watermark_operations
      SET status = 'DONE', cleanup_object_keys_json = '[]',
          internal_error_code = NULL, failure_stage = NULL,
          version = version + 1, updated_at = ?, completed_at = ?
      WHERE id = ?
    `).run(now, now, operationId)
    return operationDto(requireOperation(sqlite, operationId))
  }
  sqlite.prepare(`
    UPDATE watermark_profiles
    SET status = 'APPLYING', version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'FAILED'
  `).run(now, operation.profileId)
  return operationDto(await runRebuild(sqlite, storage, operationId, now))
}

export async function getWatermarkPreviewContent(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  kind: WatermarkPreviewKind,
) {
  const operation = requireOperation(sqlite, operationId)
  const preview = previews(operation).find(entry => entry.kind === kind)
  if (!preview) {
    throw new ServiceError(404, 'NOT_FOUND', 'Watermark preview was not found.')
  }
  return storage.getPrivateSigned(preview.objectKey, Date.now() + 60_000)
}

export async function getWatermarkCandidateContent(
  sqlite: Database.Database,
  storage: MediaStorage,
  assetId: string,
) {
  const profile = sqlite.prepare(`
    SELECT
      id AS assetId, private_object_key AS objectKey,
      sha256 AS logoDigest, width, height
    FROM assets
    WHERE id = ? AND role = 'watermark_logo'
      AND status = 'READY' AND mime_type = 'image/png'
  `).get(assetId) as {
    assetId: string
    height: number
    logoDigest: string
    objectKey: string
    width: number
  } | undefined
  if (!profile) {
    throw new ServiceError(404, 'NOT_FOUND', 'Watermark candidate was not found.')
  }
  return storage.getPrivateSigned(profile.objectKey, Date.now() + 60_000)
}

export function activeWatermarkProfileId(sqlite: Database.Database) {
  const id = requireSiteBranding(sqlite).activeWatermarkProfileId
  return id && findWatermarkProfile(sqlite, id)?.status === 'ACTIVE'
    ? id
    : null
}
