import { getPublicSiteRepository } from '../utils/repository/public-site-repository'
import { getRuntimeConfig } from '../utils/runtime-config'

/**
 * `/returns` 作为一级页面进入 Sitemap。单张返图没有自己的 URL；
 * 设定返图页 `/returns/{slug}` 也不逐条枚举，返图墙已是它们的入口。
 */
const STATIC_PATHS = [
  '/',
  '/works',
  '/returns',
  '/commission',
  '/adoptions',
  '/about',
  '/service',
  '/privacy',
  '/licenses',
] as const

export default defineEventHandler((event) => {
  const repository = getPublicSiteRepository()
  const workPaths = [
    ...repository.listWorks().items,
    ...repository.listAdoptions().items,
  ].map(item => item.href)
  const paths = [...new Set([...STATIC_PATHS, ...workPaths])]
  const { publicBaseUrl } = getRuntimeConfig()

  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map(path => `  <url><loc>${new URL(path, publicBaseUrl).href}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n')
})
