import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'

export const R3_STAGE_A_CONFIRMATION = 'DELETE R3-A RETIRED MEDIA'
export const R3_STAGE_A_AUDIT_ACTION = 'R3_STAGE_A_OBJECT_CLEANUP'

const RETIRED_CONTACT_PLATFORMS = new Set([
  'douyin',
  'xiaohongshu',
  'bilibili',
])
const RETAINED_CONTACT_PLATFORMS = new Set(['qq', 'qq_group'])

export type R3StageAObjectScope = 'private' | 'public'

export interface R3StageAObjectInspection {
  current: boolean
  deleteMarkers: number
  versionBytes: number
  versions: number
}

export interface R3StageAObjectStore {
  inspect(scope: R3StageAObjectScope, objectKey: string): Promise<R3StageAObjectInspection>
  deleteAll(scope: R3StageAObjectScope, objectKey: string): Promise<void>
}

export interface R3StageACachePurger {
  purgeExactWaitAndVerifyUnavailable(urls: readonly string[]): Promise<void>
}

interface ContactChannelRecord {
  account?: unknown
  platform?: unknown
  qrCodeAssetId?: unknown
}

interface ObjectReference {
  objectKey: string
  scope: R3StageAObjectScope
}

interface InventoryDetails {
  counts: R3StageACleanupCounts
  edgeUrls: string[]
  objects: ObjectReference[]
}

export interface R3StageACleanupCounts {
  analyticsRows: number
  applicationBackups: number
  assetRows: number
  cacheUrls: number
  currentObjects: number
  deleteMarkers: number
  objectBytes: number
  objectKeys: number
  objectVersions: number
  operationRows: number
  orphanQrAssets: number
  pendingObjects: number
  privateOriginalKeys: number
  privatePreprocessKeys: number
  privatePreviewKeys: number
  privateObjectKeys: number
  publicDerivedKeys: number
  publicObjectKeys: number
  retiredAccounts: number
  retiredChannelEntries: number
  retiredQrReferences: number
  returnCharacters: number
  returnPhotos: number
  updates: number
  uploadSessions: number
  variantRows: number
}

export interface R3StageACleanupResult {
  contractReady: boolean
  counts: R3StageACleanupCounts
  dryRun: boolean
  environment: {
    appEnv: 'production' | 'test'
    databaseAbsolute: true
    endpointConfigured: true
    environmentPrefixKind: 'production' | 'isolated-test'
    privateBucketConfigured: true
    publicBucketConfigured: true
  }
  externalSnapshots: 'OPERATOR_CONFIRMATION_REQUIRED'
}

export interface R3StageACleanupOptions {
  appEnv: 'production' | 'test'
  applicationBackups?: number
  cache: R3StageACachePurger
  confirmation?: string
  databaseAbsolute: boolean
  dryRun?: boolean
  endpointConfigured: boolean
  environmentPrefix: string
  mediaOrigin: string
  now?: number
  privateBucketConfigured: boolean
  publicBucketConfigured: boolean
  sqlite: Database.Database
  store: R3StageAObjectStore
}

function tableExists(sqlite: Database.Database, table: string) {
  return sqlite.prepare(`
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?
  `).pluck().get(table) === 1
}

function columnExists(
  sqlite: Database.Database,
  table: string,
  column: string,
) {
  if (!tableExists(sqlite, table)) {
    return false
  }
  return (sqlite.pragma(`table_info(${table})`) as { name: string }[])
    .some(candidate => candidate.name === column)
}

function countRows(
  sqlite: Database.Database,
  table: string,
  where = '',
) {
  if (!tableExists(sqlite, table)) {
    return 0
  }
  return Number(sqlite.prepare(
    `SELECT COUNT(*) FROM ${table}${where ? ` WHERE ${where}` : ''}`,
  ).pluck().get() ?? 0)
}

function stringArray(value: unknown) {
  if (typeof value !== 'string') {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter(candidate => typeof candidate === 'string')
      : []
  }
  catch {
    throw new Error('Retirement inventory contains invalid cleanup JSON.')
  }
}

function contactChannels(sqlite: Database.Database) {
  if (!columnExists(sqlite, 'site_content', 'official_channels_json')) {
    return []
  }
  const value = sqlite.prepare(`
    SELECT official_channels_json FROM site_content WHERE id = 'site'
  `).pluck().get()
  if (typeof value !== 'string') {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      throw new Error()
    }
    return parsed.filter(candidate => (
      candidate !== null && typeof candidate === 'object'
    )) as ContactChannelRecord[]
  }
  catch {
    throw new Error('Official channel data is invalid; cleanup cannot continue.')
  }
}

