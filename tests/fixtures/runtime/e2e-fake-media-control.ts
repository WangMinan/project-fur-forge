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
import { generatePublicVariants } from '../../../server/utils/recipe/media-recipe'
import {
  assetSupportsSiteDisplay,
  generateSiteDisplayVariants,
  HOME_ENTRY_USAGES,
  SITE_HERO_USAGES,
} from '../../../server/utils/recipe/site-display-recipe'
import { resetRequestRateLimits } from '../../../server/utils/route/request-rate-limit'
import {
  createSyntheticWatermarkPng,
} from '../../../scripts/oss-preflight-core.mjs'
import type { HeroPlacement } from '../../../shared/types/contracts'
import { getE2eFakeMediaStorage } from './e2e-fake-media'

interface ControlBody {
  action?: string
  placement?: HeroPlacement
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
    purpose?: 'commission' | 'showcase' | 'adoption'
    featured?: boolean
    sortOrder?: number
    publicationStatus?: 'draft' | 'published'
    adoptionStatus?: 'available' | 'adopted'
    priceCnyMinor?: number
    adoptionCover?: {
      alt: string
      width?: number
      height?: number
    }
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
  slides?: HeroSeedItem[]
  landscapeSlides?: HeroSeedItem[]
  portraitSlides?: HeroSeedItem[]
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

interface HeroSeedItem {
    alt: string
    sortOrder: number
    enabled: boolean
    linkedWorkSlug?: string | null
    landscapeWidth?: number
    landscapeHeight?: number
    portraitWidth?: number
    portraitHeight?: number
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
  const sqlite = getDatabase().sqlite
  const content = readFileSync(resolve('public/brand/logo-full-light.png'))
  const sha256 = createHash('sha256').update(content).digest('hex')
  const keys = sqlite.prepare(`
    SELECT private_object_key FROM assets
    WHERE role = 'watermark_logo' AND status = 'READY' AND sha256 = ?
  `).pluck().all(sha256) as string[]
  keys.forEach(key => fake.seedPrivate(key, content, 'image/png', sha256))

  // 品牌管理 E2E 会把活动 profile 切到上传候选；测试 fake reset 只清内存对象，
  // 不回滚数据库。后续 Hero 预览仍应能消费当前活动 logo，因此按数据库身份
  // 恢复其私有源对象。这里不进入生产构建，也不伪造 profile 状态。
  const active = sqlite.prepare(`
    SELECT asset.private_object_key AS objectKey,
           asset.sha256, asset.mime_type AS mimeType,
           asset.width, asset.height
    FROM site_branding AS branding
    JOIN watermark_profiles AS profile
      ON profile.id = branding.active_watermark_profile_id
    JOIN assets AS asset ON asset.id = profile.source_asset_id
    WHERE branding.id = 'site' AND asset.status = 'READY'
  `).get() as {
    height: number
    mimeType: string
    objectKey: string
    sha256: string
    width: number
  } | undefined
  if (active && !fake.objects.has(active.objectKey)) {
    const fallback = createSyntheticWatermarkPng() as Buffer
    fake.seedPrivate(active.objectKey, fallback, active.mimeType, active.sha256, {
      fileSize: fallback.length,
      format: active.mimeType === 'image/png' ? 'png' : 'jpeg',
      height: active.height,
      orientation: 1,
      width: active.width,
    })
  }
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

  if (body?.action === 'resetOfficialChannels') {
    const sqlite = getDatabase().sqlite
    const now = Date.now()
    sqlite.prepare(`
      UPDATE site_content
      SET contact_email = '3114559925@qq.com',
          contact_qq = '3114559925',
          official_channels_json = ?,
          contact_content_version = contact_content_version + 1,
          updated_at = ?
      WHERE id = 'site'
    `).run(JSON.stringify([
      { platform: 'qq', account: '3114559925', qrCodeAssetId: null },
      { platform: 'qq_group', account: null, qrCodeAssetId: null },
    ]), now)
    return { data: { ok: true } }
  }

