import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
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

export interface SeedWork {
  slug: `e2e-public-${string}`
  characterName: string
  species?: string
  suitType?: 'full' | 'partial'
  purpose?: 'commission' | 'showcase' | 'adoption'
  ownerDisplay?: string
  featureTags?: string[]
  featured?: boolean
  sortOrder?: number
  publicationStatus?: 'draft' | 'published'
  adoptionMethod?: 'regular' | 'event_drop'
  businessStatus?: 'preparing' | 'available' | 'event_sale' | 'scheduled' | 'in_production' | 'delivered'
  currentEventName?: string
  priceMinorUnits?: number
  photos: [SeedWorkPhoto, ...SeedWorkPhoto[]]
}

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
  expect(response.ok(), 'E2E fake 控制端点应可用').toBeTruthy()
  return response.json()
}

export async function seedPublicCatalog(page: Page, works: SeedWork[]) {
  await control(page, { action: 'seedPublicCatalog', works })
}

export async function seedHomeSlides(
  page: Page,
  slides: SeedHomeSlide[],
  settings?: SeedHomeSettings,
) {
  await control(page, { action: 'seedHomeSlides', slides, settings })
}
