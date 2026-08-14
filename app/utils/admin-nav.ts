export const ADMIN_NAV_ITEMS = [
  { key: 'works', href: '/admin/works', label: '作品管理' },
  { key: 'returns', href: '/admin/returns', label: '返图管理' },
  { key: 'updates', href: '/admin/updates', label: '动态管理' },
  { key: 'home', href: '/admin/site/home', label: '大图管理' },
  { key: 'content', href: '/admin/site/content', label: '文案配置' },
  { key: 'branding', href: '/admin/site/branding', label: '全局水印' },
  { key: 'analytics', href: '/admin/analytics', label: '访问概览' },
  { key: 'account', href: '/admin/account', label: '修改密码' },
] as const

export type AdminNavKey = typeof ADMIN_NAV_ITEMS[number]['key']
export type AdminNavCurrent = AdminNavKey | 'none'
