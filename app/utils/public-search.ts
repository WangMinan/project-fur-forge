import { publicCatalogSearchQuerySchema } from '~~/shared/schemas/public-content'

export function publicSearchFromQuery(value: unknown) {
  const parsed = publicCatalogSearchQuerySchema.safeParse(value)
  return {
    active: value !== undefined && (!parsed.success || parsed.data !== undefined),
    query: parsed.success ? parsed.data ?? '' : '',
    valid: parsed.success,
  }
}
