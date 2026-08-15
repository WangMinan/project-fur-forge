export const ADMIN_NAV_ITEMS = [
  { key: 'works', href: '/admin/works', label: '作品管理' },
  { key: 'home', href: '/admin/site/home', label: '大图管理' },
  { key: 'content', href: '/admin/site/content', label: '文案配置' },
  { key: 'branding', href: '/admin/site/branding', label: '全局水印' },
  { key: 'analytics', href: '/admin/analytics', label: '访问概览' },
  { key: 'account', href: '/admin/account', label: '修改密码' },
] as const

export type AdminNavKey = typeof ADMIN_NAV_ITEMS[number]['key']
/** T01 先移除入口；T02 删除旧页面后同步删掉两个过渡类型。 */
export type AdminNavCurrent = AdminNavKey | 'returns' | 'updates' | 'none'
