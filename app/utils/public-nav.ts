export interface PublicNavItem {
  href: string
  label: string
  /** 联系是独立强调入口。 */
  emphasized?: boolean
}

/** 主导航顺序由 INFORMATION_ARCHITECTURE 锁定；工作室名/Logo 回首页。
 *  返图墙属 P1（T36），页面实现前不进入可点击导航。 */
export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { href: '/', label: '首页' },
  { href: '/works', label: '作品展示' },
  { href: '/commission', label: '自设委托' },
  { href: '/adoptions', label: '角色领养' },
  { href: '/about', label: '关于我们' },
  { href: '/contact', label: '联系', emphasized: true },
]
