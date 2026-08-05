import {
  defineEventHandler,
  readBody,
  setResponseStatus,
} from 'h3'
import {
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDatabase } from '../../../server/utils/database'
import { generatePublicVariants } from '../../../server/utils/media-recipe'
import {
  assetSupportsSiteDisplay,
  generateSiteDisplayVariants,
  HOME_ENTRY_USAGES,
  SITE_HERO_USAGES,
} from '../../../server/utils/site-display-recipe'
import { resetRequestRateLimits } from '../../../server/utils/request-rate-limit'
import { createSyntheticWatermarkPng } from '../../../scripts/oss-preflight-core.mjs'
import { getE2eFakeMediaStorage } from './e2e-fake-media'

interface ControlBody {
  action?: string
  flags?: Record<string, boolean>
  imageInfoOverride?: {
    key: string
    info: {
      fileSize: number
      format: string
      height: number
      orientation: number
      width: number
    }
  } | null
  works?: Array<{
    slug: string
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
    designSheet?: {
      alt: string
      width?: number
      height?: number
    }
    photos: Array<{
      alt: string
      width?: number
      height?: number
    }>
  }>
  slides?: Array<{
    alt: string
    sortOrder: number
    enabled: boolean
    linkedWorkSlug?: string | null
    landscapeWidth?: number
    landscapeHeight?: number
    portraitWidth?: number
    portraitHeight?: number
  }>
  settings?: {
    tagline?: string
    autoRotate?: boolean
    autoRotateIntervalMs?: number
    contactEmail?: string
    contactQq?: string
  }
  active?: boolean
  slideAlt?: string
}

let suspendedProfileId: string | null = null

const FLAG_KEYS = [
  'failDelete',
  'failGet',
  'failImageInfo',
  'failPut',
  'failProcess',
  'failSign',
  'omitSha256OnNextPut',
  'rejectNextPut403',
] as const

function restoreBundledWatermarkCandidate(
  fake: ReturnType<typeof getE2eFakeMediaStorage>,
) {
  const content = readFileSync(resolve('public/brand/logo-full-light.png'))
  const sha256 = createHash('sha256').update(content).digest('hex')
  const keys = getDatabase().sqlite.prepare(`
    SELECT private_object_key FROM assets
    WHERE role = 'watermark_logo' AND status = 'READY' AND sha256 = ?
  `).pluck().all(sha256) as string[]
  keys.forEach(key => fake.seedPrivate(key, content, 'image/png', sha256))
}

