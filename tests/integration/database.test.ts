import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
  dirname,
  resolve,
} from 'node:path'
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  assertDatabaseMigrated,
  backupDatabase,
  DATABASE_BUSY_TIMEOUT_MS,
  DATABASE_MIGRATIONS_FOLDER,
  DEVELOPMENT_DATABASE_FILE,
  migrateDatabase,
  openDatabase,
  PRODUCTION_DATABASE_FILE,
  readSqlitePragmas,
  resolveDatabaseFile,
  restoreDatabase,
} from '../../server/utils/database'

const temporaryDirectories: string[] = []

/**
 * 迁移总数由 journal 推导，而不是硬编码。
 * 每加一个前向迁移就要改四处数字，本身没有验证价值，还会掩盖真正的回归。
 */
function currentMigrationCount() {
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: unknown[] }
  return journal.entries.length
}

function migrationCountFrom(tag: string) {
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const index = journal.entries.findIndex(entry => entry.tag === tag)
  if (index < 0) {
    throw new Error(`Migration ${tag} is missing from the journal.`)
  }
  return journal.entries.length - index
}

function temporaryDatabase(name = 'studio.db') {
  const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-db-'))
  temporaryDirectories.push(directory)
  return resolve(directory, name)
}

function migrationsBeforeGate07(databaseFile: string) {
  const folder = resolve(dirname(databaseFile), 'pre-gate07-migrations')
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  for (const { tag } of journal.entries.slice(0, 7)) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({
    ...journal,
    entries: journal.entries.slice(0, 7),
  }))
  return folder
}

function migrationsBeforeT23(databaseFile: string) {
  const folder = resolve(dirname(databaseFile), 'pre-t23-migrations')
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  for (const { tag } of journal.entries.slice(0, 11)) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({
    ...journal,
    entries: journal.entries.slice(0, 11),
  }))
  return folder
}

function migrationsBeforeContactChannels(databaseFile: string) {
  const folder = resolve(dirname(databaseFile), 'pre-contact-channels-migrations')
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const entries = journal.entries.slice(0, journal.entries.findIndex(
    entry => entry.tag === '0027_requirement_2_contact_channels',
  ))
  for (const { tag } of entries) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({
    ...journal,
    entries,
  }))
  return folder
}

function migrationsBeforeCommissionEmailFaq(databaseFile: string) {
  const folder = resolve(dirname(databaseFile), 'pre-commission-email-faq-migrations')
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const entries = journal.entries.slice(0, journal.entries.findIndex(
    entry => entry.tag === '0029_requirement_2_commission_email_faq',
  ))
  for (const { tag } of entries) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({
    ...journal,
    entries,
  }))
  return folder
}

function migrationsBeforeUpdates(databaseFile: string) {
  const folder = resolve(dirname(databaseFile), 'pre-requirement-2-updates-migrations')
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const entries = journal.entries.slice(0, journal.entries.findIndex(
    entry => entry.tag === '0030_requirement_2_updates',
  ))
  for (const { tag } of entries) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({
    ...journal,
    entries,
  }))
  return folder
}

function migrationsBeforeUpdatesAnalytics(databaseFile: string) {
  const folder = resolve(dirname(databaseFile), 'pre-updates-analytics-migrations')
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const entries = journal.entries.slice(0, journal.entries.findIndex(
    entry => entry.tag === '0031_requirement_2_updates_analytics',
  ))
  for (const { tag } of entries) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({
    ...journal,
    entries,
  }))
  return folder
}

function migrationsBeforeContactQrAdaptation(databaseFile: string) {
  const folder = resolve(dirname(databaseFile), 'pre-contact-qr-adaptation-migrations')
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const entries = journal.entries.slice(0, journal.entries.findIndex(
    entry => entry.tag === '0032_requirement_2_contact_qr_upscale',
  ))
  for (const { tag } of entries) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({
    ...journal,
    entries,
  }))
  return folder
}

function migrationsBeforeVisitorCopy(databaseFile: string) {
  const folder = resolve(dirname(databaseFile), 'pre-visitor-copy-migrations')
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const entries = journal.entries.slice(0, journal.entries.findIndex(
    entry => entry.tag === '0033_requirement_2_visitor_copy',
  ))
  for (const { tag } of entries) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({
    ...journal,
    entries,
  }))
  return folder
}

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory => rmSync(
    directory,
    {
      force: true,
      recursive: true,
    },
  ))
})

