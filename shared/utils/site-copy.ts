import type { PublicSiteCopy, SiteCopySection, SiteCopySections } from '../schemas/site-copy'
import { DEFAULT_SITE_LOCALE } from '../constants/site-locales'

/** Public studio copy uses the studio identity, including legacy saved text. */
export function publicStudioText(value: string | null) {
  return value?.replace(/景宸|弗朗/g, '工作室') ?? null
}

/** Null translations inherit Chinese; two empty values remain empty. */
export function localizedSiteCopy<S extends SiteCopySection>(
  copy: PublicSiteCopy | undefined, locale: string, section: S,
): Partial<SiteCopySections[S]> {
  const source = copy?.[DEFAULT_SITE_LOCALE]?.[section]
  const translated = copy?.[locale]?.[section]
  return { ...source, ...Object.fromEntries(Object.entries(translated ?? {}).filter(([, value]) => value !== null)) }
}
