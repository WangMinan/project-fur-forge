/**
 * 首页双源轮播的纯逻辑：索引回绕、自动轮播门槛与触控判定。
 * 与 DOM/定时器解耦，供 HomeHeroCarousel 与单元测试共用。
 */

/** 交接契约：自动轮播间隔不得低于 6 秒（服务端 Schema 已保证，UI 再兜底）。 */
export const HERO_MIN_AUTOPLAY_INTERVAL_MS = 6_000

export function nextSlideIndex(current: number, count: number): number {
  if (count <= 0) {
    return 0
  }
  return (current + 1) % count
}

export function prevSlideIndex(current: number, count: number): number {
  if (count <= 0) {
    return 0
  }
  return (current - 1 + count) % count
}

/** 数据变化（如下架）后把当前索引收回合法范围。 */
export function clampSlideIndex(index: number, count: number): number {
  if (count <= 0) {
    return 0
  }
  return Math.min(Math.max(index, 0), count - 1)
}

/**
 * 自动轮播仅在设置开启且用户未要求减少动态时运行；
 * 返回 null 表示不得启动定时器。
 */
export function resolveAutoplayIntervalMs(
  autoRotate: boolean,
  intervalMs: number,
  reduceMotion: boolean,
): number | null {
  if (!autoRotate || reduceMotion) {
    return null
  }
  return Math.max(intervalMs, HERO_MIN_AUTOPLAY_INTERVAL_MS)
}

/** 触控/指针滑动超过阈值才翻页；向右滑（正位移）回上一张。 */
export function resolveSwipeDirection(
  deltaX: number,
  thresholdPx = 40,
): 'prev' | 'next' | null {
  if (Math.abs(deltaX) < thresholdPx) {
    return null
  }
  return deltaX > 0 ? 'prev' : 'next'
}
