const REDACTED = '[REDACTED]'
const sensitiveKey = /(?:authorization|cookie|session|token|secret|password|access.?key|signature|signed.?url|contact|email|phone|deposit|payment|object.?key|original.?url)/i
const urlPattern = /https?:\/\/[^\s"'<>]+/g

function redactUrls(value: string) {
  return value.replace(urlPattern, (candidate) => {
    try {
      const url = new URL(candidate)
      const suffix = (
        url.username
        || url.password
        || url.search
        || url.hash
      )
        ? `?${REDACTED}`
        : ''

      return `${url.origin}${url.pathname}${suffix}`
    }
    catch {
      return REDACTED
    }
  })
}

export function redactLogValue(value: unknown, key = ''): unknown {
  if (sensitiveKey.test(key)) {
    return REDACTED
  }

  if (typeof value === 'string') {
    return redactUrls(value)
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
    redactUrls(message),
    JSON.stringify(redactLogValue(context)),
  )
}