function addObject(
  objects: Map<string, ObjectReference>,
  scope: R3StageAObjectScope,
  objectKey: unknown,
  environmentPrefix: string,
) {
  if (typeof objectKey !== 'string' || objectKey === '') {
    return
  }
  if (
    !objectKey.startsWith(environmentPrefix)
    || objectKey.includes('\\')
    || objectKey.includes('://')
    || objectKey.startsWith('/')
  ) {
    throw new Error('A retirement object is outside the confirmed environment prefix.')
  }
  const existing = objects.get(objectKey)
  if (existing && existing.scope !== scope) {
    throw new Error('A retirement object has conflicting storage scopes.')
  }
  objects.set(objectKey, { objectKey, scope })
}

function addExactCacheUrl(
  urls: Set<string>,
  candidate: string,
  mediaOrigin: string,
  environmentPrefix: string,
) {
  const url = new URL(candidate)
  const origin = new URL(mediaOrigin)
  const prefixPath = `${origin.pathname.replace(/\/$/u, '')}/${environmentPrefix}`
  if (!url.pathname.startsWith(prefixPath)) {
    throw new Error('A retirement cache URL is outside the confirmed environment prefix.')
  }
  if (
    url.origin !== origin.origin
    || url.pathname.endsWith('/')
    || url.search !== ''
    || url.hash !== ''
    || url.username !== ''
    || url.password !== ''
  ) {
    throw new Error('A retirement cache URL is not an exact configured media URL.')
  }
  urls.add(url.href)
}

function publicUrl(mediaOrigin: string, objectKey: string) {
  const url = new URL(mediaOrigin)
  url.pathname = `${url.pathname.replace(/\/$/u, '')}/${objectKey}`
  return url.href
}

function rows<T>(sqlite: Database.Database, sql: string, ...parameters: unknown[]) {
  return sqlite.prepare(sql).all(...parameters) as T[]
}

function hasNonQrAssetReference(sqlite: Database.Database, assetId: string) {
  const references: [string, string][] = [
    ['work_assets', 'asset_id'],
    ['return_photos', 'asset_id'],
    ['watermark_profiles', 'source_asset_id'],
    ['site_hero_slides', 'landscape_asset_id'],
    ['site_hero_slides', 'portrait_asset_id'],
  ]
  return references.some(([table, column]) => (
    tableExists(sqlite, table)
    && sqlite.prepare(`SELECT 1 FROM ${table} WHERE ${column} = ? LIMIT 1`)
      .pluck().get(assetId) === 1
  ))
}

