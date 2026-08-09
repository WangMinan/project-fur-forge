import { setTimeout as delay } from 'node:timers/promises'
import type Database from 'better-sqlite3'
import type { PublicMediaCache } from '../public-media-cache'
import {
  assertExactPublicMediaUrls,
  MAX_EDGE_PURGE_FILES,
} from '../public-media-cache'
import {
  PRODUCTION_MEDIA_ORIGIN,
  publicMediaUrlForObjectKey,
} from '../recipe/media-mapper'
import {
  findPublicationOperation,
  markOperationEdgePurgeChecked,
  markOperationEdgePurgeSubmitted,
  resetOperationEdgePurge,
} from '../repository/publication-repository'

const DEFAULT_POLL_ATTEMPTS = 20
const DEFAULT_POLL_INTERVAL_MS = 2_000

export type EdgePurgeFailureCode =
  | 'EDGE_PURGE_FAILED'
  | 'EDGE_PURGE_QUERY_FAILED'
  | 'EDGE_PURGE_SUBMIT_FAILED'
  | 'EDGE_PURGE_TASK_NOT_FOUND'
  | 'EDGE_PURGE_TIMEOUT'

function requireOperation(sqlite: Database.Database, operationId: string) {
  const operation = findPublicationOperation(sqlite, operationId)
  if (!operation) {
    throw new Error('Publication operation was not found.')
  }
  return operation
}

export function parseEdgePurgeUrls(value: string) {
  const parsed = JSON.parse(value) as unknown
  if (
    !Array.isArray(parsed)
    || parsed.some(url => typeof url !== 'string' || url.length === 0)
    || parsed.length > MAX_EDGE_PURGE_FILES
  ) {
    throw new Error('Edge purge manifest is invalid.')
  }
  return parsed as string[]
}

export function edgePurgeUrlsForObjectKeys(
  cache: PublicMediaCache,
  objectKeys: readonly string[],
) {
  if (!cache.enabled || objectKeys.length === 0) {
    return []
  }
  const urls = [...new Set(objectKeys)].map(key => (
    publicMediaUrlForObjectKey(PRODUCTION_MEDIA_ORIGIN, key)
  ))
  assertExactPublicMediaUrls(urls)
  return urls
}

export async function runOperationEdgePurge(
  sqlite: Database.Database,
  cache: PublicMediaCache,
  operationId: string,
  now: number,
  options: {
    heartbeat?: () => void
    pollAttempts?: number
    pollIntervalMs?: number
  } = {},
): Promise<EdgePurgeFailureCode | null> {
  let operation = requireOperation(sqlite, operationId)
  const urls = parseEdgePurgeUrls(operation.edgePurgeUrlsJson)
  if (urls.length === 0 || operation.edgePurgeStatus === 'NOT_REQUIRED') {
    return null
  }
  if (!cache.enabled) {
    markOperationEdgePurgeChecked(sqlite, operationId, {
      reason: 'EDGE_PURGE_CONFIGURATION_MISSING',
      status: 'FAILED',
    }, now)
    return 'EDGE_PURGE_SUBMIT_FAILED'
  }

  if (operation.edgePurgeStatus === 'FAILED') {
    resetOperationEdgePurge(sqlite, operationId, now)
    operation = requireOperation(sqlite, operationId)
  }

  let taskId = operation.edgePurgeTaskId
  if (operation.edgePurgeStatus === 'PENDING' || !taskId) {
    try {
      options.heartbeat?.()
      taskId = await cache.purgeExactFiles(urls)
      options.heartbeat?.()
      markOperationEdgePurgeSubmitted(sqlite, operationId, taskId, now)
    }
    catch {
      markOperationEdgePurgeChecked(sqlite, operationId, {
        reason: 'EDGE_PURGE_SUBMIT_FAILED',
        status: 'FAILED',
      }, now)
      return 'EDGE_PURGE_SUBMIT_FAILED'
    }
  }
  if (!taskId) {
    throw new Error('ESA purge task ID is missing after submission.')
  }

  const pollAttempts = options.pollAttempts ?? DEFAULT_POLL_ATTEMPTS
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    let status
    try {
      options.heartbeat?.()
      status = await cache.describeExactFilePurge(taskId, urls)
      options.heartbeat?.()
    }
    catch {
      markOperationEdgePurgeChecked(sqlite, operationId, {
        reason: 'EDGE_PURGE_QUERY_FAILED',
        status: 'FAILED',
      }, now)
      return 'EDGE_PURGE_QUERY_FAILED'
    }

    if (status === 'Complete') {
      markOperationEdgePurgeChecked(sqlite, operationId, {
        status: 'COMPLETE',
      }, now)
      return null
    }
    if (status === 'Failed' || status === 'Missing') {
      const code = status === 'Failed'
        ? 'EDGE_PURGE_FAILED'
        : 'EDGE_PURGE_TASK_NOT_FOUND'
      markOperationEdgePurgeChecked(sqlite, operationId, {
        reason: code,
        status: 'FAILED',
      }, now)
      return code
    }
    markOperationEdgePurgeChecked(sqlite, operationId, {
      status: 'PURGING',
    }, now)
    if (attempt < pollAttempts - 1) {
      await delay(pollIntervalMs)
    }
  }

  markOperationEdgePurgeChecked(sqlite, operationId, {
    reason: 'EDGE_PURGE_TIMEOUT',
    status: 'FAILED',
  }, now)
  return 'EDGE_PURGE_TIMEOUT'
}
