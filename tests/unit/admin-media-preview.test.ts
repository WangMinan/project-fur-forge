import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  ADMIN_MEDIA_CARD_PREVIEW_WIDTH,
  ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH,
} from '../../shared/constants/admin-media-preview'
import {
  adminMediaOriginalUrl,
  adminMediaPreviewUrl,
} from '../../app/utils/admin-media-preview'
import { parseAdminMediaPreviewQuery } from '../../server/utils/route/admin-media-preview'

describe('admin private media preview contract', () => {
  it('builds the fixed card/editor URLs and a separate explicit original URL', () => {
    expect(adminMediaPreviewUrl('asset/id', ADMIN_MEDIA_CARD_PREVIEW_WIDTH))
      .toBe('/api/admin/v1/media/assets/asset%2Fid/preview?w=320')
    expect(adminMediaPreviewUrl('asset', ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH))
      .toBe('/api/admin/v1/media/assets/asset/preview?w=640')
    expect(adminMediaOriginalUrl('asset'))
      .toBe('/api/admin/v1/media/assets/asset/preview?original=1')
  })

  it('accepts only the two preview widths or explicit original mode', () => {
    expect(parseAdminMediaPreviewQuery({ w: '320' }))
      .toEqual({ mode: 'preview', width: 320 })
    expect(parseAdminMediaPreviewQuery({ w: '640' }))
      .toEqual({ mode: 'preview', width: 640 })
    expect(parseAdminMediaPreviewQuery({ original: '1' }))
      .toEqual({ mode: 'original' })
  })

  it.each([
    {},
    { w: '96' },
    { w: '0320' },
    { w: '640', original: '1' },
    { original: 'true' },
  ])('rejects ambiguous or unsupported input %#', (query) => {
    expect(() => parseAdminMediaPreviewQuery(query))
      .toThrow(/supported preview width|not supported/)
  })
})
