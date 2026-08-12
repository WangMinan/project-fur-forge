export const CONTACT_PLATFORMS = [
  'qq',
  'douyin',
  'qq_group',
  'xiaohongshu',
  'bilibili',
] as const

export const CONTACT_PLATFORM_LABELS = {
  qq: 'QQ',
  douyin: '抖音',
  qq_group: 'QQ群',
  xiaohongshu: '小红书',
  bilibili: 'Bilibili',
} as const satisfies Record<typeof CONTACT_PLATFORMS[number], string>

export const CONTACT_PLATFORM_LOGO_PATHS = {
  qq: '/contact-platforms/qq.svg',
  douyin: '/contact-platforms/douyin.svg',
  qq_group: '/contact-platforms/qq.svg',
  xiaohongshu: '/contact-platforms/xiaohongshu.svg',
  bilibili: '/contact-platforms/bilibili.svg',
} as const satisfies Record<typeof CONTACT_PLATFORMS[number], string>
