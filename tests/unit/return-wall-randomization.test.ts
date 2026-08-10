import { describe, expect, it } from 'vitest'
import {
  returnWallSeed,
  shuffledReturnPhotoIds,
} from '../../server/utils/repository/public-return-repository'
import { returnWallSeedSchema } from '../../shared/schemas/return-photo'

describe('返图墙按页面请求随机', () => {
  it('creates a validated 128-bit seed for each request', () => {
    const first = returnWallSeed(Buffer.alloc(16, 0x11))
    const second = returnWallSeed(Buffer.alloc(16, 0x22))

    expect(first).toBe('11'.repeat(16))
    expect(second).toBe('22'.repeat(16))
    expect(first).not.toBe(second)
    expect(returnWallSeedSchema.parse(first)).toBe(first)
    expect(() => returnWallSeed(Buffer.alloc(15))).toThrow(/16 bytes/u)
  })

  it('keeps one seed stable across pages without repeating items', () => {
    const ids = Array.from({ length: 60 }, (_, index) => `photo-${index}`)
    const firstOrder = shuffledReturnPhotoIds(ids, '11'.repeat(16))
    const secondOrder = shuffledReturnPhotoIds(ids, '22'.repeat(16))
    const firstPage = firstOrder.slice(0, 24)
    const secondPage = firstOrder.slice(24, 48)

    expect(firstOrder).not.toEqual(secondOrder)
    expect(new Set([...firstPage, ...secondPage]).size).toBe(48)
  })
})
