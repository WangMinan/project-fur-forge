import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  watermarkBrandingDtoSchema,
  watermarkOperationDtoSchema,
} from '../../../shared/schemas/watermark'
import type {
  WatermarkBrandingDto,
  WatermarkOperationDto,
  WatermarkOperationStatus,
  WatermarkPreviewKind,
} from '../../../shared/types/contracts'
import type { MediaStorage } from '../media-storage'
import {
  generatePrivateWatermarkPreview,
  generatePublicVariantsForProfile,
  publicVariantCountForUsages,
  workAssetPublicUsages,
} from '../recipe/media-recipe'
import type { PublicMediaUsage } from '../recipe/media-recipe'
import {
  assertOperationLease,
  claimOperationLease,
  heartbeatOperationLease,
  holdsOperationLease,
  releaseOperationLease,
} from '../repository/operation-lease'
import type { OperationLease } from '../repository/operation-lease'
import { registerOperationResumer } from './operation-recovery'
import { deletePublicVariant } from '../repository/publication-repository'
import {
  activateApplyingProfile,
  claimBrandingOperation,
  clearPreviewManifests,
  completeWatermarkOperation,
  countPublishedWorks,
  countSiteDisplayVariants,
  failApplyingProfile,
  findDoneRebuildForProfile,
  findPreviewManifestJson,
  findPreviewSample,
  findPublicKeysForOtherProfiles,
  findPublicKeysForProfile,
  findWatermarkCandidates,
  findWatermarkCandidateSource,
  findWatermarkOperation,
  findWatermarkOperationType,
  findWatermarkTargets,
  finishWatermarkRebuild,
  hasActiveWatermarkOperation,
  hasVerifiedPreview,
  insertWatermarkOperation,
  markWatermarkOperationFailed,
  reopenFailedWatermarkOperation,
  resolveFailedWatermarkOperation,
  retireActiveProfile,
  setRebuildCounts,
  setWatermarkCleanupJson,
  startApplyingProfile,
  switchActiveProfile,
  updateWatermarkOperationRow,
} from '../repository/watermark-repository'
import type { WatermarkOperationRow } from '../repository/watermark-repository'
import { ServiceError } from '../service-error'
import { SITE_DISPLAY_RECIPE_VERSION } from '../recipe/site-display-recipe'
import {
  findWatermarkProfile,
  requireSiteBranding,
  requireWatermarkProfile,
  watermarkProfileDto,
  watermarkSource,
} from '../service/watermark-profile'

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

interface WatermarkTarget {
  assetId: string
  usages: PublicMediaUsage[]
}

/**
 * T34-F4：SQL、行映射与条件更新已移入 watermark-repository。
 * 本文件保留 service（profile 校验与 DTO 组合）与 apply runner（operation、
 * OSS 副作用、profile 原子切换、心跳、失败与清理）。
 */

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

function requireOperation(sqlite: Database.Database, id: string) {
  const operation = findWatermarkOperation(sqlite, id)
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
  const workRows = findWatermarkTargets(sqlite)
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
    publishedWorkCount: countPublishedWorks(sqlite),
    targetVariantCount: targets.reduce(
      (count, target) => count + publicVariantCountForUsages(target.usages),
      0,
    ),
    siteDisplayVariantCount: countSiteDisplayVariants(
      sqlite,
      SITE_DISPLAY_RECIPE_VERSION,
    ),
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
  const candidates = findWatermarkCandidates(sqlite)
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
  if (hasActiveWatermarkOperation(sqlite)) {
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
    insertWatermarkOperation(sqlite, {
      brandingVersion: input.brandingVersion + 1,
      id,
      operationType: input.operationType,
      profileId: input.profileId,
    }, now)
    const changed = claimBrandingOperation(
      sqlite,
      id,
      input.brandingVersion,
      now,
    )
    if (changed !== 1) {
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
  updateWatermarkOperationRow(sqlite, id, status, {
    cleanupJson: fields.cleanup ? JSON.stringify(fields.cleanup) : null,
    generated: fields.generated ?? null,
    previewJson: fields.preview ? JSON.stringify(fields.preview) : null,
    target: fields.target ?? null,
    verified: fields.verified ?? null,
  }, now)
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
    markWatermarkOperationFailed(sqlite, id, {
      cleanupJson: JSON.stringify(cleanup),
      code,
      stage,
    }, now)
    failApplyingProfile(sqlite, requireOperation(sqlite, id).profileId, now)
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
        deletePublicVariant(sqlite, entry.objectKey)
      }
      else {
        await storage.deletePrivate(entry.objectKey)
      }
      remaining = remaining.filter(candidate => candidate !== entry)
      setWatermarkCleanupJson(
        sqlite,
        operationId,
        JSON.stringify(remaining),
        now,
      )
    }
    catch {
      return remaining
    }
  }
  return remaining
}

