import type { ErrorCode, ErrorReason } from '../../shared/types/contracts'

export function createApiError(
  statusCode: number,
  code: ErrorCode,
  message: string,
  reason?: ErrorReason,
) {
  return createError({
    statusCode,
    data: {
      code,
      publicMessage: message,
      ...(reason ? { reason } : {}),
    },
  })
}
