import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { CONTACT_PLATFORMS } from '../../../shared/constants/contact'
import {
  adminSiteContentDtoSchema,
  adminOfficialChannelsSchema,
  publicSiteContentDtoSchema,
} from '../../../shared/schemas/site-content'
import type {
  AdminSiteContentDto,
  SiteBusinessStatusKind,
  SiteBusinessStatusTone,
} from '../../../shared/types/contracts'
import { ServiceError } from '../service-error'
import type { RuntimeConfig } from '../runtime-config'
import { safeLog } from '../safe-log'
import {
  completeContactQrVariants,
  contactQrWidths,
} from '../recipe/contact-qr-recipe'
import { toPublicPngSourceSetDto } from '../recipe/media-mapper'

interface SiteContentRow {
  aboutContentVersion: number
  aboutMakingScope: string | null
  aboutStudioFacts: string | null
  basicTerms: string | null
  commissionContentVersion: number
  commissionEmailAction: string | null
  commissionEstimateNote: string | null
  commissionIntro: string | null
  contactAntiScam: string | null
  contactContentVersion: number
  contactEmail: string
  officialChannelsJson: string
  privacyContentVersion: number
  privacyPolicy: string | null
  termsContentVersion: number
  version: number
}

interface BusinessStatusRow {
  detail: string
  href: '/commission' | '/adoptions'
  kind: SiteBusinessStatusKind
  label: string
  tone: SiteBusinessStatusTone
  version: number
}

const statusHref = {
  commission: '/commission',
  adoption: '/adoptions',
} as const

function siteContentRow(sqlite: Database.Database) {
  const row = sqlite.prepare(`
    SELECT
      version, contact_email AS contactEmail,
      official_channels_json AS officialChannelsJson,
      commission_intro AS commissionIntro,
      commission_estimate_note AS commissionEstimateNote,
      commission_email_action AS commissionEmailAction,
      about_studio_facts AS aboutStudioFacts,
      about_making_scope AS aboutMakingScope,
      basic_terms AS basicTerms,
      privacy_policy AS privacyPolicy,
      contact_anti_scam AS contactAntiScam,
      commission_content_version AS commissionContentVersion,
      about_content_version AS aboutContentVersion,
      terms_content_version AS termsContentVersion,
      privacy_content_version AS privacyContentVersion,
      contact_content_version AS contactContentVersion
    FROM site_content WHERE id = 'site'
  `).get() as SiteContentRow | undefined
  if (!row || !row.contactEmail) {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Site content is unavailable.')
  }
  return row
}

function businessStatuses(sqlite: Database.Database) {
  const rows = sqlite.prepare(`
    SELECT kind, tone, label, detail, href, version
    FROM business_statuses
    ORDER BY kind
  `).all() as BusinessStatusRow[]
  return {
    commission: rows.find(row => row.kind === 'commission') ?? null,
    adoption: rows.find(row => row.kind === 'adoption') ?? null,
  }
}

export function getPublicBusinessStatuses(sqlite: Database.Database) {
  const current = businessStatuses(sqlite)
  const project = (status: BusinessStatusRow | null) => status && ({
    kind: status.kind,
    tone: status.tone,
    label: status.label,
    detail: status.detail,
    href: status.href,
  })
  return {
    commission: project(current.commission),
    adoption: project(current.adoption),
  }
}

function officialChannels(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) {
      throw new Error('Official channels must be an array.')
    }
    return adminOfficialChannelsSchema.parse(CONTACT_PLATFORMS.map(platform => (
      value.find(channel => (
        typeof channel === 'object'
        && channel !== null
        && 'platform' in channel
        && channel.platform === platform
      ))
    )))
  }
  catch {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Official channel data is invalid.')
  }
}

