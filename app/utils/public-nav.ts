export interface PublicNavItem {
  href: string
  label: string
  children?: PublicNavItem[]
}

/** 主导航顺序由 INFORMATION_ARCHITECTURE 锁定：
 *  首页 → 作品展示 → 返图墙 → 自设委托 → 角色领养 → 关于我们。
 *  工作室名/Logo 回首页。公开端称“返图墙”，管理端称“返图管理”。 */
export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { href: '/', label: '首页' },
  { href: '/works', label: '作品展示' },
  { href: '/returns', label: '返图墙' },
  { href: '/commission', label: '自设委托' },
  { href: '/adoptions', label: '角色领养' },
  {
    href: '/about',
    label: '关于我们',
    children: [
      { href: '/about', label: '关于我们' },
      { href: '/service', label: '服务条款' },
      { href: '/privacy', label: '隐私政策' },
    ],
  },
]
