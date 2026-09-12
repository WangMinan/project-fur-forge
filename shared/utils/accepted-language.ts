/** Keep acceptable language ranges; matching and priority remain the i18n module's job. */
export function acceptedLanguageHeader(value: string | undefined): string {
  if (!value || value.length > 512) return ''
  return value.split(',').filter((range) => {
    const match = /^\s*(?:[a-z]{1,8}(?:-[a-z0-9]{1,8})*|\*)(?:\s*;\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?\s*$/iu.exec(range)
    return match !== null && (match[1] === undefined || Number(match[1]) > 0)
  }).join(',')
}
