const REDACTED = '[REDACTED]'
const sensitiveKey = /(?:authorization|cookie|headers?|request.?body|body|session|token|secret|password|username|access.?key|signature|signed.?url|contact|email|phone|consent|deposit|payment|object.?key|original.?url)/i
const urlPattern = /https?:\/\/[^\s"'<>]+/g
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const privateObjectPathPattern = /\b(?:dev|test|prod)\/(?:original|draft|temp|preview)\/[^\s"'<>]+/gi
const sensitiveAssignmentPattern = /((?:["']?)(?:authorization|cookie|session|token|secret|password|access[\s_.-]?key(?:[\s_.-]?(?:id|secret))?|signature|signed[\s_.-]?url|owner[\s_.-]?contact|contact|email|phone|consent[\s_.-]?note|object[\s_.-]?key|original[\s_.-]?(?:key|url))(?:["']?)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi

function redactUrls(value: string) {
  return value.replace(urlPattern, (candidate) => {
    try {
      const url = new URL(candidate)
      const isSensitive = (
        url.username
        || url.password
        || url.search
        || url.hash
        || /\/(?:original|draft|temp|preview)\//i.test(url.pathname)
      )

      return isSensitive
        ? `${url.origin}/${REDACTED}`
        : `${url.origin}${url.pathname}`
    }
    catch {
      return REDACTED
    }
  })
}

export function redactLogText(value: string) {
  return redactUrls(value)
    .replace(bearerPattern, `Bearer ${REDACTED}`)
    .replace(sensitiveAssignmentPattern, `$1${REDACTED}`)
    .replace(emailPattern, REDACTED)
    .replace(privateObjectPathPattern, REDACTED)
}

export function redactLogValue(value: unknown, key = ''): unknown {
  if (sensitiveKey.test(key)) {
    return REDACTED
  }

  if (typeof value === 'string') {
    return redactLogText(value)
  }

  if (Array.isArray(value)) {
    return value.map(item => redactLogValue(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([entryKey, entryValue]) => [
          entryKey,
          redactLogValue(entryValue, entryKey),
        ]),
    )
  }

  return value
}

export function safeLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  context: Readonly<Record<string, unknown>> = {},
) {
  console[level](
    redactLogText(message),
    JSON.stringify(redactLogValue(context)),
  )
}
