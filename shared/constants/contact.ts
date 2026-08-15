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