// E2E 控制面：查询内存 fake 状态、注入故障。只在 test 构建注册。
export default defineEventHandler(async (event) => {
  const body = await readBody<ControlBody>(event)
  const fake = getE2eFakeMediaStorage()

  if (body?.action === 'state') {
    return {
      data: {
        deletedPrivateKeys: [...fake.deletedPrivateKeys],
        deletedPublicKeys: [...fake.deletedPublicKeys],
        objects: [...fake.objects.keys()],
        processCalls: fake.processCalls.length,
        publicObjects: [...fake.publicObjects.keys()],
        putRecords: fake.putRecords.map(record => ({
          byteSize: record.byteSize,
          contentMd5: record.contentMd5,
          contentType: record.contentType,
          forbidOverwrite: record.forbidOverwrite,
          sha256Metadata: record.sha256Metadata,
        })),
      },
    }
  }

  if (body?.action === 'setFlags') {
    for (const key of FLAG_KEYS) {
      const value = body.flags?.[key]
      if (typeof value === 'boolean') {
        fake[key] = value
      }
    }
    if (body.imageInfoOverride) {
      fake.imageInfoOverrides.set(
        body.imageInfoOverride.key,
        body.imageInfoOverride.info,
      )
    }
    else if (body.imageInfoOverride === null) {
      fake.imageInfoOverrides.clear()
    }
    return { data: { ok: true } }
  }

  if (body?.action === 'reset') {
    fake.resetKnobs()
    restoreBundledWatermarkCandidate(fake)
    return { data: { ok: true } }
  }

  if (body?.action === 'resetRateLimits') {
    resetRequestRateLimits()
    return { data: { ok: true } }
  }

  // GATE-07 品牌页 E2E：预览/应用需要已发布作品照与启用的横竖首页图作为代表资产，
  // 并预生成当前活动 profile 的公开 variant（旧对象，供切换后清理）。
  // 首页轮播管理 API 属于 T20，这里直接落库 + fake 存储，不走被测接口。
  if (body?.action === 'seedBrandingStage') {
    const sqlite = getDatabase().sqlite
    const now = Date.now()
    const suffix = randomUUID()

    // 自清理：reset 会清空 fake 对象但保留 DB 行；上一轮的舞台资产对象已不存在，
    // 继续作为发布目标会让本轮生成失败。按 key 前缀移除旧舞台数据。
    const staleAssetIds = sqlite.prepare(`
      SELECT id FROM assets WHERE private_object_key LIKE 'test/e2e-branding/%'
    `).pluck().all() as string[]
    if (staleAssetIds.length > 0) {
      const placeholders = staleAssetIds.map(() => '?').join(', ')
      sqlite.prepare(`
        DELETE FROM site_hero_slides
        WHERE landscape_asset_id IN (${placeholders})
           OR portrait_asset_id IN (${placeholders})
      `).run(...staleAssetIds, ...staleAssetIds)
      sqlite.prepare(`
        DELETE FROM works WHERE slug LIKE 'e2e-branding-%'
      `).run()
      sqlite.prepare(`
        DELETE FROM asset_variants WHERE asset_id IN (${placeholders})
      `).run(...staleAssetIds)
      sqlite.prepare(`
        DELETE FROM work_assets WHERE asset_id IN (${placeholders})
      `).run(...staleAssetIds)
      sqlite.prepare(`
        DELETE FROM assets WHERE id IN (${placeholders})
      `).run(...staleAssetIds)
    }

    const insertSource = (id: string, role: string, width: number, height: number) => {
      const content = Buffer.concat([
        createSyntheticWatermarkPng() as Buffer,
        randomBytes(16),
      ])
      const sha256 = createHash('sha256').update(content).digest('hex')
      const objectKey = `test/e2e-branding/original/${id}/source.png`
      sqlite.prepare(`
        INSERT INTO assets (
          id, role, status, private_object_key, sha256, byte_size,
          mime_type, width, height, created_at, updated_at
        ) VALUES (?, ?, 'READY', ?, ?, ?, 'image/png', ?, ?, ?, ?)
      `).run(id, role, objectKey, sha256, content.length, width, height, now, now)
      fake.seedPrivate(objectKey, content, 'image/png', sha256, {
        fileSize: content.length,
        format: 'png',
        height,
        orientation: 1,
        width,
      })
    }

    const photoId = randomUUID()
    const landscapeId = randomUUID()
    const portraitId = randomUUID()
    insertSource(photoId, 'studio_photo', 3200, 2400)
    insertSource(landscapeId, 'home_hero_landscape', 3200, 1800)
    insertSource(portraitId, 'home_hero_portrait', 1800, 3200)
    const workId = randomUUID()
    sqlite.prepare(`
      INSERT INTO works (
        id, slug, character_name, species, suit_type, purpose,
        owner_display, publication_status, published_at, created_at, updated_at
      ) VALUES (?, ?, '品牌舞台', '犬科', 'full', 'showcase',
                '不公开', 'published', ?, ?, ?)
    `).run(workId, `e2e-branding-${suffix.slice(0, 8)}`, now, now, now)
    sqlite.prepare(`
      INSERT INTO work_assets (
        work_id, asset_id, role, alt_text, position, is_primary,
        crop_x, crop_y, crop_width, crop_height, watermark_anchor
      ) VALUES (?, ?, 'studio_photo', '品牌舞台出厂照', 0, 1,
                0, 0, 1, 1, 'top-left')
    `).run(workId, photoId)
    sqlite.prepare(`
      INSERT INTO site_hero_slides (
        id, landscape_asset_id, portrait_asset_id, alt_text,
        sort_order, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, '品牌舞台首页图', 0, 1, ?, ?)
    `).run(randomUUID(), landscapeId, portraitId, now, now)

    for (const assetId of [photoId, landscapeId, portraitId]) {
      await generatePublicVariants(sqlite, fake, assetId, undefined, now)
    }
    return { data: { ok: true } }
  }

  // T19/T20 公开页 E2E：种入已发布作品（含出厂照与当前活动 profile 的公开 variant）。
  // 直接落库 + fake 存储，不走被测接口。公开投影汇集全部已发布作品，
  // 因此清空 works 表保证目录确定（各管理套件均在自身用例内重建数据）。
  if (body?.action === 'seedPublicCatalog') {
    const sqlite = getDatabase().sqlite
    const now = Date.now()

    const staleAssetIds = sqlite.prepare(`
      SELECT id FROM assets WHERE private_object_key LIKE 'test/e2e-public/%'
    `).pluck().all() as string[]
    // work_assets / work_feature_tags 随 works 级联删除；
    // 关联作品的首页图 linked_work_id 由 FK 置空。
    sqlite.prepare('DELETE FROM works').run()
    if (staleAssetIds.length > 0) {
      const placeholders = staleAssetIds.map(() => '?').join(', ')
      sqlite.prepare(`
        DELETE FROM site_hero_slides
        WHERE landscape_asset_id IN (${placeholders})
           OR portrait_asset_id IN (${placeholders})
      `).run(...staleAssetIds, ...staleAssetIds)
      sqlite.prepare(`
        DELETE FROM asset_variants WHERE asset_id IN (${placeholders})
      `).run(...staleAssetIds)
      sqlite.prepare(`
        DELETE FROM assets WHERE id IN (${placeholders})
      `).run(...staleAssetIds)
    }

    const seeded: string[] = []
    for (const [index, work] of (body.works ?? []).entries()) {
      const purpose = work.purpose ?? 'showcase'
      const adoption = purpose === 'adoption'
      if (!work.slug.startsWith('e2e-public-')) {
        setResponseStatus(event, 400)
        return { error: 'seeded work slugs must start with e2e-public-' }
      }
      if (
        !work.photos
        || work.photos.length > 5
        || (
          work.photos.length === 0
          && !(adoption && work.adoptionMethod !== 'event_drop' && work.designSheet)
        )
      ) {
        setResponseStatus(event, 400)
        return { error: 'seeded works need valid role media' }
      }

      const workId = randomUUID()
      const publicationStatus = work.publicationStatus ?? 'published'
      sqlite.prepare(`
        INSERT INTO works (
          id, slug, character_name, species, suit_type, purpose,
          adoption_method, business_status, current_event_name,
          owner_display, price_amount_minor, price_currency,
          publication_status, sort_order, featured,
          published_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        workId,
        work.slug,
        work.characterName,
        work.species ?? '犬科',
        work.suitType ?? 'full',
        purpose,
        adoption ? (work.adoptionMethod ?? 'regular') : null,
        adoption ? (work.businessStatus ?? 'available') : null,
        adoption ? (work.currentEventName ?? null) : null,
        work.ownerDisplay ?? '不公开',
        adoption && work.priceMinorUnits ? work.priceMinorUnits : null,
        adoption && work.priceMinorUnits ? 'CNY' : null,
        publicationStatus,
        work.sortOrder ?? index,
        work.featured ? 1 : 0,
        publicationStatus === 'published' ? now : null,
        now,
        now,
      )

      for (const [position, tag] of (work.featureTags ?? []).entries()) {
        sqlite.prepare(`
          INSERT INTO work_feature_tags (work_id, position, value)
          VALUES (?, ?, ?)
        `).run(workId, position, tag)
      }

      const seedWorkMedia = async (
        role: 'design_sheet' | 'studio_photo',
        media: { alt: string, width?: number, height?: number },
        position: number,
        primary: boolean,
      ) => {
        const assetId = randomUUID()
        const width = media.width ?? 3200
        const height = media.height ?? 2400
        const content = Buffer.concat([
          createSyntheticWatermarkPng() as Buffer,
          randomBytes(16),
        ])
        const sha256 = createHash('sha256').update(content).digest('hex')
        const objectKey = `test/e2e-public/original/${assetId}/source.png`
        sqlite.prepare(`
          INSERT INTO assets (
            id, role, status, private_object_key, sha256, byte_size,
            mime_type, width, height, created_at, updated_at
          ) VALUES (?, ?, 'READY', ?, ?, ?, 'image/png', ?, ?, ?, ?)
        `).run(assetId, role, objectKey, sha256, content.length, width, height, now, now)
        fake.seedPrivate(objectKey, content, 'image/png', sha256, {
          fileSize: content.length,
          format: 'png',
          height,
          orientation: 1,
          width,
        })
        sqlite.prepare(`
          INSERT INTO work_assets (
            work_id, asset_id, role, alt_text, position, is_primary,
            crop_x, crop_y, crop_width, crop_height, watermark_anchor
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, 1, 'top-left')
        `).run(workId, assetId, role, media.alt, position, primary ? 1 : 0)
        await generatePublicVariants(
          sqlite,
          fake,
          assetId,
          role === 'design_sheet' && work.photos.length === 0
            ? ['design-sheet', 'work-card']
            : undefined,
          now,
        )
        // T34-F1：常规领养设定图同时预生成首页领养入口无水印变体。
        if (
          role === 'design_sheet'
          && work.purpose === 'adoption'
          && (work.adoptionMethod ?? 'regular') === 'regular'
          && assetSupportsSiteDisplay(
            sqlite,
            assetId,
            [HOME_ENTRY_USAGES.adoption],
          )
        ) {
          await generateSiteDisplayVariants(
            sqlite,
            fake,
            assetId,
            [HOME_ENTRY_USAGES.adoption],
            now,
          )
        }
      }

      if (work.designSheet) {
        await seedWorkMedia('design_sheet', work.designSheet, 0, false)
      }
      for (const [position, photo] of work.photos.entries()) {
        await seedWorkMedia('studio_photo', photo, position, position === 0)
      }
      seeded.push(work.slug)
    }
    return { data: { ok: true, slugs: seeded } }
  }

  // T20 首页轮播 E2E：种入横竖配对的首页图；启用项预生成公开 variant。
  // 公开首页汇集全部启用项，因此清空 site_hero_slides 保证轮播确定。
  if (body?.action === 'seedHomeSlides') {
    const sqlite = getDatabase().sqlite
    const now = Date.now()
    const placement = body.placement === 'commission' ? 'commission' : 'home'

    const staleAssetIds = sqlite.prepare(`
      SELECT id FROM assets WHERE private_object_key LIKE ?
    `).pluck().all(`test/e2e-${placement}/%`) as string[]
    sqlite.prepare('DELETE FROM site_hero_slides WHERE placement = ?')
      .run(placement)
    if (staleAssetIds.length > 0) {
      const placeholders = staleAssetIds.map(() => '?').join(', ')
      sqlite.prepare(`
        DELETE FROM asset_variants WHERE asset_id IN (${placeholders})
      `).run(...staleAssetIds)
      sqlite.prepare(`
        DELETE FROM assets WHERE id IN (${placeholders})
      `).run(...staleAssetIds)
    }

    const insertHeroSource = (
      role: 'home_hero_landscape' | 'home_hero_portrait',
      width: number,
      height: number,
    ) => {
      const assetId = randomUUID()
      const content = Buffer.concat([
        createSyntheticWatermarkPng() as Buffer,
        randomBytes(16),
      ])
      const sha256 = createHash('sha256').update(content).digest('hex')
      const objectKey = `test/e2e-${placement}/original/${assetId}/source.png`
      sqlite.prepare(`
        INSERT INTO assets (
          id, role, status, private_object_key, sha256, byte_size,
          mime_type, width, height, created_at, updated_at
        ) VALUES (?, ?, 'READY', ?, ?, ?, 'image/png', ?, ?, ?, ?)
      `).run(assetId, role, objectKey, sha256, content.length, width, height, now, now)
      fake.seedPrivate(objectKey, content, 'image/png', sha256, {
        fileSize: content.length,
        format: 'png',
        height,
        orientation: 1,
        width,
      })
      return assetId
    }

    for (const slide of body.slides ?? []) {
      const landscapeAssetId = insertHeroSource(
        'home_hero_landscape',
        slide.landscapeWidth ?? 3200,
        slide.landscapeHeight ?? 1800,
      )
      const portraitAssetId = insertHeroSource(
        'home_hero_portrait',
        slide.portraitWidth ?? 1800,
        slide.portraitHeight ?? 3200,
      )
      const linkedWorkId = slide.linkedWorkSlug
        ? sqlite.prepare(`
            SELECT id FROM works WHERE slug = ? AND publication_status = 'published'
          `).pluck().get(slide.linkedWorkSlug) as string | undefined
        : undefined
      if (slide.linkedWorkSlug && !linkedWorkId) {
        setResponseStatus(event, 400)
        return { error: `linked work is not published: ${slide.linkedWorkSlug}` }
      }
      sqlite.prepare(`
        INSERT INTO site_hero_slides (
          id, placement, landscape_asset_id, portrait_asset_id, alt_text,
          sort_order, enabled, linked_work_id, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        randomUUID(),
        placement,
        landscapeAssetId,
        portraitAssetId,
        slide.alt,
        slide.sortOrder,
        slide.enabled ? 1 : 0,
        linkedWorkId ?? null,
        now,
        now,
      )
      if (slide.enabled) {
        // T34-F1：站点展示位使用无水印 site-display-v1 变体。
        const usages = SITE_HERO_USAGES[placement]
        await generateSiteDisplayVariants(
          sqlite,
          fake,
          landscapeAssetId,
          [usages.landscape],
          now,
        )
        await generateSiteDisplayVariants(
          sqlite,
          fake,
          portraitAssetId,
          [usages.portrait],
          now,
        )
        if (placement === 'commission') {
          await generateSiteDisplayVariants(
            sqlite,
            fake,
            landscapeAssetId,
            [HOME_ENTRY_USAGES.commission],
            now,
          )
        }
      }
    }

    if (body.settings) {
      const current = sqlite.prepare(`
        SELECT
          version, hero_tagline AS tagline,
          hero_auto_rotate AS autoRotate,
          hero_auto_rotate_interval_ms AS autoRotateIntervalMs,
          contact_email AS contactEmail,
          contact_qq AS contactQq
        FROM site_content WHERE id = 'site'
      `).get() as {
        version: number
        tagline: string | null
        autoRotate: number
        autoRotateIntervalMs: number
        contactEmail: string | null
        contactQq: string | null
      }
      sqlite.prepare(`
        UPDATE site_content
        SET hero_tagline = ?, hero_auto_rotate = ?,
            hero_auto_rotate_interval_ms = ?, contact_email = ?,
            contact_qq = ?, version = version + 1,
            updated_at = ?
        WHERE id = 'site' AND version = ?
      `).run(
        body.settings.tagline ?? current.tagline,
        body.settings.autoRotate === undefined
          ? current.autoRotate
          : (body.settings.autoRotate ? 1 : 0),
        body.settings.autoRotateIntervalMs ?? current.autoRotateIntervalMs,
        body.settings.contactEmail ?? current.contactEmail,
        body.settings.contactQq ?? current.contactQq,
        now,
        current.version,
      )
    }
    return { data: { ok: true } }
  }

  if (body?.action === 'seedHomePublicationOperation') {
    const sqlite = getDatabase().sqlite
    const slide = sqlite.prepare(`
      SELECT id FROM site_hero_slides
      WHERE placement = 'home' AND alt_text = ? AND enabled = 0
    `).get(body.slideAlt) as { id: string } | undefined
    if (!slide) {
      setResponseStatus(event, 404)
      return { error: 'disabled slide not found' }
    }
    const id = randomUUID()
    const now = Date.now()
    const version = sqlite.prepare(`
      SELECT version FROM site_content WHERE id = 'site'
    `).pluck().get() as number
    sqlite.prepare(`
      INSERT INTO publication_operations (
        id, operation_type, entity_type, entity_id, requested_version,
        status, started_at, updated_at
      ) VALUES (?, 'PUBLISH', 'HOME', ?, ?, 'GENERATING_PUBLIC', ?, ?)
    `).run(id, slide.id, version, now, now)
    return { data: { id } }
  }

  // T20 大图管理 E2E：临时悬空/恢复活动水印 profile 指向，验证预览与启用的
  // 服务端阻断。RETIRED→ACTIVE 被状态机触发器禁止，因此改为置空
  // site_branding.active_watermark_profile_id；模块级记录原指向用于恢复。
  if (body?.action === 'setWatermarkProfileActive') {
    const sqlite = getDatabase().sqlite
    const now = Date.now()
    if (body.active === false) {
      const current = sqlite.prepare(`
        SELECT active_watermark_profile_id FROM site_branding WHERE id = 'site'
      `).pluck().get() as string | null | undefined
      suspendedProfileId = current ?? null
      sqlite.prepare(`
        UPDATE site_branding
        SET active_watermark_profile_id = NULL, version = version + 1,
            updated_at = ?
        WHERE id = 'site'
      `).run(now)
      return { data: { ok: true, suspended: suspendedProfileId } }
    }
    if (suspendedProfileId) {
      sqlite.prepare(`
        UPDATE site_branding
        SET active_watermark_profile_id = ?, version = version + 1,
            updated_at = ?
        WHERE id = 'site'
      `).run(suspendedProfileId, now)
      suspendedProfileId = null
    }
    return { data: { ok: true } }
  }

  setResponseStatus(event, 400)
  return { error: 'unknown action' }
})