function content(sqlite: Database.Database): AdminSiteContentDto {
  const row = siteContentRow(sqlite)
  return adminSiteContentDtoSchema.parse({
    version: row.version,
    sectionVersions: {
      commission: row.commissionContentVersion,
      about: row.aboutContentVersion,
      terms: row.termsContentVersion,
      privacy: row.privacyContentVersion,
      contact: row.contactContentVersion,
    },
    statuses: businessStatuses(sqlite),
    commission: {
      intro: row.commissionIntro,
      estimateNote: row.commissionEstimateNote,
      emailAction: row.commissionEmailAction,
    },
    about: {
      studioFacts: row.aboutStudioFacts,
      makingScope: row.aboutMakingScope,
      basicTerms: row.basicTerms,
      privacyPolicy: row.privacyPolicy,
    },
    contact: {
      email: row.contactEmail,
      officialChannels: officialChannels(row.officialChannelsJson),
      antiScam: row.contactAntiScam,
    },
  })
}

export function getAdminSiteContent(sqlite: Database.Database) {
  return content(sqlite)
}

interface ContactQrVariantRow {
  byteSize: number
  format: 'png'
  height: number
  objectKey: string
  protectionMode: 'none'
  recipeVersion: 'contact-qr-v1'
  sha256: string
  status: 'READY'
  storageScope: 'PUBLIC'
  usage: 'contact-qr'
  width: number
}

function contactQrSources(
  sqlite: Database.Database,
  assetId: string,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'],
) {
  const asset = sqlite.prepare(`
    SELECT role, status, width, height, mime_type AS mimeType
    FROM assets WHERE id = ?
  `).get(assetId) as {
    height: number
    mimeType: string
    role: string
    status: string
    width: number
  } | undefined
  if (
    !asset
    || asset.role !== 'contact_qr'
    || asset.status !== 'READY'
    || !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)
    || asset.width < 64
    || asset.height < 64
  ) {
    return null
  }
  const variants = sqlite.prepare(`
    SELECT storage_scope AS storageScope, status, object_key AS objectKey,
           width, height, format, recipe_version AS recipeVersion,
           protection_mode AS protectionMode, usage, sha256,
           byte_size AS byteSize
    FROM asset_variants
    WHERE asset_id = ? AND storage_scope = 'PUBLIC' AND status = 'READY'
      AND usage = 'contact-qr' AND recipe_version = 'contact-qr-v1'
      AND protection_mode = 'none' AND sha256 IS NOT NULL AND byte_size > 0
  `).all(assetId) as ContactQrVariantRow[]
  const complete = completeContactQrVariants(asset.width, variants)
  if (!complete) {
    return null
  }
  try {
    return toPublicPngSourceSetDto(
      complete,
      mediaBaseUrl,
      contactQrWidths(asset.width),
      appEnv,
    )
  }
  catch (error) {
    safeLog('error', 'Contact QR public projection failed.', {
      assetId,
      errorName: (error as { name?: unknown }).name,
    })
    return null
  }
}

export function getPublicSiteContent(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
) {
  const current = content(sqlite)
  const publicChannels = current.contact.officialChannels
    .flatMap((channel) => {
      if (channel.account === null || channel.qrCodeAssetId === null) {
        return []
      }
      const qrCodeSources = contactQrSources(
        sqlite,
        channel.qrCodeAssetId,
        mediaBaseUrl,
        appEnv,
      )
      return qrCodeSources ? [{
        platform: channel.platform,
        account: channel.account,
        qrCodeSources,
      }] : []
    })
  return publicSiteContentDtoSchema.parse({
    statuses: getPublicBusinessStatuses(sqlite),
    commission: {
      ...current.commission,
      email: current.contact.email,
      termsHref: '/service',
    },
    about: {
      ...current.about,
      officialChannels: publicChannels,
    },
    contact: {
      email: current.contact.email,
      officialChannels: publicChannels,
      antiScam: current.contact.antiScam,
    },
  })
}

export type SiteContentSection =
  | 'about'
  | 'commission'
  | 'contact'
  | 'privacy'
  | 'terms'

/**
 * T34-F3：每个分区只更新自己的列和自己的版本列。
 * 一个分区保存时不携带、也不覆盖其它分区的值，因此并发编辑不同分区都能成功。
 */
