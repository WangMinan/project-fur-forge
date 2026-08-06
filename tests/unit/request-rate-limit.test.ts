import {
  describe,
  expect,
  it,
} from 'vitest'
import { createFixedWindowLimiter } from '../../server/utils/route/request-rate-limit'

describe('request rate limits', () => {
  it('allows a fixed quota, reports retry time, then resets', () => {
    const consume = createFixedWindowLimiter(2, 1_000)

    expect(consume(1_000)).toBe(0)
    expect(consume(1_001)).toBe(0)
    expect(consume(1_500)).toBe(1)
    expect(consume(2_000)).toBe(0)
  })
})
