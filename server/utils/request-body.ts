import type { H3Event } from 'h3'
import { createApiError } from './api-error'

export const ADMIN_JSON_BODY_MAX_BYTES = 64 * 1_024

function bodyError(statusCode: 400 | 413) {
  return createApiError(
    statusCode,
    'VALIDATION_ERROR',
    statusCode === 413
      ? 'Request body is too large.'
      : 'Request body is invalid.',
  )
}

function readLimitedRawBody(event: H3Event) {
  return new Promise<string>((resolve, reject) => {
    const request = event.node.req
    const chunks: Buffer[] = []
    let byteLength = 0

    const cleanup = () => {
      request.off('data', onData)
      request.off('end', onEnd)
      request.off('error', onError)
      request.off('aborted', onInterrupted)
      request.off('close', onClose)
    }
    const onData = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      byteLength += buffer.byteLength
      if (byteLength > ADMIN_JSON_BODY_MAX_BYTES) {
        cleanup()
        request.resume()
        reject(bodyError(413))
        return
      }
      chunks.push(buffer)
    }
    const onEnd = () => {
      cleanup()
      resolve(Buffer.concat(chunks).toString('utf8'))
    }
    const onError = () => {
      cleanup()
      reject(bodyError(400))
    }
    const onInterrupted = () => {
      cleanup()
      reject(bodyError(400))
    }
    const onClose = () => {
      if (!request.complete) {
        onInterrupted()
      }
    }

    request.on('data', onData)
    request.on('end', onEnd)
    request.on('error', onError)
    request.on('aborted', onInterrupted)
    request.on('close', onClose)
  })
}

export async function readAdminJsonBody(event: H3Event): Promise<unknown> {
  const contentLength = Number(event.node.req.headers['content-length'])
  if (Number.isFinite(contentLength) && contentLength > ADMIN_JSON_BODY_MAX_BYTES) {
    throw bodyError(413)
  }

  const raw = await readLimitedRawBody(event)
  if (!raw) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Request body is invalid.',
    )
  }

  try {
    return JSON.parse(raw) as unknown
  }
  catch {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Request body is invalid.',
    )
  }
}
