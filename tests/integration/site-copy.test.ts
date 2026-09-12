import { migrationsThrough } from '../helpers/migrations'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { migrateDatabase, migrationState, openDatabase } from '../../server/utils/database'
import { getAdminSiteCopy, getPublicSiteCopy } from '../../server/utils/repository/site-copy-repository'
import { saveSiteCopy } from '../../server/utils/service/site-copy'
import { xContactUrlSchema } from '../../shared/schemas/contact-url'
import { getAdminSiteContent, updateSiteContentSection, getPublicSiteContent } from '../../server/utils/service/site-content'
import { localizedSiteCopy } from '../../shared/utils/site-copy'
import { siteCopyLocaleSchema } from '../../shared/schemas/site-copy'

it('upgrades Chinese content without loss, preserves translations on rerun, and isolates locale/section CAS', async () => {
  const folder = mkdtempSync(resolve(tmpdir(), 'r7-copy-'))
  const file = resolve(folder, 'studio.db')
  const previous = migrationsThrough(file, '0053_r6_image_compositions')
  expect(() => migrationsThrough(file, 'missing-migration')).toThrow(/Unknown migration tag/)
  try {
    await migrateDatabase(file, { migrationsFolder: previous })
    const old = openDatabase(file).sqlite
    old.prepare("UPDATE site_content SET about_studio_facts = '原有介绍', about_making_scope = NULL WHERE id = 'site'").run()
    const before = old.prepare("SELECT * FROM site_content WHERE id = 'site'").get() as Record<string, unknown>
    old.close()
    expect(await migrateDatabase(file)).toMatchObject({ applied: 2, backupFile: expect.any(String) })
    const sqlite = openDatabase(file).sqlite
    try {
      expect(sqlite.prepare("SELECT * FROM site_content WHERE id = 'site'").get()).toMatchObject(before)
      expect(migrationState(sqlite, previous).historyMatches).toBe(false)
      const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      sqlite.prepare("INSERT INTO users (id, username, password_hash, password_changed_at, created_at, updated_at) VALUES (?, 'copy-test', 'hash', 1, 1, 1)").run(actor)
      const contact = getAdminSiteContent(sqlite)
      expect(contact.contact.xContactUrl).toBe('https://x.com/jece9925')
      const shared = {
        email: contact.contact.email,
        officialChannelsJson: JSON.stringify(contact.contact.officialChannels),
        commissionNotificationRecipientsJson: JSON.stringify(contact.contact.commissionNotificationRecipients),
      }
      updateSiteContentSection(sqlite, 'contact', contact.sectionVersions.contact, { ...shared, xContactUrl: 'https://x.com/updated_account' }, actor)
      expect(() => updateSiteContentSection(sqlite, 'contact', contact.sectionVersions.contact, shared, actor)).toThrow(/stale/)
      // Old callers omit the new field; they must preserve the edited address.
      updateSiteContentSection(sqlite, 'contact', contact.sectionVersions.contact + 1, shared, actor)
      expect(getPublicSiteContent(sqlite, 'https://media.example.test').contact.xContactUrl).toBe('https://x.com/updated_account')
      for (const invalid of ['javascript:alert(1)', 'https://x.com.evil.test/user', 'https://evil.test/x', 'https://x.com/user?redirect=bad', 'http://x.com/user']) expect(xContactUrlSchema.safeParse(invalid).success).toBe(false)
      expect(xContactUrlSchema.parse(' https://x.com/example/ ')).toBe('https://x.com/example')
      const en = getAdminSiteCopy(sqlite, 'en')
      const zh = getAdminSiteCopy(sqlite, 'zh-CN')
      expect(en.sections.about.fields.studioFacts).toContain('DITE DOG')
      saveSiteCopy(sqlite, 'en', 'about', en.sections.about.version, { studioFacts: 'Custom English', makingScope: null }, actor)
      expect(() => saveSiteCopy(sqlite, 'en', 'about', en.sections.about.version, en.sections.about.fields, actor)).toThrow(/stale/)
      saveSiteCopy(sqlite, 'en', 'commission', en.sections.commission.version, { ...en.sections.commission.fields, intro: null }, actor)
      saveSiteCopy(sqlite, 'zh-CN', 'about', zh.sections.about.version, { studioFacts: '新的中文', makingScope: null }, actor)
      const copy = getPublicSiteCopy(sqlite)
      expect(localizedSiteCopy(copy, 'en', 'about')).toEqual({ studioFacts: 'Custom English', makingScope: null })
      expect(localizedSiteCopy(copy, 'ja', 'about').studioFacts).toBe('新的中文')
      expect(localizedSiteCopy(copy, 'en', 'commission').intro).toBe(copy['zh-CN']!.commission.intro)
      expect(getAdminSiteCopy(sqlite, 'en').sections.commission.fields.intro).toBeNull()
      expect(() => saveSiteCopy(sqlite, 'en', 'home', en.sections.home.version, { tagline: '<script>bad</script>' }, actor)).toThrow(/invalid/)
      expect(() => saveSiteCopy(sqlite, 'en', 'home', en.sections.home.version, { tagline: 'valid', secret: 'bad' }, actor)).toThrow(/invalid/)
      expect(siteCopyLocaleSchema.safeParse('ja').success).toBe(false)
      saveSiteCopy(sqlite, 'zh-CN', 'home', zh.sections.home.version, { tagline: null }, actor)
      // New languages are rows, with no database migration. They remain private until enabled.
      sqlite.prepare("INSERT INTO site_content_translations VALUES ('ja', 'home', '{\"tagline\":\"draft\"}', 1, 1)").run()
      expect(getPublicSiteCopy(sqlite)).not.toHaveProperty('ja')
      expect(sqlite.pragma('foreign_key_check')).toEqual([])
      expect(sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally { sqlite.close() }
    expect(await migrateDatabase(file)).toMatchObject({ applied: 0 })
    const rerun = openDatabase(file).sqlite
    try { expect(getAdminSiteCopy(rerun, 'en').sections.about.fields.studioFacts).toBe('Custom English') }
    finally { rerun.close() }
  }
  finally { rmSync(folder, { recursive: true, force: true }) }
})
