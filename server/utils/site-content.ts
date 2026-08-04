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
  aboutMakingScope: string | null
  aboutStudioFacts: string | null
  basicTerms: string | null
  commissionEmailAction: string | null
  commissionEstimateNote: string | null
  commissionFaqJson: string | null
  commissionIntro: string | null
  contactAntiScam: string | null
  contactDouyin: string | null
  contactEmail: string
  contactQq: string
  privacyPolicy: string | null
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
      contact_anti_scam AS contactAntiScam
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

export function updateSiteContent(
  sqlite: Database.Database,
  expectedVersion: number,
  input: {
    commission: {
      intro: string | null
      estimateNote: string | null
      emailAction: string | null
      faqs: Array<{ question: string, answer: string }>
    }
    about: {
      studioFacts: string | null
      makingScope: string | null
      basicTerms: string | null
      privacyPolicy: string | null
    }
    contact: {
      douyin: string | null
      antiScam: string | null
    }
  },
  actorUserId: string,
  now = Date.now(),
) {
  sqlite.transaction(() => {
    const result = sqlite.prepare(`
      UPDATE site_content
      SET commission_intro = ?, commission_estimate_note = ?,
          commission_email_action = ?, commission_faq_json = ?,
          about_studio_facts = ?, about_making_scope = ?, basic_terms = ?,
          privacy_policy = ?,
          contact_douyin = ?, contact_anti_scam = ?,
          version = version + 1, updated_at = ?
      WHERE id = 'site' AND version = ?
    `).run(
      input.commission.intro,
      input.commission.estimateNote,
      input.commission.emailAction,
      JSON.stringify(input.commission.faqs),
      input.about.studioFacts,
      input.about.makingScope,
      input.about.basicTerms,
      input.about.privacyPolicy,
      input.contact.douyin,
      input.contact.antiScam,
      now,
      expectedVersion,
    )
    if (result.changes !== 1) {
      throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
    }
    sqlite.prepare(`
      INSERT INTO audit_logs (
        id, actor_user_id, action, entity_type, entity_id, result, created_at
      ) VALUES (?, ?, 'SITE_CONTENT_UPDATE', 'SITE', 'site', 'SUCCESS', ?)
    `).run(randomUUID(), actorUserId, now)
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
        throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
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
        throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
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
