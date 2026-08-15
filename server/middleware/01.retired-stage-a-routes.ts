const retiredPrefixes = [
  '/admin/returns',
  '/admin/updates',
  '/api/admin/v1/returns',
  '/api/admin/v1/updates',
] as const

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname

  if (retiredPrefixes.some(prefix => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ))) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Page Not Found',
    })
  }
})
