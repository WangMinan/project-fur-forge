import type { ErrorCode, ErrorReason } from '../../shared/types/contracts'
import { createApiError } from './api-error'

export class ServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    readonly publicMessage: string,
    /**
     * T34-F4 稳定业务原因。前端业务分支只匹配这个值，
     * `publicMessage` 可以自由改写。
     */
    readonly reason?: ErrorReason,
  ) {
    super(publicMessage)
    this.name = 'ServiceError'
  }
}

export function asApiError(error: unknown): never {
  if (error instanceof ServiceError) {
    throw createApiError(
      error.statusCode,
      error.code,
      error.publicMessage,
      error.reason,
    )
  }

  throw error
}

export function asSafeApiError(error: unknown): never {
  if (error instanceof ServiceError) {
    asApiError(error)
  }
  throw createApiError(500, 'INTERNAL_ERROR', 'Service is unavailable.')
}
