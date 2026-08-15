export interface PublicNavItem {
  href: string
  label: string
  children?: PublicNavItem[]
}

/** 需求3阶段 A 导航：首页 → 作品展示 → 自设委托 → 设定领养 → 关于我们。 */
export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { href: '/', label: '首页' },
  { href: '/works', label: '作品展示' },
  { href: '/commission', label: '自设委托' },
  { href: '/adoptions', label: '设定领养' },
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
