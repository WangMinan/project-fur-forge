import { describe, expect, it } from 'vitest'
import {
  parseMeasurementTarget,
  selectEvidenceHeaders,
  summarizeLoadProbe,
  validateLoadProbeOptions,
} from '../../scripts/production-measurement-core.mjs'

describe('T52-E5 production measurement', () => {
  it('accepts exact credential-free HTTPS targets and rejects unsafe inputs', () => {
    expect(parseMeasurementTarget('public-home=https://ditedog.com/')).toMatchObject({
      name: 'public-home',
    })
    for (const unsafe of [
      'home=http://ditedog.com/',
      'home=https://user:secret@ditedog.com/',
      'home=https://ditedog.com/?token=secret',
      'home=https://ditedog.com/#fragment',
      'home=https://ditedog.com:8443/',
    ]) {
      expect(() => parseMeasurementTarget(unsafe)).toThrow(/HTTPS|public HTTPS/u)
    }
  })

  it('only retains allowlisted cache evidence headers', () => {
    const headers = new Headers({
      'cache-control': 'public, max-age=60',
      'set-cookie': 'private=value',
      'x-cache': 'HIT',
    })
    expect(selectEvidenceHeaders(headers)).toEqual({
      'cache-control': 'public, max-age=60',
      'x-cache': 'HIT',
    })
  })

  it('requires explicit authorization and caps a load probe', () => {
    expect(validateLoadProbeOptions({ allow: false, concurrency: 1, requests: 0 })).toBeTruthy()
    expect(() => validateLoadProbeOptions({ allow: false, concurrency: 2, requests: 10 })).toThrow(/explicit/u)
    expect(() => validateLoadProbeOptions({ allow: true, concurrency: 11, requests: 10 })).toThrow(/between 1 and 10/u)
    expect(() => validateLoadProbeOptions({ allow: true, concurrency: 2, requests: 101 })).toThrow(/between 0 and 100/u)
  })

  it('summarizes measured latency and peak completed requests without inventing a threshold', () => {
    expect(summarizeLoadProbe([
      { completedAtMs: 120, durationMs: 20, ok: true },
      { completedAtMs: 180, durationMs: 60, ok: true },
      { completedAtMs: 1120, durationMs: 100, ok: false },
    ], 100, 1200)).toEqual({
      requestCount: 3,
      successCount: 2,
      durationMs: 1100,
      averageRequestsPerSecond: 2.73,
      peakCompletedRequestsInOneSecond: 2,
      latencyP50Ms: 60,
      latencyP95Ms: 100,
    })
  })
})
