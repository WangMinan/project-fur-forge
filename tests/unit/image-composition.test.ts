import { describe, expect, it } from 'vitest'
import { imageCompositionsSchema } from '../../shared/schemas/image-composition'
import { compositionError, defaultComposition, fitCrop, pixelCrop } from '../../shared/utils/image-composition'

describe('image composition geometry', () => {
  it('fits normalized rectangles using source pixels and keeps all edges in bounds', () => {
    for (const [width, height] of [[3200, 1800], [1800, 3200], [4033, 3025], [64, 64]]) {
      for (const ratio of [1, 4 / 5, 3 / 4]) {
        const rect = fitCrop(width!, height!, ratio)
        expect(rect.x + rect.width).toBeLessThanOrEqual(1)
        expect(rect.y + rect.height).toBeLessThanOrEqual(1)
        expect(rect.width * width! / (rect.height * height!)).toBeCloseTo(ratio)
        const pixels = pixelCrop(rect, width!, height!)
        expect(pixels.x + pixels.width).toBeLessThanOrEqual(width!)
        expect(pixels.y + pixels.height).toBeLessThanOrEqual(height!)
      }
    }
  })
  it('rejects invalid roles, modes, ratios and out-of-bounds payloads', () => {
    expect(imageCompositionsSchema.safeParse({ 'detail-thumbnail': { mode: 'crop', rect: { x: 0.9, y: 0, width: 0.2, height: 1 } } }).success).toBe(false)
    expect(imageCompositionsSchema.safeParse({ 'home-hero': { mode: 'contain' } }).success).toBe(false)
    expect(compositionError('commission_design_reference', 'detail-thumbnail', { mode: 'contain' }, 100, 100)).not.toBeNull()
    expect(compositionError('studio_photo', 'detail-thumbnail', { mode: 'contain' }, 100, 100)).not.toBeNull()
    expect(compositionError('studio_photo', 'detail-thumbnail', { mode: 'crop', rect: { x: 0, y: 0, width: 1, height: 1 } }, 100, 200)).not.toBeNull()
    expect(compositionError('studio_photo', 'detail-thumbnail', { mode: 'crop', rect: { x: 0, y: 0, width: 4 / 64, height: 6 / 64 } }, 64, 64)).toContain('比例')
    expect(compositionError('studio_photo', 'detail-thumbnail', { mode: 'crop', rect: { x: 0, y: 0, width: 20 / 4000, height: 20 / 3000 } }, 4000, 3000)).toContain('选区过小')
    expect(compositionError('design_sheet', 'adoption-catalog', { mode: 'crop', rect: { x: 0, y: 0, width: 0.14, height: 0.0004 } }, 4000, 4000)).toContain('选区过小')
    expect(defaultComposition('adoption_cover', 'work-catalog', 3200, 1800)).toEqual({ mode: 'contain' })
  })
})
