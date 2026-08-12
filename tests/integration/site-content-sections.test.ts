import {
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import {
  getAdminSiteContent,
  getPublicSiteContent,
  updateSiteContentSection,
} from '../../server/utils/service/site-content'

/**
 * T34-F3 分区并发：不同分区同时保存都成功；同一分区第二次保存拿到 409。
 * 保存一个分区绝不携带或覆盖其它分区的值。
 */
const NOW = Date.UTC(2026, 7, 6)
const USER_ID = '99999999-9999-4999-8999-999999999999'
const FAQ_A = '11111111-1111-4111-8111-111111111111'
const FAQ_B = '22222222-2222-4222-8222-222222222222'
const officialChannels = (qq: string | null, douyin: string | null) => [
  { platform: 'qq', account: qq, qrCodeAssetId: null },
  { platform: 'douyin', account: douyin, qrCodeAssetId: null },
  { platform: 'qq_group', account: null, qrCodeAssetId: null },
  { platform: 'xiaohongshu', account: null, qrCodeAssetId: null },
  { platform: 'bilibili', account: null, qrCodeAssetId: null },
]

let directory: string
let sqlite: Database.Database

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-sections-'))
  const databaseFile = resolve(directory, 'sections.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'owner', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

function versions() {
  return getAdminSiteContent(sqlite).sectionVersions
}

describe('T34-F3 site content section concurrency', () => {
  it('exposes an independent version per section', () => {
    const initial = versions()
    expect(Object.keys(initial).sort()).toEqual([
      'about',
      'commission',
      'commissionFaq',
      'contact',
      'privacy',
      'terms',
    ])

    updateSiteContentSection(sqlite, 'commission', initial.commission, {
      intro: '新的委托简介',
      estimateNote: null,
      emailAction: null,
    }, USER_ID, NOW)

    const after = versions()
    // 只有被保存的分区版本推进，其它分区并发基线不变。
    expect(after.commission).toBe(initial.commission + 1)
    expect(after.commissionFaq).toBe(initial.commissionFaq)
    expect(after.about).toBe(initial.about)
    expect(after.terms).toBe(initial.terms)
    expect(after.privacy).toBe(initial.privacy)
    expect(after.contact).toBe(initial.contact)
  })

  it('lets two admins save different sections concurrently', () => {
    // 两个上下文同时读取同一份基线。
    const adminA = versions()
    const adminB = versions()

    updateSiteContentSection(sqlite, 'commission', adminA.commission, {
      intro: 'A 写的委托简介',
      estimateNote: null,
      emailAction: null,
    }, USER_ID, NOW)

    // B 用自己那份（对 about 而言仍然最新的）基线保存另一个分区：应当成功。
    expect(() => updateSiteContentSection(sqlite, 'about', adminB.about, {
      studioFacts: 'B 写的工作室介绍',
      makingScope: null,
    }, USER_ID, NOW + 1)).not.toThrow()

    const content = getAdminSiteContent(sqlite)
    // 两个分区的内容都在，互不覆盖。
    expect(content.commission.intro).toBe('A 写的委托简介')
    expect(content.about.studioFacts).toBe('B 写的工作室介绍')
  })

  it('rejects a stale save on the same section with 409', () => {
    const stale = versions().commission

    updateSiteContentSection(sqlite, 'commission', stale, {
      intro: '第一次保存',
      estimateNote: null,
      emailAction: null,
    }, USER_ID, NOW)

    expect(() => updateSiteContentSection(sqlite, 'commission', stale, {
      intro: '第二次保存',
      estimateNote: null,
      emailAction: null,
    }, USER_ID, NOW + 1)).toThrowError(
      expect.objectContaining({ statusCode: 409 }),
    )

    // 冲突后服务端仍保留第一次的值，不被第二次的旧草稿覆盖。
    expect(getAdminSiteContent(sqlite).commission.intro).toBe('第一次保存')
  })

  it('keeps FAQ stable ids through add, remove and reorder', () => {
    const before = versions().commissionFaq
    updateSiteContentSection(sqlite, 'commission-faq', before, {
      faqJson: JSON.stringify([
        { id: FAQ_A, question: '问一', answer: '答一' },
        { id: FAQ_B, question: '问二', answer: '答二' },
      ]),
    }, USER_ID, NOW)

    const stored = getAdminSiteContent(sqlite).commission.faqs
    expect(stored.map(faq => faq.id)).toEqual([FAQ_A, FAQ_B])

    // 重排只改顺序，ID 不变。
    updateSiteContentSection(sqlite, 'commission-faq', versions().commissionFaq, {
      faqJson: JSON.stringify([
        { id: FAQ_B, question: '问二', answer: '答二' },
        { id: FAQ_A, question: '问一', answer: '答一' },
      ]),
    }, USER_ID, NOW + 1)
    expect(getAdminSiteContent(sqlite).commission.faqs.map(faq => faq.id))
      .toEqual([FAQ_B, FAQ_A])

    // 删除一项不影响另一项的 ID。
    updateSiteContentSection(sqlite, 'commission-faq', versions().commissionFaq, {
      faqJson: JSON.stringify([
        { id: FAQ_A, question: '问一', answer: '答一改' },
      ]),
    }, USER_ID, NOW + 2)
    const remaining = getAdminSiteContent(sqlite).commission.faqs
    expect(remaining).toHaveLength(1)
    expect(remaining[0]!.id).toBe(FAQ_A)
    expect(remaining[0]!.answer).toBe('答一改')
  })

  it('never leaks section versions or private contact fields to the public DTO', () => {
    updateSiteContentSection(sqlite, 'contact', versions().contact, {
      email: 'studio@example.test',
      officialChannelsJson: JSON.stringify(officialChannels('3114559925', 'studio.official')),
      antiScam: '只认这些官方渠道。',
    }, USER_ID, NOW)

    const publicDto = getPublicSiteContent(sqlite, 'https://media.example.test')
    const serialized = JSON.stringify(publicDto)
    expect(serialized).not.toContain('sectionVersions')
    expect(serialized).not.toContain('commissionFaqVersion')
    expect(publicDto).not.toHaveProperty('version')
    expect(publicDto.contact.officialChannels).toEqual([])
    expect(serialized).not.toContain('qrCodeAssetId')
    // 公开 FAQ 仍带稳定 ID（供前端 key 使用），但不含任何版本字段。
    for (const faq of publicDto.commission.faqs) {
      expect(faq).toHaveProperty('id')
      expect(faq).not.toHaveProperty('version')
    }
  })
})
