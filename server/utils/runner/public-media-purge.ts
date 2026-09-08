import type Database from 'better-sqlite3'
import type { PublicMediaCache } from '../public-media-cache'
import {
  assertExactPublicMediaUrls,
  MAX_EDGE_PURGE_FILES,
} from '../public-media-cache'
import {
  publicMediaUrlForObjectKey,
} from '../recipe/media-mapper'
import {
  findPublicationOperation,
  markOperationEdgePurgeChecked,
  markOperationEdgePurgeSubmitted,
} from '../repository/publication-repository'

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
  const mediaOrigin = cache.mediaOrigin
  if (!mediaOrigin) {
    throw new Error('ESA cache media origin is missing.')
  }
  const urls = [...new Set(objectKeys)].map(key => (
    publicMediaUrlForObjectKey(mediaOrigin, key, 'production')
  ))
  assertExactPublicMediaUrls(urls, mediaOrigin)
  return urls
}

export function dispatchOperationEdgePurge(
  sqlite: Database.Database,
  cache: PublicMediaCache,
  operationId: string,
  now: number,
) {
  const operation = requireOperation(sqlite, operationId)
  const urls = parseEdgePurgeUrls(operation.edgePurgeUrlsJson)
  if (urls.length === 0 || operation.edgePurgeStatus === 'NOT_REQUIRED'
    || operation.edgePurgeStatus === 'COMPLETE' || operation.edgePurgeTaskId) {
    return
  }
  if (!cache.enabled) {
    markOperationEdgePurgeChecked(sqlite, operationId, {
      reason: 'EDGE_PURGE_CONFIGURATION_MISSING',
      status: 'FAILED',
    }, now)
    return
  }

  // ponytail: best-effort submission in this process; add durable retries only if required.
  // ESA latency and failures never reopen a completed business operation.
  void Promise.resolve().then(() => cache.purgeExactFiles(urls)).then(
    taskId => markOperationEdgePurgeSubmitted(sqlite, operationId, taskId, Date.now()),
    () => markOperationEdgePurgeChecked(sqlite, operationId, {
      reason: 'EDGE_PURGE_SUBMIT_FAILED',
      status: 'FAILED',
    }, Date.now()),
  ).catch(() => {
    console.error('ESA purge submission result could not be recorded.')
  })
}
