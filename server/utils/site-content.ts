import { createHash, randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  adminCommissionFaqListSchema,
  adminSiteContentDtoSchema,
  commissionFaqListSchema,
  publicSiteContentDtoSchema,
} from '../../shared/schemas/site-content'
import type {
  AdminSiteContentDto,
  SiteBusinessStatusKind,
  SiteBusinessStatusTone,
  SiteContentSection,
} from '../../shared/types/contracts'
import { ServiceError } from './service-error'

interface SiteContentRow {
  aboutMakingScope: string | null
  aboutStudioFacts: string | null
  aboutVersion: number
  basicTerms: string | null
  commissionEmailAction: string | null
  commissionEstimateNote: string | null
  commissionFaqJson: string | null
  commissionIntro: string | null
  commissionVersion: number
  contactAntiScam: string | null
  contactDouyin: string | null
  contactEmail: string
  contactQq: string
  contactVersion: number
  faqVersion: number
  privacyPolicy: string | null
  privacyVersion: number
  termsVersion: number
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

export interface SiteContentSectionPayloads {
  commission: {
    intro: string | null
    estimateNote: string | null
    emailAction: string | null
  }
  faq: {
    faqs: Array<{ id: string, question: string, answer: string }>
  }
  about: {
    studioFacts: string | null
    makingScope: string | null
  }
  terms: { basicTerms: string | null }
  privacy: { privacyPolicy: string | null }
  contact: {
    email: string
    qq: string
    douyin: string | null
    antiScam: string | null
  }
}

const statusHref = {
  commission: '/commission',
  adoption: '/adoptions',
} as const

function siteContentRow(sqlite: Database.Database) {
  const row = sqlite.prepare(`
    SELECT
      version,
      commission_version AS commissionVersion,
      faq_version AS faqVersion,
      about_version AS aboutVersion,
      terms_version AS termsVersion,
      privacy_version AS privacyVersion,
      contact_version AS contactVersion,
      contact_email AS contactEmail, contact_qq AS contactQq,
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

function deterministicFaqId(question: string, answer: string, index: number) {
  const bytes = Buffer.from(createHash('sha256')
    .update(`${index}\0${question}\0${answer}`)
    .digest('hex').slice(0, 32), 'hex')
  bytes[6] = (bytes[6]! & 0x0f) | 0x50
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const value = bytes.toString('hex')
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20),
  ].join('-')
}

function adminFaqs(raw: string | null) {
  try {
    const parsed = raw ? JSON.parse(raw) as unknown : []
    const publicFaqs = commissionFaqListSchema.parse(
      Array.isArray(parsed)
        ? parsed.map((item) => {
            if (!item || typeof item !== 'object') {
              return item
            }
            const value = item as Record<string, unknown>
            return { question: value.question, answer: value.answer }
          })
        : parsed,
    )
    return adminCommissionFaqListSchema.parse(publicFaqs.map((faq, index) => {
      const candidate = Array.isArray(parsed)
        ? (parsed[index] as { id?: unknown } | undefined)?.id
        : undefined
      return {
        id: typeof candidate === 'string'
          ? candidate
          : deterministicFaqId(faq.question, faq.answer, index),
        ...faq,
      }
    }))
  }
  catch {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Site FAQ data is invalid.')
  }
}

function content(sqlite: Database.Database): AdminSiteContentDto {
  const row = siteContentRow(sqlite)
  return adminSiteContentDtoSchema.parse({
    version: row.version,
    versions: {
      commission: row.commissionVersion,
      faq: row.faqVersion,
      about: row.aboutVersion,
      terms: row.termsVersion,
      privacy: row.privacyVersion,
      contact: row.contactVersion,
    },
    statuses: businessStatuses(sqlite),
    commission: {
      intro: row.commissionIntro,
      estimateNote: row.commissionEstimateNote,
      emailAction: row.commissionEmailAction,
      faqs: adminFaqs(row.commissionFaqJson),
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
      intro: current.commission.intro,
      estimateNote: current.commission.estimateNote,
      emailAction: current.commission.emailAction,
      faqs: current.commission.faqs.map(({ question, answer }) => ({
        question,
        answer,
      })),
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

function auditSectionUpdate(
  sqlite: Database.Database,
  section: SiteContentSection,
  actorUserId: string,
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, entity_type, entity_id, result, created_at
    ) VALUES (?, ?, ?, 'SITE', ?, 'SUCCESS', ?)
  `).run(
    randomUUID(),
    actorUserId,
    `SITE_CONTENT_${section.toUpperCase()}_UPDATE`,
    section,
    now,
  )
}

export function updateSiteContentSection<S extends SiteContentSection>(
  sqlite: Database.Database,
  section: S,
  expectedVersion: number,
  input: SiteContentSectionPayloads[S],
  actorUserId: string,
  now = Date.now(),
) {
  sqlite.transaction(() => {
    let result: { changes: number } | undefined
    switch (section) {
      case 'commission': {
        const payload = input as SiteContentSectionPayloads['commission']
        result = sqlite.prepare(`
          UPDATE site_content
          SET commission_intro = ?, commission_estimate_note = ?,
              commission_email_action = ?,
              commission_version = commission_version + 1, updated_at = ?
          WHERE id = 'site' AND commission_version = ?
        `).run(
          payload.intro,
          payload.estimateNote,
          payload.emailAction,
          now,
          expectedVersion,
        )
        break
      }
      case 'faq': {
        const payload = input as SiteContentSectionPayloads['faq']
        result = sqlite.prepare(`
          UPDATE site_content
          SET commission_faq_json = ?, faq_version = faq_version + 1,
              updated_at = ?
          WHERE id = 'site' AND faq_version = ?
        `).run(JSON.stringify(payload.faqs), now, expectedVersion)
        break
      }
      case 'about': {
        const payload = input as SiteContentSectionPayloads['about']
        result = sqlite.prepare(`
          UPDATE site_content
          SET about_studio_facts = ?, about_making_scope = ?,
              about_version = about_version + 1, updated_at = ?
          WHERE id = 'site' AND about_version = ?
        `).run(payload.studioFacts, payload.makingScope, now, expectedVersion)
        break
      }
      case 'terms': {
        const payload = input as SiteContentSectionPayloads['terms']
        result = sqlite.prepare(`
          UPDATE site_content
          SET basic_terms = ?, terms_version = terms_version + 1,
              updated_at = ?
          WHERE id = 'site' AND terms_version = ?
        `).run(payload.basicTerms, now, expectedVersion)
        break
      }
      case 'privacy': {
        const payload = input as SiteContentSectionPayloads['privacy']
        result = sqlite.prepare(`
          UPDATE site_content
          SET privacy_policy = ?, privacy_version = privacy_version + 1,
              updated_at = ?
          WHERE id = 'site' AND privacy_version = ?
        `).run(payload.privacyPolicy, now, expectedVersion)
        break
      }
      case 'contact': {
        const payload = input as SiteContentSectionPayloads['contact']
        result = sqlite.prepare(`
          UPDATE site_content
          SET contact_email = ?, contact_qq = ?, contact_douyin = ?,
              contact_anti_scam = ?, contact_version = contact_version + 1,
              updated_at = ?
          WHERE id = 'site' AND contact_version = ?
        `).run(
          payload.email,
          payload.qq,
          payload.douyin,
          payload.antiScam,
          now,
          expectedVersion,
        )
        break
      }
    }
    if (!result || result.changes !== 1) {
      throw new ServiceError(409, 'CONFLICT', 'Site content section is stale.', 'SITE_CONTENT_SECTION_STALE')
    }
    auditSectionUpdate(sqlite, section, actorUserId, now)
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
