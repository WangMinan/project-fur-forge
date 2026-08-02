import { describe, expect, it } from 'vitest'
import {
  clampSlideIndex,
  HERO_MIN_AUTOPLAY_INTERVAL_MS,
  nextSlideIndex,
  prevSlideIndex,
  resolveAutoplayIntervalMs,
  resolveSwipeDirection,
} from '../../app/utils/hero-carousel'

describe('hero carousel pure logic', () => {
  it('wraps next/prev around both ends', () => {
    expect(nextSlideIndex(0, 3)).toBe(1)
    expect(nextSlideIndex(2, 3)).toBe(0)
    expect(prevSlideIndex(0, 3)).toBe(2)
    expect(prevSlideIndex(2, 3)).toBe(1)
  })

  it('stays at 0 for empty or single slide decks', () => {
    expect(nextSlideIndex(0, 0)).toBe(0)
    expect(prevSlideIndex(0, 0)).toBe(0)
    expect(nextSlideIndex(0, 1)).toBe(0)
    expect(prevSlideIndex(0, 1)).toBe(0)
  })

  it('clamps out-of-range indexes after deck shrink', () => {
    expect(clampSlideIndex(4, 3)).toBe(2)
    expect(clampSlideIndex(0, 0)).toBe(0)
    expect(clampSlideIndex(-1, 2)).toBe(0)
    expect(clampSlideIndex(1, 3)).toBe(1)
  })

  it('disables autoplay when autoRotate is off or reduced-motion is requested', () => {
    expect(resolveAutoplayIntervalMs(false, 8_000, false)).toBeNull()
    expect(resolveAutoplayIntervalMs(true, 8_000, true)).toBeNull()
    expect(resolveAutoplayIntervalMs(true, 8_000, false)).toBe(8_000)
  })

  it('never returns an interval below the 6s floor', () => {
    expect(resolveAutoplayIntervalMs(true, 3_000, false)).toBe(
      HERO_MIN_AUTOPLAY_INTERVAL_MS,
    )
  })

  it('requires a clear swipe before changing slides', () => {
    expect(resolveSwipeDirection(10)).toBeNull()
    expect(resolveSwipeDirection(-39)).toBeNull()
    expect(resolveSwipeDirection(41)).toBe('prev')
    expect(resolveSwipeDirection(-41)).toBe('next')
  })
})
