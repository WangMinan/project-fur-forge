/**
 * 首页双源轮播的纯逻辑：索引回绕、自动轮播门槛与触控判定。
 * 与 DOM/定时器解耦，供 HomeHeroCarousel 与单元测试共用。
 */

/**
 * 自动轮播固定 10 秒一张，且始终开启（不再是可配置项）。
 *
 * 唯一例外是 `prefers-reduced-motion`：那是无障碍要求，不是偏好设置。
 */
export const HERO_AUTOPLAY_INTERVAL_MS = 10_000

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
 * 自动轮播始终开启，只有用户要求减少动态时停止。
 * 返回 null 表示不得启动定时器。
 */
export function resolveAutoplayIntervalMs(
  reduceMotion: boolean,
): number | null {
  return reduceMotion ? null : HERO_AUTOPLAY_INTERVAL_MS
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