function previewSamples(sqlite: Database.Database) {
  const sampleFor = (role: 'design_sheet' | 'studio_photo') =>
    findPreviewSample(sqlite, role)
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
    const finished = completeWatermarkOperation(sqlite, operationId, now, {
      attempt: lease.attempt,
      owner: lease.owner,
    })
    if (finished !== 1) {
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
    setRebuildCounts(sqlite, operationId, {
      // 站点 Hero 不再随 profile 重建，受影响轮播项恒为 0。
      affectedHeroSlideCount: 0,
      affectedWorkCount: counts.publishedWorkCount,
      targetVariantCount: counts.targetVariantCount,
    }, now)
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
    const oldEntries = findPublicKeysForOtherProfiles(
      sqlite,
      operation.profileId,
    ).map(objectKey => ({ scope: 'PUBLIC' as const, objectKey }))
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
        retireActiveProfile(sqlite, branding.activeWatermarkProfileId, now)
      }
      if (activateApplyingProfile(sqlite, operation.profileId, now) !== 1) {
        throw new Error('Watermark profile activation failed.')
      }
      const switched = switchActiveProfile(
        sqlite,
        operation.profileId,
        operation.brandingVersion,
        now,
      )
      if (switched !== 1) {
        throw new Error('Watermark profile switch failed.')
      }
      updateOperation(sqlite, operationId, 'CLEANING_PUBLIC', now, {
        cleanup: oldEntries,
      })
    })()

    const previewEntries = findPreviewManifestJson(sqlite, operation.profileId)
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
    setWatermarkCleanupJson(sqlite, operationId, JSON.stringify(cleanup), now)
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
      clearPreviewManifests(sqlite, operation.profileId, now)
      finishWatermarkRebuild(sqlite, operationId, now)
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
    const generatedEntries = findPublicKeysForProfile(
      sqlite,
      operation.profileId,
    ).map(objectKey => ({ scope: 'PUBLIC' as const, objectKey }))
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
  return findWatermarkOperationType(sqlite, operationId)
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
    const repeated = findDoneRebuildForProfile(sqlite, profileId)
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
  if (!hasVerifiedPreview(sqlite, profileId)) {
    throw new ServiceError(409, 'CONFLICT', 'A verified watermark preview is required.', 'WATERMARK_PREVIEW_REQUIRED')
  }
  watermarkSource(sqlite, profile)
  const operation = createOperation(sqlite, {
    brandingVersion: branding.version,
    operationType: 'WATERMARK_REBUILD',
    profileId,
  }, now)
  startApplyingProfile(sqlite, profileId, now)
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
  if (requireSiteBranding(sqlite).activeWatermarkProfileId === operation.profileId) {
    // profile 已经切换成功，只剩清理；清理已在上面完成，直接收尾。
    resolveFailedWatermarkOperation(sqlite, operationId, now)
    return operationDto(requireOperation(sqlite, operationId))
  }
  // T34-F5：runner 只推进非终态记录（lease 不授予终态），因此重试必须先把
  // FAILED 重新打开，否则 runPreview/runRebuild 会静默什么都不做。
  reopenFailedWatermarkOperation(sqlite, operationId, now)
  if (operation.operationType === 'WATERMARK_PREVIEW') {
    return operationDto(await runPreview(sqlite, storage, operationId, now))
  }
  startApplyingProfile(sqlite, operation.profileId, now, true)
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
  const profile = findWatermarkCandidateSource(sqlite, assetId)
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
