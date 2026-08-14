export type FeaturedMove = 'bottom' | 'down' | 'top' | 'up'

export function moveFeaturedItem<T extends { id: string }>(
  items: readonly T[],
  id: string,
  direction: FeaturedMove,
) {
  const from = items.findIndex(item => item.id === id)
  if (from < 0) {
    return [...items]
  }
  const last = items.length - 1
  const to = direction === 'top'
    ? 0
    : direction === 'bottom'
      ? last
      : direction === 'up'
        ? Math.max(0, from - 1)
        : Math.min(last, from + 1)
  if (from === to) {
    return [...items]
  }
  const next = [...items]
  const [moved] = next.splice(from, 1)
  if (moved) {
    next.splice(to, 0, moved)
  }
  return next
}
