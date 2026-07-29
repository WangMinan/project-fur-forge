import type { PublicWorkDto } from '../types/contracts'
import { PROJECT_NAME } from '../constants/project'

/**
 * T05 首页生产视觉样张的统一类型化夹具。
 *
 * 业务字段通过 `PublicWorkDto` 契约校验（见 tests/unit/visual-fixtures.test.ts）；
 * 媒体字段描述仓库内确定性夹具图片（public/fixtures/），不引入任何网络素材。
 * EXT-01 正式素材门禁通过后，由真实公开投影替换本模块。
 */

export interface FixtureFocalPoint {
  /** 百分比坐标，例如 '62% 38%'，写入 object-position。 */
  desktop: string
  mobile: string
}

export interface FixtureMedia {
  src: string
  alt: string
  width: number
  height: number
  focal: FixtureFocalPoint
}

export interface VisualWorkFixture {
  dto: PublicWorkDto
  /** recipe-v1 `card`：3:4。 */
  card: FixtureMedia
}

export interface BusinessStatusFixture {
  kind: 'commission' | 'adoption'
  tone: 'open' | 'paused' | 'neutral'
  label: string
  detail: string
  href: string
}

export interface RouteCardFixture {
  href: string
  title: string
  fact: string
  action: string
  media: FixtureMedia
}

const fixtureMedia = (
  src: string,
  alt: string,
  width: number,
  height: number,
  focal: FixtureFocalPoint = { desktop: '50% 42%', mobile: '50% 38%' },
): FixtureMedia => ({ src, alt, width, height, focal })

export const heroFixture = {
  studioName: PROJECT_NAME,
  englishName: 'dite dog',
  tagline: '为每一个角色，做一件认真的兽装。',
  action: {
    label: '浏览作品展示',
    href: '/works',
  },
  scrollHint: '向下浏览',
  media: fixtureMedia(
    '/fixtures/works/hero-naigai.svg',
    '奶油色猫咪全装「奶盖」的工作室出厂照',
    1920,
    1080,
    { desktop: '64% 40%', mobile: '50% 36%' },
  ),
} as const

export const visualWorkFixtures: VisualWorkFixture[] = [
  {
    dto: {
      id: 'b943ee7e-0e9a-4944-a36b-ed61b8b9a640',
      version: 1,
      slug: 'blueberry',
      characterName: '蓝莓',
      species: '北极狐',
      suitType: 'full',
      ownerDisplay: '不公开',
      featureTags: ['纯海绵头', '内置风扇', '全装掉落', '即买即穿'],
      purpose: 'adoption',
      adoptionMethod: 'event_drop',
      businessStatus: 'available',
      price: {
        currency: 'CNY',
        minorUnits: 1_560_000,
      },
    },
    card: fixtureMedia(
      '/fixtures/works/card-blueberry.svg',
      '蓝白北极狐全装「蓝莓」出厂照',
      1200,
      1600,
    ),
  },
  {
    dto: {
      id: 'd12df17a-fbc0-451b-a3b5-1f401342a91b',
      version: 1,
      slug: 'zhima',
      characterName: '芝麻',
      species: '哈士奇',
      suitType: 'full',
      ownerDisplay: '阿灰',
      featureTags: ['可动颚', '磁吸尾'],
      purpose: 'commission',
    },
    card: fixtureMedia(
      '/fixtures/works/card-zhima.svg',
      '深灰哈士奇全装「芝麻」出厂照',
      1200,
      1600,
      { desktop: '50% 36%', mobile: '50% 34%' },
    ),
  },
  {
    dto: {
      id: '8a6fee91-4ae0-40ea-86cb-8357f47ecb2f',
      version: 1,
      slug: 'doudou',
      characterName: '豆豆',
      species: '柴犬',
      suitType: 'partial',
      ownerDisplay: '不公开',
      featureTags: ['半装', '含头爪尾'],
      purpose: 'commission',
    },
    card: fixtureMedia(
      '/fixtures/works/card-doudou.svg',
      '赤色柴犬半装「豆豆」出厂照',
      1200,
      1600,
    ),
  },
  {
    dto: {
      id: '55fcae22-d514-42e5-8d59-037ae214f8b5',
      version: 1,
      slug: 'keke',
      characterName: '可可',
      species: '贵宾犬',
      suitType: 'full',
      ownerDisplay: '不公开',
      featureTags: ['卷毛造型', '轻量内衬'],
      purpose: 'showcase',
    },
    card: fixtureMedia(
      '/fixtures/works/card-keke.svg',
      '巧克力色贵宾犬全装「可可」出厂照',
      1200,
      1600,
      { desktop: '50% 40%', mobile: '50% 40%' },
    ),
  },
  {
    dto: {
      id: '3cb1db83-c2c5-42a1-8e5e-a61cb97d2422',
      version: 1,
      slug: 'lizi',
      characterName: '栗子',
      species: '小熊',
      suitType: 'partial',
      ownerDisplay: '果核',
      featureTags: ['半装', '圆耳造型'],
      purpose: 'showcase',
    },
    card: fixtureMedia(
      '/fixtures/works/card-lizi.svg',
      '栗棕色小熊半装「栗子」出厂照',
      1200,
      1600,
    ),
  },
  {
    dto: {
      id: 'dcb346e1-a5e7-4333-95b2-830284c4097e',
      version: 1,
      slug: 'naigai',
      characterName: '奶盖',
      species: '布偶猫',
      suitType: 'full',
      ownerDisplay: '不公开',
      featureTags: ['蓬松尾', '可拆围脖'],
      purpose: 'showcase',
    },
    card: fixtureMedia(
      '/fixtures/works/card-naigai.svg',
      '奶油色布偶猫全装「奶盖」出厂照',
      1200,
      1600,
      { desktop: '50% 38%', mobile: '50% 36%' },
    ),
  },
]

/** 首页精选：3–6 件、人工顺序，不自动播放。 */
export const featuredWorkSlugs = [
  'blueberry',
  'zhima',
  'doudou',
  'keke',
  'lizi',
  'naigai',
] as const

export const businessStatusFixtures: BusinessStatusFixture[] = [
  {
    kind: 'commission',
    tone: 'open',
    label: '自设委托',
    detail: '开放人工估价',
    href: '/commission',
  },
  {
    kind: 'adoption',
    tone: 'open',
    label: '角色领养',
    detail: '现有 1 位角色可领养',
    href: '/adoptions',
  },
]

export const routeCardFixtures: RouteCardFixture[] = [
  {
    href: '/commission',
    title: '自设委托',
    fact: '全装 / 半装 · 邮件人工估价',
    action: '了解自设委托',
    media: fixtureMedia(
      '/fixtures/works/route-commission.svg',
      '深灰哈士奇全装「芝麻」宽幅出厂照',
      1800,
      1200,
      { desktop: '50% 38%', mobile: '50% 36%' },
    ),
  },
  {
    href: '/adoptions',
    title: '角色领养',
    fact: '常规领养 / 展会掉落 · 线下完成',
    action: '查看可领养角色',
    media: fixtureMedia(
      '/fixtures/works/route-adoption.svg',
      '蓝白北极狐全装「蓝莓」宽幅出厂照',
      1800,
      1200,
      { desktop: '50% 40%', mobile: '50% 38%' },
    ),
  },
]

export const contactChannels = {
  email: '3114559925@qq.com',
  qq: '3114559925',
  douyin: 'to3114559925',
} as const
