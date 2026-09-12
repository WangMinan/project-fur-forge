import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { siteCopySchemas, type SiteCopyLocale, type SiteCopySection } from '../../../shared/schemas/site-copy'
import { ServiceError } from '../service-error'
import { getAdminSiteCopy } from '../repository/site-copy-repository'
import { updateSiteContentSection, updateSiteBusinessStatus } from './site-content'

export function saveSiteCopy(sqlite: Database.Database, locale: SiteCopyLocale, section: SiteCopySection,
  expectedVersion: number, payload: Record<string, string | null>, actor: string, now = Date.now()) {
  const parsed = siteCopySchemas[section].safeParse(payload)
  if (!parsed.success) throw new ServiceError(400, 'VALIDATION_ERROR', 'Site copy is invalid.')
  sqlite.transaction(() => {
    if (locale === 'zh-CN' && (section === 'commission' || section === 'about')) {
      updateSiteContentSection(sqlite, section, expectedVersion, parsed.data, actor, now)
      return
    }
    if (locale === 'zh-CN' && section === 'status') {
      if (!payload.label) throw new ServiceError(400, 'VALIDATION_ERROR', 'Chinese status label is required.')
      const tone = sqlite.prepare("SELECT tone FROM business_statuses WHERE kind = 'commission'").pluck().get() as 'open' | 'closed' | undefined
      updateSiteBusinessStatus(sqlite, 'commission', expectedVersion, { tone: tone ?? 'closed', label: payload.label }, actor, now)
      return
    }
    const result = locale === 'zh-CN'
      ? sqlite.prepare("UPDATE site_content SET hero_tagline = ?, home_content_version = home_content_version + 1, updated_at = ? WHERE id = 'site' AND home_content_version = ?").run((parsed.data as { tagline: string | null }).tagline, now, expectedVersion)
      : sqlite.prepare(`INSERT INTO site_content_translations (locale, section, fields_json, version, updated_at)
          SELECT @locale, @section, @fields, 1, @now WHERE @expectedVersion = 0
          ON CONFLICT(locale, section) DO NOTHING`).run({ locale, section, fields: JSON.stringify(parsed.data), now, expectedVersion })
    const changes = result.changes || (locale !== 'zh-CN' && expectedVersion > 0
      ? sqlite.prepare(`UPDATE site_content_translations SET fields_json = ?, version = version + 1, updated_at = ?
          WHERE locale = ? AND section = ? AND version = ?`).run(JSON.stringify(parsed.data), now, locale, section, expectedVersion).changes : 0)
    if (changes !== 1) throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
    sqlite.prepare(`INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, result, created_at)
      VALUES (?, ?, 'SITE_LOCALIZED_COPY_UPDATE', 'SITE', ?, 'SUCCESS', ?)`).run(randomUUID(), actor, `${locale}:${section}`, now)
  })()
  return getAdminSiteCopy(sqlite, locale)
}
