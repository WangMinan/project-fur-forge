import type { ErrorCode } from '../../shared/types/contracts'
import { createApiError } from './api-error'

export class ServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    readonly publicMessage: string,
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
