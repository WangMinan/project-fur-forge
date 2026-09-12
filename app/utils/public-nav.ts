export interface PublicNavItem {
  href: string
  label: string
  children?: PublicNavItem[]
}

/** 需求3阶段 A 导航：首页 → 作品展示 → 自设委托 → 设定领养 → 关于我们。 */
export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { href: '/', label: 'ui.home' },
  { href: '/works', label: 'ui.works' },
  { href: '/commission', label: 'ui.commissions' },
  { href: '/adoptions', label: 'ui.adoptions' },
  {
    href: '/about',
    label: 'ui.about',
    children: [
      { href: '/about', label: 'ui.about' },
      { href: '/service', label: 'ui.terms' },
      { href: '/privacy', label: 'ui.privacy' },
    ],
  },
]