describe('SQLite foundation', () => {
  it('migrates an empty database and repeated migration is idempotent', async () => {
    const databaseFile = temporaryDatabase()

    expect(() => assertDatabaseMigrated(databaseFile))
      .toThrow(/run pnpm db:migrate first/)
    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: currentMigrationCount(),
      backupFile: undefined,
    })
    expect(() => assertDatabaseMigrated(databaseFile)).not.toThrow()
    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: 0,
      backupFile: undefined,
    })

    const database = openDatabase(databaseFile)

    try {
      expect(database.sqlite.prepare(`
        SELECT COUNT(*)
        FROM sqlite_master
        WHERE type = 'table' AND name = '__drizzle_migrations'
      `).pluck().get()).toBe(1)
      expect(database.sqlite.prepare(`
        SELECT COUNT(*) FROM __drizzle_migrations
      `).pluck().get()).toBe(currentMigrationCount())
      const siteContent = database.sqlite.prepare(`
        SELECT commission_intro AS commissionIntro,
               commission_email_action AS commissionEmailAction,
               about_studio_facts AS aboutStudioFacts,
               basic_terms AS basicTerms,
               privacy_policy AS privacyPolicy,
               contact_anti_scam AS contactAntiScam,
               official_channels_json AS officialChannelsJson
        FROM site_content WHERE id = 'site'
      `).get() as {
        aboutStudioFacts: string
        basicTerms: string
        commissionEmailAction: string
        commissionIntro: string
        contactAntiScam: string
        officialChannelsJson: string
        privacyPolicy: string
      }
      expect(siteContent.commissionIntro).toContain('逐单估价')
      expect(siteContent.commissionEmailAction).toContain('邮箱')
      const siteContentColumns = database.sqlite.pragma(
        'table_info(site_content)',
      ) as { name: string }[]
      expect(siteContentColumns.map(column => column.name))
        .not.toContain('commission_faq_json')
      expect(siteContentColumns.map(column => column.name))
        .not.toContain('commission_faq_version')
      expect(siteContent.aboutStudioFacts).toBe('有点小狗工作室制作全装和半装兽装，并在本站展示已完成的作品。')
      expect(siteContent.basicTerms).toContain('著作权归有点小狗工作室')
      expect(siteContent.basicTerms).toContain('签收之日起一年')
      expect(siteContent.privacyPolicy).toContain('不提供访客账号')
      expect(siteContent.privacyPolicy).toContain('不接入第三方统计平台')
      expect(siteContent.privacyPolicy).toContain('原始记录保留 90 天')
      expect(siteContent.privacyPolicy).not.toContain('未来如新增')
      expect(siteContent.contactAntiScam).toContain('另一条已公布渠道核实')
      expect(JSON.parse(siteContent.officialChannelsJson)).toEqual([
        { platform: 'qq', account: '765678159', qrCodeAssetId: null },
        { platform: 'qq_group', account: '1040925427', qrCodeAssetId: null },
      ])
      expect(database.sqlite.prepare(`
        SELECT kind, tone, label, href
        FROM business_statuses ORDER BY kind
      `).all()).toEqual([
        {
          kind: 'adoption',
          tone: 'limited',
          label: '领养信息以页面为准',
          href: '/adoptions',
        },
        {
          kind: 'commission',
          tone: 'limited',
          label: '委托咨询开放',
          href: '/commission',
        },
      ])
    }
    finally {
      database.sqlite.close()
    }
  })

  it('contracts legacy QQ and Douyin into the retained QQ channel', async () => {
    const databaseFile = temporaryDatabase()
    await migrateDatabase(databaseFile, {
      migrationsFolder: migrationsBeforeContactChannels(databaseFile),
    })
    const legacy = openDatabase(databaseFile)
    try {
      legacy.sqlite.prepare(`
        UPDATE site_content
        SET contact_qq = '123456789', contact_douyin = 'legacy.douyin'
        WHERE id = 'site'
      `).run()
    }
    finally {
      legacy.sqlite.close()
    }

    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: migrationCountFrom('0027_requirement_2_contact_channels'),
    })
    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: 0,
    })
    const upgraded = openDatabase(databaseFile)
    try {
      const row = upgraded.sqlite.prepare(`
        SELECT contact_qq AS qq, official_channels_json AS channels
        FROM site_content WHERE id = 'site'
      `).get() as { channels: string, qq: string }
      expect(row.qq).toBe('123456789')
      expect(JSON.parse(row.channels)).toEqual([
        { platform: 'qq', account: '123456789', qrCodeAssetId: null },
        { platform: 'qq_group', account: '1040925427', qrCodeAssetId: null },
      ])
      expect((upgraded.sqlite.pragma('table_info(site_content)') as { name: string }[])
        .some(column => column.name === 'contact_douyin')).toBe(false)
      expect(upgraded.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally {
      upgraded.sqlite.close()
    }
  })

  it('contracts historical commission FAQ without deleting the backup email action', async () => {
    const databaseFile = temporaryDatabase()
    await migrateDatabase(databaseFile, {
      migrationsFolder: migrationsBeforeCommissionEmailFaq(databaseFile),
    })
    const legacy = openDatabase(databaseFile)
    const existingFaqs = Array.from({ length: 8 }, (_, index) => ({
      id: `${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`,
      question: `已有问题 ${index + 1}`,
      answer: `已有回答 ${index + 1}`,
    }))
    const expectedEmailAction = '保留的备用邮件说明。'
    try {
      legacy.sqlite.prepare(`
        UPDATE site_content
        SET commission_faq_json = ?, commission_email_action = ?
        WHERE id = 'site'
      `).run(JSON.stringify(existingFaqs), expectedEmailAction)
    }
    finally {
      legacy.sqlite.close()
    }

    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: migrationCountFrom('0029_requirement_2_commission_email_faq'),
    })
    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({ applied: 0 })
    const upgraded = openDatabase(databaseFile)
    try {
      const columns = (upgraded.sqlite.pragma(
        'table_info(site_content)',
      ) as { name: string }[]).map(column => column.name)
      expect(columns).not.toContain('commission_faq_json')
      expect(columns).not.toContain('commission_faq_version')
      expect(upgraded.sqlite.prepare(`
        SELECT commission_email_action
        FROM site_content WHERE id = 'site'
      `).pluck().get()).toBe(expectedEmailAction)
      expect(upgraded.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally {
      upgraded.sqlite.close()
    }
  })

  it('preserves unrelated content while historical updates is later contracted', async () => {
    const databaseFile = temporaryDatabase()
    await migrateDatabase(databaseFile, {
      migrationsFolder: migrationsBeforeUpdates(databaseFile),
    })
    const legacy = openDatabase(databaseFile)
    try {
      expect(legacy.sqlite.prepare(`
        SELECT count(*) FROM sqlite_master
        WHERE type = 'table' AND name = 'updates'
      `).pluck().get()).toBe(0)
      legacy.sqlite.prepare(`
        UPDATE site_content SET contact_email = 'kept@example.test'
        WHERE id = 'site'
      `).run()
    }
    finally {
      legacy.sqlite.close()
    }

    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: migrationCountFrom('0030_requirement_2_updates'),
    })
    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({ applied: 0 })
    const upgraded = openDatabase(databaseFile)
    try {
      expect(upgraded.sqlite.prepare(`
        SELECT count(*) FROM sqlite_master
        WHERE type = 'table' AND name = 'updates'
      `).pluck().get()).toBe(0)
      expect(upgraded.sqlite.prepare(`
        SELECT contact_email FROM site_content WHERE id = 'site'
      `).pluck().get()).toBe('kept@example.test')
      expect(upgraded.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(upgraded.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally {
      upgraded.sqlite.close()
    }
  })

  it('preserves existing analytics while the updates route is later contracted', async () => {
    const databaseFile = temporaryDatabase()
    await migrateDatabase(databaseFile, {
      migrationsFolder: migrationsBeforeUpdatesAnalytics(databaseFile),
    })
    const legacy = openDatabase(databaseFile)
    try {
      legacy.sqlite.prepare(`
        INSERT INTO analytics_events (
          occurred_at, event_type, route_key,
          entity_type, entity_id, action_key, session_hmac
        ) VALUES (?, 'page_view', 'home', NULL, NULL, NULL, ?)
      `).run(Date.UTC(2026, 7, 12), 'a'.repeat(64))
      expect(() => legacy.sqlite.prepare(`
        INSERT INTO analytics_events (
          occurred_at, event_type, route_key,
          entity_type, entity_id, action_key, session_hmac
        ) VALUES (?, 'page_view', 'updates', NULL, NULL, NULL, ?)
      `).run(Date.UTC(2026, 7, 12), 'b'.repeat(64)))
        .toThrow(/analytics_events_route_key/u)
    }
    finally {
      legacy.sqlite.close()
    }

    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: migrationCountFrom('0031_requirement_2_updates_analytics'),
    })
    const upgraded = openDatabase(databaseFile)
    try {
      expect(upgraded.sqlite.prepare(`
        SELECT route_key FROM analytics_events ORDER BY id
      `).pluck().all()).toEqual(['home'])
      expect(() => upgraded.sqlite.prepare(`
        INSERT INTO analytics_events (
          occurred_at, event_type, route_key,
          entity_type, entity_id, action_key, session_hmac
        ) VALUES (?, 'page_view', 'updates', NULL, NULL, NULL, ?)
      `).run(Date.UTC(2026, 7, 12) + 1, 'b'.repeat(64)))
        .toThrow(/analytics_events_route_key/u)
      expect(upgraded.sqlite.prepare(`
        SELECT route_key FROM analytics_events ORDER BY id
      `).pluck().all()).toEqual(['home'])
      expect(upgraded.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(upgraded.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
      expect(upgraded.sqlite.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'index' AND name = 'analytics_events_route_occurred_idx'
      `).pluck().get()).toBe('analytics_events_route_occurred_idx')
    }
    finally {
      upgraded.sqlite.close()
    }
  })

  it('updates only untouched visitor copy and advances affected section versions once', async () => {
    const databaseFile = temporaryDatabase()
    await migrateDatabase(databaseFile, {
      migrationsFolder: migrationsBeforeVisitorCopy(databaseFile),
    })
    const legacy = openDatabase(databaseFile)
    let before!: Record<string, number>
    try {
      before = legacy.sqlite.prepare(`
        SELECT version,
               commission_content_version AS commission,
               about_content_version AS about,
               terms_content_version AS terms,
               privacy_content_version AS privacy,
               contact_content_version AS contact
        FROM site_content WHERE id = 'site'
      `).get() as Record<string, number>
      legacy.sqlite.prepare(`
        UPDATE site_content
        SET commission_estimate_note = '管理员自定义估价说明',
            about_studio_facts = '管理员自定义工作室介绍',
            basic_terms = '管理员自定义服务条款',
            contact_anti_scam = '管理员自定义防诈骗提醒'
        WHERE id = 'site'
      `).run()
    }
    finally {
      legacy.sqlite.close()
    }

    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: migrationCountFrom('0033_requirement_2_visitor_copy'),
    })
    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({ applied: 0 })
    const upgraded = openDatabase(databaseFile)
    try {
      const row = upgraded.sqlite.prepare(`
        SELECT version,
               commission_intro AS commissionIntro,
               commission_estimate_note AS commissionEstimateNote,
               commission_email_action AS commissionEmailAction,
               commission_content_version AS commissionVersion,
               about_studio_facts AS aboutStudioFacts,
               about_making_scope AS aboutMakingScope,
               about_content_version AS aboutVersion,
               basic_terms AS basicTerms,
               terms_content_version AS termsVersion,
               privacy_policy AS privacyPolicy,
               privacy_content_version AS privacyVersion,
               contact_anti_scam AS contactAntiScam,
               contact_content_version AS contactVersion
        FROM site_content WHERE id = 'site'
      `).get() as Record<string, number | string>

      expect(row.commissionIntro).toContain('确认可行性后逐单估价')
      expect(row.commissionEstimateNote).toBe('管理员自定义估价说明')
      expect(row.commissionEmailAction).toContain('复制邮箱地址发送')
      expect(row.commissionVersion).toBe(before.commission + 1)
      expect(row.aboutStudioFacts).toBe('管理员自定义工作室介绍')
      expect(row.aboutMakingScope).toContain('确认委托前沟通')
      expect(row.aboutVersion).toBe(before.about + 1)
      expect(row.basicTerms).toBe('管理员自定义服务条款')
      expect(row.termsVersion).toBe(before.terms)
      expect(row.privacyPolicy).toContain('原始记录保留 90 天')
      expect(row.privacyPolicy).not.toContain('未来如新增')
      expect(row.privacyVersion).toBe(before.privacy + 1)
      expect(row.contactAntiScam).toBe('管理员自定义防诈骗提醒')
      // visitor copy 与 0042 默认联系方式各推进 contact 一次。
      expect(row.contactVersion).toBe(before.contact + 2)
      expect(row.version).toBe(before.version + 6)
      expect(upgraded.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally {
      upgraded.sqlite.close()
    }
  })

  it('widens contact QR inputs while preserving data and cross-table triggers', async () => {
    const databaseFile = temporaryDatabase()
    await migrateDatabase(databaseFile, {
      migrationsFolder: migrationsBeforeContactQrAdaptation(databaseFile),
    })
    const legacy = openDatabase(databaseFile)
    let triggerNames: string[]
    try {
      const now = Date.UTC(2026, 7, 13)
      legacy.sqlite.prepare(`
        INSERT INTO assets (
          id, role, status, private_object_key, sha256, byte_size,
          mime_type, width, height, fit_mode, created_at, updated_at
        ) VALUES (?, 'contact_qr', 'READY', ?, ?, 1024,
                  'image/png', 320, 320, 'contain', ?, ?)
      `).run(
        '93939393-9393-4939-8939-939393939393',
        'test/contact-before-upgrade.png',
        '9'.repeat(64),
        now,
        now,
      )
      triggerNames = legacy.sqlite.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'trigger'
          AND (sql LIKE '%assets%' OR sql LIKE '%upload_sessions%')
        ORDER BY name
      `).pluck().all() as string[]
    }
    finally {
      legacy.sqlite.close()
    }

    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: migrationCountFrom('0032_requirement_2_contact_qr_upscale'),
    })
    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({ applied: 0 })
    const upgraded = openDatabase(databaseFile)
    try {
      expect(upgraded.sqlite.prepare(`
        SELECT mime_type, width, height FROM assets
        WHERE id = '93939393-9393-4939-8939-939393939393'
      `).get()).toEqual({ mime_type: 'image/png', width: 320, height: 320 })
      expect(upgraded.sqlite.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'trigger'
          AND (sql LIKE '%assets%' OR sql LIKE '%upload_sessions%')
        ORDER BY name
      `).pluck().all()).toEqual(expect.arrayContaining(
        triggerNames.filter(name => (
          !name.startsWith('return_photos_')
          && !name.startsWith('work_assets_design_sheet_primary_')
          && name !== 'works_preserve_design_sheet_purpose'
        )),
      ))
      expect(() => upgraded.sqlite.prepare(`
        INSERT INTO assets (
          id, role, status, private_object_key, sha256, byte_size,
          mime_type, width, height, fit_mode, created_at, updated_at
        ) VALUES (?, 'contact_qr', 'PENDING', ?, ?, 1024,
                  'image/jpeg', 640, 320, 'contain', ?, ?)
      `).run(
        '94949494-9494-4949-8949-949494949494',
        'test/contact-after-upgrade.jpg',
        '8'.repeat(64),
        Date.UTC(2026, 7, 13),
        Date.UTC(2026, 7, 13),
      )).not.toThrow()
      expect(upgraded.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(upgraded.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally {
      upgraded.sqlite.close()
    }
  })

  it('upgrades existing self-referencing variants without losing integrity', async () => {
    const databaseFile = temporaryDatabase()
    await migrateDatabase(databaseFile, {
      migrationsFolder: migrationsBeforeGate07(databaseFile),
    })
    const legacy = openDatabase(databaseFile)

    try {
      const now = Date.UTC(2026, 7, 1)
      const assetSha = 'a'.repeat(64)
      const sourceSha = 'b'.repeat(64)
      legacy.sqlite.prepare(`
        INSERT INTO assets (
          id, role, status, private_object_key, sha256, byte_size,
          mime_type, width, height, created_at, updated_at
        ) VALUES (
          'asset', 'studio_photo', 'READY', 'dev/original/asset.png',
          ?, 1024, 'image/png', 1600, 900, ?, ?
        )
      `).run(assetSha, now, now)
      legacy.sqlite.prepare(`
        INSERT INTO asset_variants (
          id, asset_id, source_variant_id, storage_scope, status, object_key,
          input_sha256, media_role, usage, width, height, format, quality,
          crop_identity, recipe_version, watermark_profile, logo_digest,
          watermark_anchor, sha256, byte_size, created_at, updated_at
        ) VALUES (
          'source', 'asset', NULL, 'PRIVATE', 'READY',
          'dev/processing/source.png', ?, 'studio_photo', 'preprocess',
          1600, 900, 'png', 82, 'source-crop', 'recipe-v1', 'none',
          'none', 'none', ?, 2048, ?, ?
        )
      `).run(assetSha, sourceSha, now, now)
      legacy.sqlite.prepare(`
        INSERT INTO asset_variants (
          id, asset_id, source_variant_id, storage_scope, status, object_key,
          input_sha256, media_role, usage, width, height, format, quality,
          crop_identity, recipe_version, watermark_profile, logo_digest,
          watermark_anchor, sha256, byte_size, created_at, updated_at
        ) VALUES (
          'public', 'asset', 'source', 'PUBLIC', 'READY',
          'dev/web/public.webp', ?, 'studio_photo', 'detail',
          1280, 720, 'webp', 82, 'public-crop', 'recipe-v1',
          'brand-standard-v1', ?, 'top-left', ?, 1024, ?, ?
        )
      `).run(sourceSha, 'c'.repeat(64), 'd'.repeat(64), now, now)
    }
    finally {
      legacy.sqlite.close()
    }

    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      // 从 GATE-07 前的历史库继续升级：剩余迁移数随新增迁移增长。
      applied: currentMigrationCount() - 7,
    })
    const upgraded = openDatabase(databaseFile)
    try {
      expect(upgraded.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(upgraded.sqlite.prepare(`
        SELECT source_variant_id FROM asset_variants WHERE id = 'public'
      `).pluck().get()).toBe('source')
    }
    finally {
      upgraded.sqlite.close()
    }
  })

  it('migrates an existing published studio-photo relation without touching its private original', async () => {
    const databaseFile = temporaryDatabase()
    await migrateDatabase(databaseFile, {
      migrationsFolder: migrationsBeforeT23(databaseFile),
    })
    const legacy = openDatabase(databaseFile)
    const privateKey = 'prod/original/t21/source.png'
    try {
      const now = Date.UTC(2026, 7, 2)
      legacy.sqlite.prepare(`
        INSERT INTO works (
          id, slug, character_name, species, suit_type, purpose,
          owner_display, publication_status, created_at, updated_at
        ) VALUES (
          't21-work', 't21-work', '旧作品', '犬科', 'full', 'showcase',
          '不公开', 'published', ?, ?
        )
      `).run(now, now)
      legacy.sqlite.prepare(`
        INSERT INTO assets (
          id, role, status, private_object_key, sha256, byte_size,
          mime_type, width, height, created_at, updated_at
        ) VALUES (
          't21-photo', 'studio_photo', 'READY', ?, ?, 1024,
          'image/png', 3200, 2400, ?, ?
        )
      `).run(privateKey, 'a'.repeat(64), now, now)
      legacy.sqlite.prepare(`
        INSERT INTO work_assets (
          work_id, asset_id, role, alt_text, position, is_primary
        ) VALUES (
          't21-work', 't21-photo', 'studio_photo', '旧作品出厂照', 0, 1
        )
      `).run()
    }
    finally {
      legacy.sqlite.close()
    }

    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      // 从 T23 前的历史库继续升级。
      applied: currentMigrationCount() - 11,
    })
    const upgraded = openDatabase(databaseFile)
    try {
      expect(upgraded.sqlite.prepare(`
        SELECT
          work.publication_status AS publicationStatus,
          relation.position,
          relation.is_primary AS "primary",
          asset.private_object_key AS privateObjectKey
        FROM works AS work
        JOIN work_assets AS relation ON relation.work_id = work.id
        JOIN assets AS asset ON asset.id = relation.asset_id
        WHERE work.id = 't21-work'
      `).get()).toEqual({
        publicationStatus: 'published',
        position: 0,
        primary: 1,
        privateObjectKey: privateKey,
      })
      expect(upgraded.sqlite.pragma('foreign_key_check')).toEqual([])
    }
    finally {
      upgraded.sqlite.close()
    }
  })

  it('enforces the required PRAGMAs on every connection', () => {
    const database = openDatabase(temporaryDatabase())

    try {
      expect(readSqlitePragmas(database.sqlite)).toEqual({
        busyTimeout: DATABASE_BUSY_TIMEOUT_MS,
        foreignKeys: 1,
        journalMode: 'wal',
        synchronous: 2,
      })
    }
    finally {
      database.sqlite.close()
    }
  })

  it('keeps temporary test databases isolated', () => {
    const first = openDatabase(temporaryDatabase('first.db'))
    const second = openDatabase(temporaryDatabase('second.db'))

    try {
      first.sqlite.exec('CREATE TABLE marker (value TEXT NOT NULL)')
      first.sqlite.prepare('INSERT INTO marker VALUES (?)').run('first')

      expect(first.sqlite.prepare('SELECT value FROM marker').pluck().get())
        .toBe('first')
      expect(second.sqlite.prepare(`
        SELECT COUNT(*)
        FROM sqlite_master
        WHERE type = 'table' AND name = 'marker'
      `).pluck().get()).toBe(0)
    }
    finally {
      first.sqlite.close()
      second.sqlite.close()
    }
  })

  it('creates a consistent online backup without copying the active db file', async () => {
    const databaseFile = temporaryDatabase('source.db')
    const backupFile = temporaryDatabase('backup.db')
    const source = openDatabase(databaseFile)

    try {
      source.sqlite.exec('CREATE TABLE marker (value TEXT NOT NULL)')
      source.sqlite.prepare('INSERT INTO marker VALUES (?)').run('saved')

      await expect(backupDatabase(databaseFile, backupFile))
        .resolves.toBe(backupFile)

      const backup = openDatabase(backupFile)
      try {
        expect(backup.sqlite.prepare('SELECT value FROM marker').pluck().get())
          .toBe('saved')
      }
      finally {
        backup.sqlite.close()
      }
    }
    finally {
      source.sqlite.close()
    }
  })

  it('does not create a database while backing up a missing source', async () => {
    const databaseFile = temporaryDatabase('missing.db')
    const backupFile = temporaryDatabase('backup.db')

    await expect(backupDatabase(databaseFile, backupFile))
      .rejects.toThrow(/does not exist or is empty/)
  })

  it('restores a current online backup only to a new non-active path', async () => {
    const databaseFile = temporaryDatabase('source.db')
    const backupFile = temporaryDatabase('backup.db')
    const restoredFile = temporaryDatabase('restored.db')
    await migrateDatabase(databaseFile)
    const source = openDatabase(databaseFile)

    try {
      source.sqlite.prepare(`
        UPDATE site_content SET hero_tagline = '恢复冒烟', version = version + 1
        WHERE id = 'site'
      `).run()
      await backupDatabase(databaseFile, backupFile)
    }
    finally {
      source.sqlite.close()
    }

    await expect(restoreDatabase(backupFile, restoredFile, {
      activeDatabaseFile: databaseFile,
    })).resolves.toBe(restoredFile)
    const restored = openDatabase(restoredFile)
    try {
      expect(restored.sqlite.prepare(`
        SELECT hero_tagline FROM site_content WHERE id = 'site'
      `).pluck().get()).toBe('恢复冒烟')
      expect(restored.sqlite.pragma('foreign_key_check')).toEqual([])
    }
    finally {
      restored.sqlite.close()
    }

    await expect(restoreDatabase(backupFile, restoredFile))
      .rejects.toThrow(/destination already exists/)
    await expect(restoreDatabase(backupFile, databaseFile, {
      activeDatabaseFile: databaseFile,
    })).rejects.toThrow(/active database/)
  })

  it('rejects invalid or stale backups without leaving a target database', async () => {
    const invalidBackup = temporaryDatabase('invalid.db')
    const invalidOutput = temporaryDatabase('invalid-output.db')
    writeFileSync(invalidBackup, 'not a sqlite database')

    await expect(restoreDatabase(invalidBackup, invalidOutput)).rejects.toThrow()
    expect(existsSync(invalidOutput)).toBe(false)

    const staleDatabase = temporaryDatabase('stale.db')
    const staleBackup = temporaryDatabase('stale-backup.db')
    const staleOutput = temporaryDatabase('stale-output.db')
    await migrateDatabase(staleDatabase, {
      migrationsFolder: migrationsBeforeT23(staleDatabase),
    })
    await backupDatabase(staleDatabase, staleBackup)

    await expect(restoreDatabase(staleBackup, staleOutput))
      .rejects.toThrow(/current migrations/)
    expect(existsSync(staleOutput)).toBe(false)

    const driftedDatabase = temporaryDatabase('drifted.db')
    const driftedBackup = temporaryDatabase('drifted-backup.db')
    const driftedOutput = temporaryDatabase('drifted-output.db')
    await migrateDatabase(driftedDatabase)
    const drifted = openDatabase(driftedDatabase)
    try {
      drifted.sqlite.prepare(`
        UPDATE __drizzle_migrations SET hash = ?
        WHERE created_at = (
          SELECT min(created_at) FROM __drizzle_migrations
        )
      `).run('0'.repeat(64))
    }
    finally {
      drifted.sqlite.close()
    }

    expect(() => assertDatabaseMigrated(driftedDatabase))
      .toThrow(/history does not match/)
    await expect(migrateDatabase(driftedDatabase))
      .rejects.toThrow(/history does not match/)
    await backupDatabase(driftedDatabase, driftedBackup)
    await expect(restoreDatabase(driftedBackup, driftedOutput))
      .rejects.toThrow(/current migrations/)
    expect(existsSync(driftedOutput)).toBe(false)
  })
})

describe('database path boundaries', () => {
  it('locks development to its file and production to the persistent volume', () => {
    const cwd = resolve(tmpdir(), 'fur-forge-project')

    expect(resolveDatabaseFile({
      appEnv: 'development',
      databaseFile: DEVELOPMENT_DATABASE_FILE,
    }, cwd)).toBe(resolve(cwd, DEVELOPMENT_DATABASE_FILE))
    expect(resolveDatabaseFile({
      appEnv: 'production',
      databaseFile: PRODUCTION_DATABASE_FILE,
    }, cwd)).toBe(PRODUCTION_DATABASE_FILE)
    expect(resolveDatabaseFile({
      appEnv: 'production',
      databaseFile: '/app/data/restored-20260810T010203Z.db',
    }, cwd)).toBe('/app/data/restored-20260810T010203Z.db')

    expect(() => resolveDatabaseFile({
      appEnv: 'development',
      databaseFile: 'other.db',
    }, cwd)).toThrow(/Development DATABASE_FILE/)
    expect(() => resolveDatabaseFile({
      appEnv: 'production',
      databaseFile: resolve(cwd, 'studio.db'),
    }, cwd)).toThrow(/Production DATABASE_FILE/)
    for (const databaseFile of [
      '/app/data/nested/restored.db',
      '/app/data/../restored.db',
      '/app/backups/restored.db',
      '/app/data/restored.sqlite',
    ]) {
      expect(() => resolveDatabaseFile({
        appEnv: 'production',
        databaseFile,
      }, cwd)).toThrow(/Production DATABASE_FILE/)
    }
  })

  it('requires tests to use an absolute temporary database', () => {
    const databaseFile = temporaryDatabase()

    expect(resolveDatabaseFile({
      appEnv: 'test',
      databaseFile,
    })).toBe(databaseFile)
    expect(() => resolveDatabaseFile({
      appEnv: 'test',
      databaseFile: DEVELOPMENT_DATABASE_FILE,
    })).toThrow(/system temporary directory/)
    expect(() => resolveDatabaseFile({
      appEnv: 'test',
      databaseFile: PRODUCTION_DATABASE_FILE,
    })).toThrow(/system temporary directory/)
  })
})