async function inventory(
  options: R3StageACleanupOptions,
): Promise<InventoryDetails> {
  const {
    applicationBackups = 0,
    environmentPrefix,
    sqlite,
  } = options
  const channels = contactChannels(sqlite)
  const retainedQrIds = new Set(channels.flatMap(channel => (
    RETAINED_CONTACT_PLATFORMS.has(String(channel.platform))
    && typeof channel.qrCodeAssetId === 'string'
      ? [channel.qrCodeAssetId]
      : []
  )))
  const retiredChannels = channels.filter(channel => (
    RETIRED_CONTACT_PLATFORMS.has(String(channel.platform))
  ))
  const retiredQrIds = new Set(retiredChannels.flatMap(channel => (
    typeof channel.qrCodeAssetId === 'string'
      ? [channel.qrCodeAssetId]
      : []
  )))
  const orphanQrIds = [...retiredQrIds].filter(id => !retainedQrIds.has(id))

  const assetIds = new Set<string>()
  if (tableExists(sqlite, 'assets')) {
    for (const row of rows<{ id: string }>(sqlite, `
      SELECT id FROM assets WHERE role = 'return_photo'
    `)) {
      assetIds.add(row.id)
    }
    if (tableExists(sqlite, 'return_photos')) {
      for (const row of rows<{ assetId: string | null }>(sqlite, `
        SELECT asset_id AS assetId FROM return_photos WHERE asset_id IS NOT NULL
      `)) {
        if (row.assetId) assetIds.add(row.assetId)
      }
    }
  }

  const existingOrphanQrIds = new Set<string>()
  if (orphanQrIds.length > 0 && tableExists(sqlite, 'assets')) {
    const statement = sqlite.prepare(`
      SELECT id FROM assets WHERE id = ? AND role = 'contact_qr'
    `)
    for (const id of orphanQrIds) {
      if (
        statement.pluck().get(id) === id
        && !hasNonQrAssetReference(sqlite, id)
      ) {
        existingOrphanQrIds.add(id)
        assetIds.add(id)
      }
    }
  }

  const objects = new Map<string, ObjectReference>()
  const privateOriginalKeys = new Set<string>()
  const privatePreprocessKeys = new Set<string>()
  const privatePreviewKeys = new Set<string>()
  const publicDerivedKeys = new Set<string>()
  if (assetIds.size > 0) {
    const assetStatement = sqlite.prepare(`
      SELECT private_object_key AS objectKey FROM assets WHERE id = ?
    `)
    const variantStatement = tableExists(sqlite, 'asset_variants')
      ? sqlite.prepare(`
          SELECT storage_scope AS scope, object_key AS objectKey, usage
          FROM asset_variants WHERE asset_id = ?
        `)
      : null
    for (const assetId of assetIds) {
      const asset = assetStatement.get(assetId) as { objectKey: string } | undefined
      addObject(objects, 'private', asset?.objectKey, environmentPrefix)
      if (asset?.objectKey) privateOriginalKeys.add(asset.objectKey)
      for (const variant of (variantStatement?.all(assetId) ?? []) as {
        objectKey: string
        scope: string
        usage: string
      }[]) {
        const scope = variant.scope === 'PUBLIC' ? 'public' : 'private'
        addObject(objects, scope, variant.objectKey, environmentPrefix)
        if (scope === 'public') {
          publicDerivedKeys.add(variant.objectKey)
        }
        else if (variant.usage === 'preprocess') {
          privatePreprocessKeys.add(variant.objectKey)
        }
        else {
          privatePreviewKeys.add(variant.objectKey)
        }
      }
    }
  }

  let pendingObjects = 0
  if (tableExists(sqlite, 'upload_sessions')) {
    const uploadRows = rows<{ objectKey: string, status: string }>(sqlite, `
      SELECT private_object_key AS objectKey, status
      FROM upload_sessions
      WHERE owner_type = 'return' OR media_role = 'return_photo'
    `)
    for (const row of uploadRows) {
      addObject(objects, 'private', row.objectKey, environmentPrefix)
      if (row.status !== 'COMPLETED') pendingObjects += 1
    }
    if (existingOrphanQrIds.size > 0) {
      const statement = sqlite.prepare(`
        SELECT private_object_key AS objectKey, status
        FROM upload_sessions WHERE asset_id = ?
      `)
      for (const id of existingOrphanQrIds) {
        for (const row of statement.all(id) as {
          objectKey: string
          status: string
        }[]) {
          addObject(objects, 'private', row.objectKey, environmentPrefix)
          if (row.status !== 'COMPLETED') pendingObjects += 1
        }
      }
    }
  }

  const cacheUrls = new Set<string>()
  const mediaOrigin = options.mediaOrigin
  if (tableExists(sqlite, 'publication_operations')) {
    for (const row of rows<{
      cleanupKeys: string
      edgeUrls: string
    }>(sqlite, `
      SELECT cleanup_object_keys_json AS cleanupKeys,
        edge_purge_urls_json AS edgeUrls
      FROM publication_operations WHERE entity_type = 'RETURN_PHOTO'
    `)) {
      const cleanupKeys = stringArray(row.cleanupKeys)
      pendingObjects += cleanupKeys.length
      for (const key of cleanupKeys) {
        addObject(objects, 'public', key, environmentPrefix)
        publicDerivedKeys.add(key)
      }
      for (const url of stringArray(row.edgeUrls)) {
        addExactCacheUrl(cacheUrls, url, mediaOrigin, environmentPrefix)
      }
    }
  }
  for (const object of objects.values()) {
    if (object.scope === 'public') {
      cacheUrls.add(publicUrl(mediaOrigin, object.objectKey))
    }
  }

  let currentObjects = 0
  let deleteMarkers = 0
  let objectBytes = 0
  let objectVersions = 0
  for (const object of objects.values()) {
    const inspected = await options.store.inspect(object.scope, object.objectKey)
    currentObjects += inspected.current ? 1 : 0
    deleteMarkers += inspected.deleteMarkers
    objectBytes += inspected.versionBytes
    objectVersions += inspected.versions
  }

  return {
    counts: {
      analyticsRows: countRows(
        sqlite,
        'analytics_events',
        "route_key IN ('returns', 'return_character', 'updates') OR entity_type = 'return_character'",
      ),
      applicationBackups,
      assetRows: assetIds.size,
      cacheUrls: cacheUrls.size,
      currentObjects,
      deleteMarkers,
      objectBytes,
      objectKeys: objects.size,
      objectVersions,
      operationRows: countRows(
        sqlite,
        'publication_operations',
        "entity_type = 'RETURN_PHOTO'",
      ),
      orphanQrAssets: existingOrphanQrIds.size,
      pendingObjects,
      privateOriginalKeys: privateOriginalKeys.size,
      privatePreprocessKeys: privatePreprocessKeys.size,
      privatePreviewKeys: privatePreviewKeys.size,
      privateObjectKeys: [...objects.values()]
        .filter(object => object.scope === 'private').length,
      publicDerivedKeys: publicDerivedKeys.size,
      publicObjectKeys: [...objects.values()]
        .filter(object => object.scope === 'public').length,
      retiredAccounts: retiredChannels.filter(channel => (
        typeof channel.account === 'string' && channel.account.trim() !== ''
      )).length,
      retiredChannelEntries: retiredChannels.length,
      retiredQrReferences: retiredQrIds.size,
      returnCharacters: countRows(sqlite, 'return_characters'),
      returnPhotos: countRows(sqlite, 'return_photos'),
      updates: countRows(sqlite, 'updates'),
      uploadSessions: countRows(
        sqlite,
        'upload_sessions',
        "owner_type = 'return' OR media_role = 'return_photo'",
      ),
      variantRows: assetIds.size > 0 && tableExists(sqlite, 'asset_variants')
        ? [...assetIds].reduce((count, id) => count + Number(
            sqlite.prepare('SELECT COUNT(*) FROM asset_variants WHERE asset_id = ?')
              .pluck().get(id) ?? 0,
          ), 0)
        : 0,
    },
    edgeUrls: [...cacheUrls],
    objects: [...objects.values()],
  }
}

