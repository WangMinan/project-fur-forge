/**
 * 公开列表页码只接受正整数。非法、空值和数组查询统一收敛为第 1 页，
 * 与服务端公开投影保持相同的安全行为。
 */
export function publicPageFromQuery(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10_000
    ? parsed
    : 1
}

/**
 * 生成可 SSR、可重载的公开分页地址。第一页不保留 page 参数；
 * 其他查询参数由页面显式传入，因此不会意外携带未知或私有字段。
 */
export function publicPageHref(
  path: string,
  query: Readonly<Record<string, string | null | undefined>>,
  page: number,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value)
    }
  }
  if (page > 1) {
    params.set('page', String(page))
  }
  const suffix = params.toString()
  return suffix ? `${path}?${suffix}` : path
}
