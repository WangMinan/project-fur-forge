/**
 * 首页静态内容夹具：业务入口路由卡与营业状态行。
 *
 * T20 起，首屏轮播与精选轨道改由公开投影（/api/public/v1/home、
 * /api/public/v1/works/featured）直出；本模块只保留尚未接入后台的
 * 静态文案区块。路由卡插图为仓库内确定性 SVG，不引入网络素材。
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