const SECTION_UPDATES = {
  'commission': {
    versionColumn: 'commission_content_version',
    action: 'SITE_COMMISSION_CONTENT_UPDATE',
    assignments: 'commission_intro = @intro, commission_estimate_note = @estimateNote, commission_email_action = @emailAction',
  },
  'about': {
    versionColumn: 'about_content_version',
    action: 'SITE_ABOUT_CONTENT_UPDATE',
    assignments: 'about_studio_facts = @studioFacts, about_making_scope = @makingScope',
  },
  'terms': {
    versionColumn: 'terms_content_version',
    action: 'SITE_TERMS_CONTENT_UPDATE',
    assignments: 'basic_terms = @basicTerms',
  },
  'privacy': {
    versionColumn: 'privacy_content_version',
    action: 'SITE_PRIVACY_CONTENT_UPDATE',
    assignments: 'privacy_policy = @privacyPolicy',
  },
  'contact': {
    versionColumn: 'contact_content_version',
    action: 'SITE_CONTACT_CONTENT_UPDATE',
    assignments: 'contact_email = @email, official_channels_json = @officialChannelsJson, contact_anti_scam = @antiScam',
  },
} as const satisfies Record<SiteContentSection, {
  action: string
  assignments: string
  versionColumn: string
}>

export function updateSiteContentSection(
  sqlite: Database.Database,
  section: SiteContentSection,
  expectedVersion: number,
  values: Record<string, string | null>,
  actorUserId: string,
  now = Date.now(),
) {
  const definition = SECTION_UPDATES[section]
  sqlite.transaction(() => {
    const result = sqlite.prepare(`
      UPDATE site_content
      SET ${definition.assignments},
          ${definition.versionColumn} = ${definition.versionColumn} + 1,
          updated_at = @now
      WHERE id = 'site' AND ${definition.versionColumn} = @expectedVersion
    `).run({ ...values, now, expectedVersion })
    if (result.changes !== 1) {
      throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
    }
    sqlite.prepare(`
      INSERT INTO audit_logs (
        id, actor_user_id, action, entity_type, entity_id, result, created_at
      ) VALUES (?, ?, ?, 'SITE', 'site', 'SUCCESS', ?)
    `).run(randomUUID(), actorUserId, definition.action, now)
  })()
  return content(sqlite)
}

export function updateSiteBusinessStatus(
  sqlite: Database.Database,
  kind: SiteBusinessStatusKind,
  expectedVersion: number,
  input: {
    tone: SiteBusinessStatusTone
    label: string
    detail: string
  },
  actorUserId: string,
  now = Date.now(),
) {
  sqlite.transaction(() => {
    const currentVersion = sqlite.prepare(`
      SELECT version FROM business_statuses WHERE kind = ?
    `).pluck().get(kind) as number | undefined
    if (currentVersion === undefined) {
      if (expectedVersion !== 0) {
        throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
      }
      sqlite.prepare(`
        INSERT INTO business_statuses (
          kind, tone, label, detail, href, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(kind, input.tone, input.label, input.detail, statusHref[kind], now, now)
    }
    else {
      const result = sqlite.prepare(`
        UPDATE business_statuses
        SET tone = ?, label = ?, detail = ?, version = version + 1,
            updated_at = ?
        WHERE kind = ? AND version = ?
      `).run(
        input.tone,
        input.label,
        input.detail,
        now,
        kind,
        expectedVersion,
      )
      if (result.changes !== 1) {
        throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
      }
    }
    sqlite.prepare(`
      INSERT INTO audit_logs (
        id, actor_user_id, action, entity_type, entity_id, result, created_at
      ) VALUES (?, ?, 'SITE_BUSINESS_STATUS_UPDATE', 'SITE', ?, 'SUCCESS', ?)
    `).run(randomUUID(), actorUserId, kind, now)
  })()
  return content(sqlite)
}
