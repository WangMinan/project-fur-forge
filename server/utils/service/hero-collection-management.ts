import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  adminHeroCollectionDtoSchema,
} from '../../../shared/schemas/home'
import type {
  AdminHeroCollectionDto,
  HeroOrientation,
  HeroPlacement,
  PublicationOperationDto,
} from '../../../shared/types/contracts'
import {
  HERO_UPSCALE_RECIPE_VERSION,
  heroUpscaleTarget,
} from '../recipe/media-source'
import {
  missingSiteDisplayVariantCount,
  SITE_HERO_USAGES,
} from '../recipe/site-display-recipe'
import {
  claimHeroCollectionVersion,
  deleteDisabledHeroItem,
  findHeroCollection,
  findHeroItem,
  findHeroItemAsset,
  findHeroItems,
  findHeroItemVariants,
  insertHeroItem,
  isHeroItemAssetAssigned,
  replaceEnabledHeroItemOrder,
  updateDisabledHeroItem,
} from '../repository/hero-collection-repository'
import type {
  HeroItemRow,
  HeroVariantRow,
} from '../repository/hero-collection-repository'
import { hasBlockingPublicationCleanup } from '../repository/publication-repository'
import { ServiceError } from '../service-error'
import { getLatestPublicationOperations } from '../runner/work-publication'

export interface HeroItemInput {
  alt: string
  assetId: string
  sortOrder: number
}

function requireCollection(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
) {
  const collection = findHeroCollection(sqlite, placement, orientation)
  if (!collection) {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Hero collection is unavailable.')
  }
  return collection
}

function requireCollectionVersion(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  expectedVersion: number,
) {
  const collection = requireCollection(sqlite, placement, orientation)
  if (collection.version !== expectedVersion) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Hero collection version is stale.',
      'VERSION_CONFLICT',
    )
  }
  return collection
}

export function requireHeroCollectionItem(
  sqlite: Database.Database,
  id: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
) {
  const item = findHeroItem(sqlite, id, placement, orientation)
  if (!item) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero item was not found.')
  }
  return item
}

function hasUpscaleVariant(
  variants: readonly HeroVariantRow[],
  inputSha256: string,
  width: number,
  height: number,
) {
  return variants.some(variant => (
    variant.storageScope === 'PRIVATE'
    && variant.status === 'READY'
    && variant.usage === 'preprocess'
    && variant.recipeVersion === HERO_UPSCALE_RECIPE_VERSION
    && variant.inputSha256 === inputSha256
    && variant.byteSize !== null
    && variant.byteSize <= 20_000_000
    && variant.width === width
    && variant.height === height
  ))
}

export function heroItemUpscaleReady(
  item: Pick<HeroItemRow,
    'height' | 'orientation' | 'sha256' | 'width'>,
  variants: readonly HeroVariantRow[],
) {
  const role = item.orientation === 'landscape'
    ? 'home_hero_landscape'
    : 'home_hero_portrait'
  const target = heroUpscaleTarget(role)!
  return (
    item.width >= target.width && item.height >= target.height
  ) || hasUpscaleVariant(
    variants,
    item.sha256,
    target.width,
    target.height,
  )
}

function itemDto(
  row: HeroItemRow,
  variants: readonly HeroVariantRow[],
  operations: ReadonlyMap<string, PublicationOperationDto>,
) {
  const usage = SITE_HERO_USAGES[row.placement][row.orientation]
  const publicationOperation = [
    operations.get(`${row.id}:PUBLISH`),
    operations.get(`${row.id}:UNPUBLISH`),
  ]
    .filter((operation): operation is PublicationOperationDto => (
      operation !== undefined && operation.status !== 'DONE'
    ))
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]
    ?? null
  return {
    id: row.id,
    version: row.version,
    alt: row.alt,
    sortOrder: row.sortOrder,
    enabled: row.enabled === 1,
    asset: {
      assetId: row.assetId,
      width: row.width,
      height: row.height,
    },
    upscaleReady: heroItemUpscaleReady(row, variants),
    upscaleOperation: operations.get(`${row.id}:UPSCALE`) ?? null,
    missingVariantCount: missingSiteDisplayVariantCount(usage, variants),
    publicationOperation,
  }
}

export function getAdminHeroCollection(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
): AdminHeroCollectionDto {
  const collection = requireCollection(sqlite, placement, orientation)
  const items = findHeroItems(sqlite, placement, orientation)
  const variants = findHeroItemVariants(
    sqlite,
    items.map(item => item.assetId),
  )
  const operations = new Map(getLatestPublicationOperations(
    sqlite,
    'HOME',
    items.map(item => item.id),
  ).map(operation => [
    `${operation.entityId}:${operation.operationType}`,
    operation,
  ]))
  return adminHeroCollectionDtoSchema.parse({
    placement,
    orientation,
    version: collection.version,
    items: items.map(item => itemDto(
      item,
      variants.get(item.assetId) ?? [],
      operations,
    )),
  })
}

