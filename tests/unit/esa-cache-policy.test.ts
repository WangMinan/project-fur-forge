import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateEsaCachePolicy } from '../../scripts/esa-cache-policy-core.mjs'

function baseline() {
  return JSON.parse(readFileSync(
    resolve('deploy/esa/cache-policy.json'),
    'utf8',
  )) as unknown
}

describe('T52-E4 ESA cache policy', () => {
  it('freezes bypass, immutable, query, 404, and stale behavior', () => {
    expect(() => validateEsaCachePolicy(baseline())).not.toThrow()
  })

  it('rejects stale media and cached SSR drift', () => {
    const policy = structuredClone(baseline()) as {
      rules: Array<Record<string, unknown>>
    }
    const media = policy.rules.find(rule => rule.id === 'public-media-immutable')!
    media.serveStaleOnOriginError = true
    expect(() => validateEsaCachePolicy(policy)).toThrow(/immutable cache rule/u)

    const html = policy.rules.find(rule => rule.id === 'public-ssr-html-bypass')!
    html.edgeCache = 'cache'
    expect(() => validateEsaCachePolicy(policy)).toThrow(/must bypass/u)
  })
})
