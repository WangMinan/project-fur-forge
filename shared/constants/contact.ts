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