function assertEnvironment(options: R3StageACleanupOptions) {
  if (
    !options.databaseAbsolute
    || !options.endpointConfigured
    || !options.privateBucketConfigured
    || !options.publicBucketConfigured
  ) {
    throw new Error('R3-A environment isolation/configuration is not proven.')
  }
  if (options.appEnv === 'production') {
    if (options.environmentPrefix !== 'prod/') {
      throw new Error('Production R3-A cleanup requires the exact prod/ prefix.')
    }
    return 'production' as const
  }
  if (!/^test\/r3-a-drill\/[a-z0-9-]{8,80}\/$/u.test(options.environmentPrefix)) {
    throw new Error('Test R3-A cleanup requires a unique test/r3-a-drill/<run>/ prefix.')
  }
  return 'isolated-test' as const
}

function output(
  options: R3StageACleanupOptions,
  counts: R3StageACleanupCounts,
  prefixKind: 'production' | 'isolated-test',
  contractReady: boolean,
): R3StageACleanupResult {
  return {
    contractReady,
    counts,
    dryRun: options.dryRun !== false,
    environment: {
      appEnv: options.appEnv,
      databaseAbsolute: true,
      endpointConfigured: true,
      environmentPrefixKind: prefixKind,
      privateBucketConfigured: true,
      publicBucketConfigured: true,
    },
    externalSnapshots: 'OPERATOR_CONFIRMATION_REQUIRED',
  }
}

export async function runR3StageACleanup(
  options: R3StageACleanupOptions,
): Promise<R3StageACleanupResult> {
  const prefixKind = assertEnvironment(options)
  const first = await inventory(options)
  if (options.dryRun !== false) {
    return output(options, first.counts, prefixKind, false)
  }
  if (options.confirmation !== R3_STAGE_A_CONFIRMATION) {
    throw new Error(
      `Refusing R3-A deletion: pass --confirm "${R3_STAGE_A_CONFIRMATION}".`,
    )
  }

  for (const object of first.objects) {
    try {
      await options.store.deleteAll(object.scope, object.objectKey)
    }
    catch {
      throw new Error('R3-A object deletion failed; database Contract is forbidden.')
    }
  }
  for (const object of first.objects) {
    const remaining = await options.store.inspect(object.scope, object.objectKey)
    if (
      remaining.current
      || remaining.versions > 0
      || remaining.deleteMarkers > 0
    ) {
      throw new Error('R3-A object verification failed; database Contract is forbidden.')
    }
  }
  if (first.edgeUrls.length > 0) {
    try {
      await options.cache.purgeExactWaitAndVerifyUnavailable(first.edgeUrls)
    }
    catch {
      throw new Error('R3-A ESA purge failed; database Contract is forbidden.')
    }
  }

  const verified = await inventory(options)
  const contractReady = verified.counts.currentObjects === 0
    && verified.counts.objectVersions === 0
    && verified.counts.deleteMarkers === 0
  if (!contractReady) {
    throw new Error('R3-A verification changed after cleanup; database Contract is forbidden.')
  }
  options.sqlite.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, entity_type, entity_id, result, created_at
    )
    SELECT ?, NULL, ?, 'stage_a_retirement', 'object_cleanup', 'SUCCESS', ?
    WHERE NOT EXISTS (
      SELECT 1 FROM audit_logs WHERE action = ? AND result = 'SUCCESS'
    )
  `).run(
    randomUUID(),
    R3_STAGE_A_AUDIT_ACTION,
    options.now ?? Date.now(),
    R3_STAGE_A_AUDIT_ACTION,
  )
  return output(options, verified.counts, prefixKind, true)
}
