import type { Page } from '@playwright/test'
import type { HeroPlacement } from '../../../shared/types/contracts'
import { adminBaseURL } from './auth'

/**
 * T19/T20 公开页种子：经 E2E 控制面直接落库（已发布作品 + 出厂照 +
 * 当前活动 profile 的公开 variant），公开页面读取真实公开投影。
 * slug 必须以 e2e-public- 开头，便于控制面自清理上一轮数据。
 */
export interface SeedWorkPhoto {
  alt: string
  width?: number
  height?: number
}

interface SeedWorkCommon {
  slug: `e2e-public-${string}`
  characterName: string
  species?: string
  suitType?: 'full' | 'partial'
  ownerDisplay?: string
  featureTags?: string[]
  featured?: boolean
  sortOrder?: number
  businessStatus?: 'preparing' | 'available' | 'event_sale' | 'scheduled' | 'in_production' | 'delivered'
  priceMinorUnits?: number
  designSheet?: SeedWorkPhoto
  photos: SeedWorkPhoto[]
}

/**
 * 已发布的展会掉落必须同时提供展会名称与时间。把数据库约束映射到种子类型，
 * 避免夹具缺字段时等到 SQLite INSERT 才以不透明的 500 失败。
 */
export type SeedWork = SeedWorkCommon & (
  | {
    purpose: 'adoption'
    adoptionMethod: 'event_drop'
    publicationStatus?: 'published'
    eventName: string
    eventTime: string
  }
  | {
    purpose: 'adoption'
    adoptionMethod: 'event_drop'
    publicationStatus: 'draft'
    eventName?: string
    eventTime?: string
  }
  | {
    purpose?: 'commission' | 'showcase' | 'adoption'
    adoptionMethod?: 'regular'
    publicationStatus?: 'draft' | 'published'
    eventName?: never
    eventTime?: never
  }
)

export interface SeedHomeSlide {
  alt: string
  sortOrder: number
  enabled: boolean
  linkedWorkSlug?: string | null
  landscapeWidth?: number
  landscapeHeight?: number
  portraitWidth?: number
  portraitHeight?: number
}

export interface SeedHomeSettings {
  tagline?: string
  contactEmail?: string
  contactQq?: string
  autoRotate?: boolean
  autoRotateIntervalMs?: number
}

async function control(page: Page, body: Record<string, unknown>) {
  const response = await page.request.post(
    `${adminBaseURL}/api/e2e-fake-media-control`,
    { data: body },
  )
  if (!response.ok()) {
    throw new Error(`E2E fake 控制端点返回 ${response.status()}：${await response.text()}`)
  }
  return response.json()
}

export async function seedPublicCatalog(page: Page, works: SeedWork[]) {
  await control(page, { action: 'seedPublicCatalog', works })
}

export async function seedHomeSlides(
  page: Page,
  slides: SeedHomeSlide[],
  settings?: SeedHomeSettings,
  placement: HeroPlacement = 'home',
) {
  await control(page, { action: 'seedHomeSlides', placement, slides, settings })
}

export async function seedHeroCollections(
  page: Page,
  input: {
    landscape: SeedHomeSlide[]
    placement?: HeroPlacement
    portrait: SeedHomeSlide[]
    settings?: SeedHomeSettings
  },
) {
  await control(page, {
    action: 'seedHomeSlides',
    placement: input.placement ?? 'home',
    landscapeSlides: input.landscape,
    portraitSlides: input.portrait,
    settings: input.settings,
  })
}
