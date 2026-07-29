import { apiErrorSchema } from '../shared/schemas/api'

function defaultErrorCode(statusCode: number) {
  if (statusCode === 400 || statusCode === 422) {
    return 'VALIDATION_ERROR' as const
  }

  if (statusCode === 401) {
    return 'UNAUTHORIZED' as const
  }

  if (statusCode === 403) {
    return 'FORBIDDEN' as const
  }

  if (statusCode === 404) {
    return 'NOT_FOUND' as const
  }

  if (statusCode === 409) {
    return 'CONFLICT' as const
  }

  return 'INTERNAL_ERROR' as const
}

function defaultErrorMessage(statusCode: number) {
  if (statusCode === 404) {
    return 'Resource was not found.'
  }

  if (statusCode >= 500) {
    return 'Internal server error.'
  }

  return 'Request was rejected.'
}

export default defineNitroErrorHandler(async (
  error,
  event,
  { defaultHandler },
) => {
  const fallback = await defaultHandler(error, event, { silent: true })
  const data = error.data && typeof error.data === 'object'
    ? error.data as Record<string, unknown>
    : {}
  const parsedCode = typeof data.code === 'string'
    ? apiErrorSchema.shape.error.shape.code.safeParse(data.code)
    : undefined
  const code = parsedCode?.success
    ? parsedCode.data
    : defaultErrorCode(fallback.status)
  const message = (
    fallback.status < 500
    && typeof data.publicMessage === 'string'
  )
    ? data.publicMessage
    : defaultErrorMessage(fallback.status)
  const body = apiErrorSchema.parse({
    error: {
      code,
      message,
    },
  })

  setResponseHeaders(event, fallback.headers)
  setResponseStatus(event, fallback.status, fallback.statusText)

  return send(event, JSON.stringify(body))
})