  // GATE-07/T51-F8 品牌页 E2E：已发布作品照生成当前活动水印变体，
  // 首页横竖图始终生成独立的无水印 site-display-v2 变体。水印切换清理旧
  // profile 时不得破坏 Hero；首页轮播管理 API 不在此处被测，故直接落库。
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
    insertSource(landscapeId, 'home_hero_landscape', 4000, 2250)
    insertSource(portraitId, 'home_hero_portrait', 1800, 3200)
    const workId = randomUUID()
    sqlite.prepare(`
      INSERT INTO works (
        id, slug, character_name, species, purpose,
        publication_status, published_at, created_at, updated_at
      ) VALUES (?, ?, '品牌舞台', '犬科', 'showcase',
                'published', ?, ?, ?)
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

    await generatePublicVariants(sqlite, fake, photoId, undefined, now)
    await generateSiteDisplayVariants(
      sqlite,
      fake,
      landscapeId,
      [SITE_HERO_USAGES.home.landscape],
      now,
    )
    await generateSiteDisplayVariants(
      sqlite,
      fake,
      portraitId,
      [SITE_HERO_USAGES.home.portrait],
      now,
    )
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
    // work_assets 随 works 级联删除；关联作品的首页图 linked_work_id 由 FK 置空。
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
      const publicationStatus = work.publicationStatus ?? 'published'
      if (
        !work.photos
        || work.photos.length > 5
        || (publicationStatus === 'published' && work.photos.length === 0)
        || (adoption && publicationStatus === 'published' && !work.adoptionCover)
      ) {
        setResponseStatus(event, 400)
        return { error: 'seeded works need valid role media' }
      }

      const workId = randomUUID()
      // 公开列表按发布时间倒序。为同一批种子分配不同毫秒，既保持输入顺序，
      // 也避免 SQLite 在 published_at 完全相同时退化为不确定顺序。
      const publishedAt = now - index
      sqlite.prepare(`
        INSERT INTO works (
          id, slug, character_name, species, purpose, adoption_status,
          price_amount_minor, price_currency,
          publication_status, sort_order, featured,
          published_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        workId,
        work.slug,
        work.characterName,
        work.species ?? '犬科',
        purpose,
        adoption ? work.adoptionStatus : null,
        adoption && work.priceCnyMinor ? work.priceCnyMinor : null,
        adoption && work.priceCnyMinor ? 'CNY' : null,
        publicationStatus,
        work.sortOrder ?? index,
        work.featured ? 1 : 0,
        publicationStatus === 'published' ? publishedAt : null,
        now,
        now,
      )

      const seedWorkMedia = async (
        role: 'adoption_cover' | 'design_sheet' | 'studio_photo',
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
          role === 'adoption_cover' ? ['adoption-card'] : undefined,
          now,
        )
        // 领养入口只消费独立横版封面，不回退到设定图或出厂照。
        if (
          role === 'adoption_cover'
          && work.purpose === 'adoption'
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

      if (work.adoptionCover) {
        await seedWorkMedia('adoption_cover', work.adoptionCover, 0, false)
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

  // R3-C 四集合 E2E：横竖数量和顺序可不同，启用项预生成公开 variant。
  if (body?.action === 'seedHomeSlides') {
    const sqlite = getDatabase().sqlite
    const now = Date.now()
    const placement = body.placement === 'commission' ? 'commission' : 'home'

    const staleAssetIds = sqlite.prepare(`
      SELECT id FROM assets WHERE private_object_key LIKE ?
    `).pluck().all(`test/e2e-${placement}/%`) as string[]
    sqlite.prepare('DELETE FROM site_hero_items WHERE placement = ?').run(placement)
    // 同时清理旧 pair 夹具，避免其 FK 阻止种子资产回收。
    sqlite.prepare('DELETE FROM site_hero_slides WHERE placement = ?').run(placement)
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

    const orientationItems = {
      landscape: body.landscapeSlides ?? body.slides ?? [],
      portrait: body.portraitSlides ?? body.slides ?? [],
    }
    for (const orientation of ['landscape', 'portrait'] as const) {
      for (const item of orientationItems[orientation]) {
        const assetId = orientation === 'landscape'
          ? insertHeroSource(
              'home_hero_landscape',
              item.landscapeWidth ?? 4000,
              item.landscapeHeight ?? 2250,
            )
          : insertHeroSource(
              'home_hero_portrait',
              item.portraitWidth ?? 1800,
              item.portraitHeight ?? 3200,
            )
        sqlite.prepare(`
          INSERT INTO site_hero_items (
            id, placement, orientation, asset_id, alt_text,
            sort_order, enabled, version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).run(
          randomUUID(),
          placement,
          orientation,
          assetId,
          item.alt,
          item.sortOrder,
          item.enabled ? 1 : 0,
          now,
          now,
        )
        if (!item.enabled) {
          continue
        }
        // 站点展示位使用无水印 site-display-v2 变体。
        const usage = SITE_HERO_USAGES[placement][orientation]
        await generateSiteDisplayVariants(
          sqlite,
          fake,
          assetId,
          [usage],
          now,
        )
        if (placement === 'commission' && orientation === 'landscape') {
          await generateSiteDisplayVariants(
            sqlite,
            fake,
            assetId,
            [HOME_ENTRY_USAGES.commission],
            now,
          )
        }
      }
      sqlite.prepare(`
        UPDATE site_hero_collections
        SET version = version + 1, updated_at = ?
        WHERE placement = ? AND orientation = ?
      `).run(now, placement, orientation)
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
