import { randomUUID } from 'node:crypto'
import { apiErrorSchema } from '../shared/schemas/api'
import {
  isPrivateResponsePath,
  PRIVATE_RESPONSE_HEADERS,
} from './utils/private-response'
import { getRuntimeConfig } from './utils/runtime-config'
import { safeLog } from './utils/safe-log'

const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/

function isApiPath(pathname: string) {
  return pathname === '/api' || pathname.startsWith('/api/')
}

function supportsHtmlErrorPage(event: Parameters<Parameters<
  typeof defineNitroErrorHandler
>[0]>[1]) {
  const host = getRequestHost(event).toLowerCase()
  const config = getRuntimeConfig()

  return [config.publicBaseUrl, config.adminBaseUrl]
    .some(url => new URL(url).host.toLowerCase() === host)
}

function requestIdFor(event: Parameters<Parameters<
  typeof defineNitroErrorHandler
>[0]>[1]) {
  const incoming = getHeader(event, 'x-request-id')
  const requestId = incoming && requestIdPattern.test(incoming)
    ? incoming
    : randomUUID()

  setResponseHeader(event, 'x-request-id', requestId)
  return requestId
}

async function renderNuxtErrorPage(
  event: Parameters<Parameters<typeof defineNitroErrorHandler>[0]>[1],
  statusCode: number,
  requestId: string,
) {
  const statusMessage = statusCode === 404
    ? 'Page Not Found'
    : 'Internal Server Error'
  const query = new URLSearchParams({
    url: getRequestURL(event).pathname,
    status: String(statusCode),
    statusCode: String(statusCode),
    statusMessage,
    message: statusMessage,
  })
  const response = await useNitroApp().localFetch(
    `/__nuxt_error?${query}`,
    {
      headers: {
        accept: 'text/html',
        host: getRequestHost(event),
      },
    },
  )

  const headers = new Headers(response.headers)
  headers.set('cache-control', 'no-cache')
  headers.set('x-request-id', requestId)
  if (isPrivateResponsePath(getRequestURL(event).pathname)) {
    for (const [name, value] of Object.entries(PRIVATE_RESPONSE_HEADERS)) {
      headers.set(name, value)
    }
  }

  return sendWebResponse(event, new Response(response.body, {
    headers,
    status: statusCode,
    statusText: statusMessage,
  }))
}

function defaultErrorCode(statusCode: number) {
  if (
    statusCode === 400
    || statusCode === 413
    || statusCode === 422
  ) {
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

  if (statusCode === 429) {
    return 'RATE_LIMITED' as const
  }

  return 'INTERNAL_ERROR' as const
}

function defaultErrorMessage(statusCode: number) {
  if (statusCode === 404) {
    return 'Resource was not found.'
  }

  if (statusCode === 413) {
    return 'Request body is too large.'
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
  const pathname = getRequestURL(event).pathname
  const requestId = requestIdFor(event)
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
  // 稳定业务 reason 只在 4xx 透出；5xx 不泄漏内部分支。
  const parsedReason = fallback.status < 500 && typeof data.reason === 'string'
    ? apiErrorSchema.shape.error.shape.reason.safeParse(data.reason)
    : undefined
  const body = apiErrorSchema.parse({
    error: {
      code,
      ...(parsedReason?.success ? { reason: parsedReason.data } : {}),
      message,
    },
  })

  if (fallback.status >= 500) {
    safeLog('error', 'Server request failed.', {
      requestId,
      method: event.method,
      path: pathname,
      statusCode: fallback.status,
      errorCode: code,
      errorClassification: parsedCode?.success
        ? 'handled-server-error'
        : 'unhandled-server-error',
    })
  }

  if (!isApiPath(pathname) && supportsHtmlErrorPage(event)) {
    return renderNuxtErrorPage(event, fallback.status, requestId)
  }

  setResponseHeaders(event, fallback.headers)
  if (isPrivateResponsePath(pathname)) {
    setResponseHeaders(event, PRIVATE_RESPONSE_HEADERS)
  }
  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
  setResponseStatus(event, fallback.status, fallback.statusText)

  return send(event, JSON.stringify(body))
})
