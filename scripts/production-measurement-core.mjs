const CACHE_HEADER_NAMES = [
  'age',
  'cache-control',
  'content-length',
  'etag',
  'last-modified',
  'server',
  'via',
  'x-cache',
  'x-cache-status',
  'x-esa-cache',
]

export function parseMeasurementTarget(input) {
  const separator = input.indexOf('=')
  if (separator < 1) {
    throw new Error('Each --target must use name=https://host/path syntax.')
  }
  const name = input.slice(0, separator)
  const rawUrl = input.slice(separator + 1)
  if (!/^[a-z][a-z0-9-]{0,39}$/u.test(name)) {
    throw new Error(`Measurement target name ${name || '<empty>'} is invalid.`)
  }
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(`Measurement target ${name} must be credential-free HTTPS without query or fragment.`)
  }
  if (url.port && url.port !== '443') {
    throw new Error(`Measurement target ${name} must use the public HTTPS port.`)
  }
  return { name, url }
}

export function selectEvidenceHeaders(headers) {
  return Object.fromEntries(CACHE_HEADER_NAMES.flatMap((name) => {
    const value = headers.get(name)
    return value === null ? [] : [[name, value]]
  }))
}

/**
 * 基线命令可以保留失败响应的脱敏证据，但不能把错误路由或错误边缘跳转
 * 宣称为 PASS。返回稳定、无响应正文的失败摘要供 CLI 在写完 artifact 后
 * 以非零状态退出。
 */
export function measurementTargetFailures(targets) {
  const failures = []
  for (const target of targets) {
    for (const observation of target.observations) {
      if (observation.ok !== true) {
        failures.push(
          `${target.name} round ${observation.round} returned HTTP ${observation.status}`,
        )
      }
    }
    if (target.httpsRedirect?.exactHttpsRedirect !== true) {
      failures.push(`${target.name} did not preserve an exact HTTP-to-HTTPS redirect`)
    }
  }
  return failures
}

export function percentile(values, quantile) {
  if (!values.length) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)
  return Math.round(sorted[index] * 100) / 100
}

export function summarizeLoadProbe(samples, startedAtMs, finishedAtMs) {
  if (!samples.length) {
    return null
  }
  const buckets = new Map()
  for (const sample of samples) {
    const bucket = Math.floor((sample.completedAtMs - startedAtMs) / 1000)
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
  }
  const durationMs = Math.max(1, finishedAtMs - startedAtMs)
  const durations = samples.map(sample => sample.durationMs)
  return {
    requestCount: samples.length,
    successCount: samples.filter(sample => sample.ok).length,
    durationMs: Math.round(durationMs * 100) / 100,
    averageRequestsPerSecond: Math.round((samples.length * 100000) / durationMs) / 100,
    peakCompletedRequestsInOneSecond: Math.max(...buckets.values()),
    latencyP50Ms: percentile(durations, 0.5),
    latencyP95Ms: percentile(durations, 0.95),
  }
}

export function validateLoadProbeOptions(input) {
  if (!Number.isInteger(input.requests) || input.requests < 0 || input.requests > 100) {
    throw new Error('--load-requests must be an integer between 0 and 100.')
  }
  if (!Number.isInteger(input.concurrency) || input.concurrency < 1 || input.concurrency > 10) {
    throw new Error('--load-concurrency must be an integer between 1 and 10.')
  }
  if (input.requests > 0 && input.allow !== true) {
    throw new Error('A load probe requires explicit --allow-load-probe authorization.')
  }
  if (input.requests === 0 && input.allow === true) {
    throw new Error('--allow-load-probe has no effect without --load-requests.')
  }
  return input
}
