/**
 * 首页轮播共用的纯逻辑：索引回绕、触控判定与方向动画。
 */

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

/** 触控/指针滑动超过阈值才翻页；向右滑（正位移）回上一张。 */
export function resolveSwipeDirection(
  deltaX: number,
  deltaY = 0,
  thresholdPx = 40,
  dominanceRatio = 1.2,
): 'prev' | 'next' | null {
  if (
    Math.abs(deltaX) < thresholdPx
    || Math.abs(deltaX) < Math.abs(deltaY) * dominanceRatio
  ) {
    return null
  }
  return deltaX > 0 ? 'prev' : 'next'
}

interface DirectionalAnimationLayer {
  delay: number
  distance: number
  duration: number
  element: HTMLElement | null
}

export function animateDirectionalLayers(
  layers: readonly DirectionalAnimationLayer[],
  direction: -1 | 1,
  easing: string,
): Animation[] {
  const animations = layers.flatMap(layer => layer.element
    ? [layer.element.animate(
        [
          { opacity: 0.001, transform: `translate3d(${direction * layer.distance}px, 0, 0)` },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
        ],
        {
          delay: layer.delay,
          duration: layer.duration,
          easing,
          fill: 'both',
        },
      )]
    : [])
  for (const animation of animations) {
    animation.finished
      .then(() => animation.cancel())
      .catch(() => undefined)
  }
  return animations
}
