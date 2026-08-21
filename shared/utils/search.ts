function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN')
}

export function includesSearchText(value: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query)
  return normalizedQuery === ''
    || normalizeSearchText(value).includes(normalizedQuery)
}
