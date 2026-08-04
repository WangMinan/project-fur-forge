import { getRuntimeConfig } from '../utils/runtime-config'

export default defineEventHandler((event) => {
  const { publicBaseUrl } = getRuntimeConfig()
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    `Sitemap: ${new URL('/sitemap.xml', publicBaseUrl).href}`,
    '',
  ].join('\n')
})
