import type Database from 'better-sqlite3'
import {
  publicCommissionHeroDtoSchema,
  publicHomeDtoSchema,
} from '../../../shared/schemas/home'
import type {
  HeroPlacement,
  HomeEntryKind,
  PublicCommissionHeroDto,
  PublicHomeDto,
} from '../../../shared/types/contracts'
import {
  findHeroItems,
  findHeroItemVariants,
} from '../repository/hero-collection-repository'
import { toPublicHeroItemDto } from '../recipe/media-mapper'
import type { RuntimeConfig } from '../runtime-config'
import { ServiceError } from '../service-error'
import {
  homeEntrySource,
  projectHomeEntry,
} from '../service/site-entry'

interface HomeRow {
  autoRotate: number
  autoRotateIntervalMs: number
  contactEmail: string
  contactQq: string
  tagline: string
}

function requireHome(sqlite: Database.Database) {
  const row = sqlite.prepare(`
    SELECT
      hero_tagline AS tagline,
      contact_email AS contactEmail,
      contact_qq AS contactQq,
      hero_auto_rotate AS autoRotate,
      hero_auto_rotate_interval_ms AS autoRotateIntervalMs
    FROM site_content WHERE id = 'site'
  `).get() as HomeRow | undefined
  if (!row || !row.tagline || !row.contactEmail || !row.contactQq) {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Home settings are unavailable.')
  }
  return row
}

export function getPublicHomeEntries(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
) {
  const entry = (kind: HomeEntryKind) => {
    const source = homeEntrySource(sqlite, kind)
    const variants = source
      ? findHeroItemVariants(sqlite, [source.assetId]).get(source.assetId) ?? []
      : []
    return projectHomeEntry(kind, source, variants, mediaBaseUrl, appEnv)
  }
  return {
    commission: entry('commission'),
    adoption: entry('adoption'),
  }
}

function publicHeroPlacement(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  placement: HeroPlacement,
  appEnv: RuntimeConfig['appEnv'],
) {
  const orientationItems = (orientation: 'landscape' | 'portrait') => {
    const items = findHeroItems(sqlite, placement, orientation)
      .filter(item => item.enabled === 1)
    const variants = findHeroItemVariants(
      sqlite,
      items.map(item => item.assetId),
    )
    return items.map(item => toPublicHeroItemDto({
      altText: item.alt,
      orientation,
      placement,
      sortOrder: item.sortOrder,
      variants: [...(variants.get(item.assetId) ?? [])],
    }, mediaBaseUrl, appEnv))
  }
  return {
    landscape: orientationItems('landscape'),
    portrait: orientationItems('portrait'),
  }
}

export function getPublicHome(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicHomeDto {
  const home = requireHome(sqlite)
  return publicHomeDtoSchema.parse({
    tagline: home.tagline,
    contactEmail: home.contactEmail,
    contactQq: home.contactQq,
    autoRotate: home.autoRotate === 1,
    autoRotateIntervalMs: home.autoRotateIntervalMs,
    ...publicHeroPlacement(sqlite, mediaBaseUrl, 'home', appEnv),
    entries: getPublicHomeEntries(sqlite, mediaBaseUrl, appEnv),
  })
}

export function getPublicCommissionHero(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicCommissionHeroDto {
  return publicCommissionHeroDtoSchema.parse(
    publicHeroPlacement(sqlite, mediaBaseUrl, 'commission', appEnv),
  )
}