function assertHeroItemAsset(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  assetId: string,
  exceptItemId?: string,
) {
  const asset = findHeroItemAsset(sqlite, assetId, placement, orientation)
  if (!asset) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero asset was not found.')
  }
  const expectedRole = orientation === 'landscape'
    ? 'home_hero_landscape'
    : 'home_hero_portrait'
  const legacyMigratedAsset = exceptItemId
    ? findHeroItem(sqlite, exceptItemId)?.assetId === assetId
    : false
  if (
    asset.role !== expectedRole
    || asset.status !== 'READY'
    || (orientation === 'landscape' ? asset.width <= asset.height : asset.height <= asset.width)
    || (asset.uploadedForCollection !== 1 && !legacyMigratedAsset)
  ) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Hero asset is not ready for this collection.',
      'HERO_ASSET_NOT_READY',
    )
  }
  if (isHeroItemAssetAssigned(sqlite, assetId, exceptItemId)) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Hero asset is already assigned.',
      'HERO_ASSET_ALREADY_ASSIGNED',
    )
  }
  return asset
}

function translateConstraint(error: unknown): never {
  if (error instanceof ServiceError) {
    throw error
  }
  if (String(error).includes('hero') || String(error).includes('UNIQUE')) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Hero collection changed or conflicts.',
      'VERSION_CONFLICT',
    )
  }
  throw error
}

export function createHeroCollectionItem(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  expectedVersion: number,
  input: HeroItemInput,
  now = Date.now(),
) {
  requireCollectionVersion(sqlite, placement, orientation, expectedVersion)
  assertHeroItemAsset(sqlite, placement, orientation, input.assetId)
  try {
    sqlite.transaction(() => {
      claimHeroCollectionVersion(
        sqlite,
        placement,
        orientation,
        expectedVersion,
        now,
      )
      insertHeroItem(sqlite, {
        ...input,
        id: randomUUID(),
        placement,
        orientation,
      }, now)
    })()
  }
  catch (error) {
    translateConstraint(error)
  }
  return getAdminHeroCollection(sqlite, placement, orientation)
}

export function updateHeroCollectionItem(
  sqlite: Database.Database,
  id: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  expectedVersion: number,
  input: HeroItemInput,
  now = Date.now(),
) {
  requireCollectionVersion(sqlite, placement, orientation, expectedVersion)
  const item = requireHeroCollectionItem(sqlite, id, placement, orientation)
  if (item.enabled === 1) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Disable the hero item before editing it.',
      'HERO_ITEM_ENABLED',
    )
  }
  assertHeroItemAsset(sqlite, placement, orientation, input.assetId, id)
  try {
    sqlite.transaction(() => {
      claimHeroCollectionVersion(
        sqlite,
        placement,
        orientation,
        expectedVersion,
        now,
      )
      if (updateDisabledHeroItem(
        sqlite,
        id,
        placement,
        orientation,
        input,
        now,
      ) !== 1) {
        throw new ServiceError(409, 'CONFLICT', 'Hero item changed.')
      }
    })()
  }
  catch (error) {
    translateConstraint(error)
  }
  return getAdminHeroCollection(sqlite, placement, orientation)
}

export function deleteHeroCollectionItem(
  sqlite: Database.Database,
  id: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  expectedVersion: number,
  now = Date.now(),
) {
  requireCollectionVersion(sqlite, placement, orientation, expectedVersion)
  const item = requireHeroCollectionItem(sqlite, id, placement, orientation)
  if (item.enabled === 1) {
    throw new ServiceError(409, 'CONFLICT', 'Disable the hero item before deleting it.')
  }
  if (hasBlockingPublicationCleanup(sqlite, 'HOME', id)) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Finish public media cleanup before deleting the hero item.',
      'PUBLICATION_CLEANUP_PENDING',
    )
  }
  sqlite.transaction(() => {
    claimHeroCollectionVersion(
      sqlite,
      placement,
      orientation,
      expectedVersion,
      now,
    )
    if (deleteDisabledHeroItem(sqlite, id, placement, orientation) !== 1) {
      throw new ServiceError(409, 'CONFLICT', 'Hero item changed.')
    }
  })()
  return getAdminHeroCollection(sqlite, placement, orientation)
}

export function reorderEnabledHeroCollectionItems(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  expectedVersion: number,
  itemIds: readonly string[],
  now = Date.now(),
) {
  requireCollectionVersion(sqlite, placement, orientation, expectedVersion)
  const enabledIds = findHeroItems(sqlite, placement, orientation)
    .filter(item => item.enabled === 1)
    .map(item => item.id)
  if (
    itemIds.length < 1
    || itemIds.length > 5
    || new Set(itemIds).size !== itemIds.length
    || itemIds.length !== enabledIds.length
    || itemIds.some(id => !enabledIds.includes(id))
  ) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Enabled hero item order is stale.',
      'HERO_ORDER_STALE',
    )
  }
  sqlite.transaction(() => {
    claimHeroCollectionVersion(
      sqlite,
      placement,
      orientation,
      expectedVersion,
      now,
    )
    replaceEnabledHeroItemOrder(sqlite, placement, orientation, itemIds, now)
  })()
  return getAdminHeroCollection(sqlite, placement, orientation)
}
