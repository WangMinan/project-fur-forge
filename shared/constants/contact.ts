export const CONTACT_PLATFORMS = [
  'qq',
  'qq_group',
] as const

export const CONTACT_PLATFORM_LABELS = {
  qq: 'QQ',
  qq_group: 'QQ群',
} as const satisfies Record<typeof CONTACT_PLATFORMS[number], string>

export const CONTACT_PLATFORM_LOGO_PATHS = {
  qq: '/contact-platforms/qq.svg',
  qq_group: '/contact-platforms/qq.svg',
} as const satisfies Record<typeof CONTACT_PLATFORMS[number], string>

/** 二维码卡片的点击提示，同时用于 aria-label。 */
export const CONTACT_PLATFORM_ACTION_LABELS = {
  qq: '添加好友',
  qq_group: '加入群聊',
} as const satisfies Record<typeof CONTACT_PLATFORMS[number], string>
