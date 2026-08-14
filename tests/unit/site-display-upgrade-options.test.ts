import {
  describe,
  expect,
  it,
} from 'vitest'
import { parseSiteDisplayUpgradeArgs } from '../../scripts/site-display-upgrade-options'

describe('site display upgrade CLI options', () => {
  it('defaults to a safe all-scope dry-run', () => {
    expect(parseSiteDisplayUpgradeArgs([])).toEqual({
      dryRun: true,
      scope: 'all',
    })
  })

  it('passes pnpm separator, scope and explicit write confirmation through', () => {
    expect(parseSiteDisplayUpgradeArgs([
      '--',
      '--scope',
      'home-hero',
      '--no-dry-run',
    ])).toEqual({
      dryRun: false,
      scope: 'home-hero',
    })
  })

  it('rejects an unknown deployment scope', () => {
    expect(() => parseSiteDisplayUpgradeArgs(['--scope', 'unknown']))
      .toThrow(/--scope must be one of/)
  })
})
