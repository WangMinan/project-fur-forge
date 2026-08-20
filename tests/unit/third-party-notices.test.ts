import { describe, expect, it } from 'vitest'
import {
  buildThirdPartyNotices,
  renderThirdPartyNoticesText,
} from '../../scripts/third-party-notices.mjs'

describe('third-party notice generation', () => {
  it('splits exact package versions, removes local paths, hashes assets, and sorts stably', () => {
    const notices = buildThirdPartyNotices({
      licenseReport: {
        MIT: [{
          name: 'z-package',
          versions: ['2.0.0', '1.0.0'],
          paths: ['C:\\private\\node_modules\\z-package'],
          license: 'MIT',
          homepage: 'https://example.test/z',
        }],
      },
      manualAssets: [{
        name: 'A Font',
        version: 'repository-asset',
        license: 'OFL-1.1',
        homepage: 'https://example.test/font',
        assetPath: 'font.otf',
        usage: 'test font',
        noticeText: 'OFL',
      }],
      readAsset: () => Buffer.from('font bytes'),
    })
    expect(notices.map(item => `${item.name}@${item.version}`)).toEqual([
      'A Font@repository-asset',
      'z-package@1.0.0',
      'z-package@2.0.0',
    ])
    expect(notices[0]!.artifactSha256).toMatch(/^[0-9a-f]{64}$/u)
    expect(JSON.stringify(notices)).not.toContain('C:\\private')
    expect(renderThirdPartyNoticesText(notices)).toContain('No Linux FFmpeg runtime-binary')
  })

  it('fails instead of guessing an unknown license', () => {
    expect(() => buildThirdPartyNotices({
      licenseReport: {
        UNKNOWN: [{ name: 'mystery', versions: ['1.0.0'], paths: [] }],
      },
      manualAssets: [],
      readAsset: () => Buffer.alloc(0),
    })).toThrow(/Unknown license/u)
  })
})
