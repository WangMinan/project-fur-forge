import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  adminSiteContentDtoSchema,
  commissionFaqListSchema,
  publicSiteContentDtoSchema,
} from '../../shared/schemas/site-content'
import type {
  AdminSiteContentDto,
  SiteBusinessStatusKind,
  SiteBusinessStatusTone,
} from '../../shared/types/contracts'
import { ServiceError } from './service-error'

interface SiteContentRow {
  aboutContentVersion: number
  aboutMakingScope: string | null
  aboutStudioFacts: string | null
  basicTerms: string | null
  commissionContentVersion: number
  commissionEmailAction: string | null
  commissionEstimateNote: string | null
  commissionFaqJson: string | null
  commissionFaqVersion: number
  commissionIntro: string | null
  contactAntiScam: string | null
  contactContentVersion: number
  contactDouyin: string | null
  contactEmail: string
  contactQq: string
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
      version, contact_email AS contactEmail, contact_qq AS contactQq,
      contact_douyin AS contactDouyin,
      commission_intro AS commissionIntro,
      commission_estimate_note AS commissionEstimateNote,
      commission_email_action AS commissionEmailAction,
      commission_faq_json AS commissionFaqJson,
      about_studio_facts AS aboutStudioFacts,
      about_making_scope AS aboutMakingScope,
      basic_terms AS basicTerms,
      privacy_policy AS privacyPolicy,
      contact_anti_scam AS contactAntiScam,
      commission_content_version AS commissionContentVersion,
      commission_faq_version AS commissionFaqVersion,
      about_content_version AS aboutContentVersion,
      terms_content_version AS termsContentVersion,
      privacy_content_version AS privacyContentVersion,
      contact_content_version AS contactContentVersion
    FROM site_content WHERE id = 'site'
  `).get() as SiteContentRow | undefined
  if (!row || !row.contactEmail || !row.contactQq) {
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

function faqs(raw: string | null) {
  try {
    return commissionFaqListSchema.parse(raw ? JSON.parse(raw) : [])
  }
  catch {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Site FAQ data is invalid.')
  }
}

function content(sqlite: Database.Database): AdminSiteContentDto {
  const row = siteContentRow(sqlite)
  return adminSiteContentDtoSchema.parse({
    version: row.version,
    sectionVersions: {
      commission: row.commissionContentVersion,
      commissionFaq: row.commissionFaqVersion,
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
      faqs: faqs(row.commissionFaqJson),
    },
    about: {
      studioFacts: row.aboutStudioFacts,
      makingScope: row.aboutMakingScope,
      basicTerms: row.basicTerms,
      privacyPolicy: row.privacyPolicy,
    },
    contact: {
      email: row.contactEmail,
      qq: row.contactQq,
      douyin: row.contactDouyin,
      antiScam: row.contactAntiScam,
    },
  })
}

export function getAdminSiteContent(sqlite: Database.Database) {
  return content(sqlite)
}

export function getPublicSiteContent(sqlite: Database.Database) {
  const current = content(sqlite)
  const publicStatus = (status: BusinessStatusRow | null) => status && ({
    kind: status.kind,
    tone: status.tone,
    label: status.label,
    detail: status.detail,
    href: status.href,
  })
  return publicSiteContentDtoSchema.parse({
    statuses: {
      commission: publicStatus(current.statuses.commission),
      adoption: publicStatus(current.statuses.adoption),
    },
    commission: {
      ...current.commission,
      email: current.contact.email,
      termsHref: '/service',
    },
    about: {
      ...current.about,
      officialChannels: {
        email: current.contact.email,
        qq: current.contact.qq,
        douyin: current.contact.douyin,
      },
    },
    contact: current.contact,
  })
}

export type SiteContentSection =
  | 'about'
  | 'commission'
  | 'commission-faq'
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
  'commission-faq': {
    versionColumn: 'commission_faq_version',
    action: 'SITE_COMMISSION_FAQ_UPDATE',
    assignments: 'commission_faq_json = @faqJson',
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
    assignments: 'contact_email = @email, contact_qq = @qq, contact_douyin = @douyin, contact_anti_scam = @antiScam',
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
