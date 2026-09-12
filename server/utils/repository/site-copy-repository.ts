import type Database from 'better-sqlite3'
import {
  adminSiteCopyResponseSchema, siteCopySchemas, siteCopySectionSchema,
  type SiteCopyLocale, type SiteCopySection, type SiteCopySections, type PublicSiteCopy,
} from '../../../shared/schemas/site-copy'
import { SITE_LOCALE_CODES } from '../../../shared/constants/site-locales'

interface TranslationRow { locale: string, section: SiteCopySection, fields: string, version: number }

function chineseCopy(sqlite: Database.Database) {
  const row = sqlite.prepare(`SELECT hero_tagline AS tagline, home_content_version AS version,
    commission_intro AS intro, commission_estimate_note AS estimateNote, commission_email_action AS emailAction,
    about_studio_facts AS studioFacts, about_making_scope AS makingScope,
    commission_content_version AS commissionVersion, about_content_version AS aboutVersion
    FROM site_content WHERE id = 'site'`).get() as {
    tagline: string | null, version: number, intro: string | null, estimateNote: string | null,
    emailAction: string | null, studioFacts: string | null, makingScope: string | null,
    commissionVersion: number, aboutVersion: number,
  }
  const status = sqlite.prepare("SELECT label, version FROM business_statuses WHERE kind = 'commission'").get() as { label: string, version: number } | undefined
  return {
    home: { fields: { tagline: row.tagline }, version: row.version },
    commission: { fields: { intro: row.intro, estimateNote: row.estimateNote, emailAction: row.emailAction }, version: row.commissionVersion },
    about: { fields: { studioFacts: row.studioFacts, makingScope: row.makingScope }, version: row.aboutVersion },
    status: { fields: { label: status?.label ?? null }, version: status?.version ?? 0 },
  }
}

function translations(sqlite: Database.Database) {
  return sqlite.prepare('SELECT locale, section, fields_json AS fields, version FROM site_content_translations').all() as TranslationRow[]
}

function emptySections(): SiteCopySections {
  return { home: { tagline: null }, commission: { intro: null, estimateNote: null, emailAction: null }, about: { studioFacts: null, makingScope: null }, status: { label: null } }
}

export function getPublicSiteCopy(sqlite: Database.Database): PublicSiteCopy {
  const base = chineseCopy(sqlite)
  const copy: PublicSiteCopy = { 'zh-CN': { home: base.home.fields, commission: base.commission.fields, about: base.about.fields, status: base.status.fields } }
  for (const row of translations(sqlite)) {
    if (!SITE_LOCALE_CODES.some(code => code === row.locale)) continue
    const section = siteCopySectionSchema.parse(row.section)
    const fields = siteCopySchemas[section].parse(JSON.parse(row.fields))
    copy[row.locale] ??= emptySections()
    Object.assign(copy[row.locale]!, { [section]: fields })
  }
  return copy
}

export function getAdminSiteCopy(sqlite: Database.Database, locale: SiteCopyLocale) {
  const base = chineseCopy(sqlite)
  const source = { home: base.home.fields, commission: base.commission.fields, about: base.about.fields, status: base.status.fields }
  if (locale === 'zh-CN') return adminSiteCopyResponseSchema.parse({ data: { locale, source, sections: base } }).data
  const fields = emptySections()
  const sections = Object.fromEntries(Object.entries(fields).map(([section, value]) => [section, { fields: value, version: 0 }]))
  for (const row of translations(sqlite).filter(item => item.locale === locale)) {
    sections[row.section] = { fields: siteCopySchemas[row.section].parse(JSON.parse(row.fields)), version: row.version }
  }
  return adminSiteCopyResponseSchema.parse({ data: { locale, source, sections } }).data
}

