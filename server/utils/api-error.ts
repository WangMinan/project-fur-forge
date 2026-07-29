import type { ErrorCode } from '../../shared/types/contracts'

export function createApiError(
  statusCode: number,
  code: ErrorCode,
  message: string,
) {
  return createError({
    statusCode,
    data: {
      code,
      publicMessage: message,
    },
  })
}
