import {
  describe,
  expect,
  it,
} from 'vitest'
import { PUBLIC_NAV_ITEMS } from '../../app/utils/public-nav'

describe('T17-F4 public navigation', () => {
  it('keeps commission and adoptions as direct entries in shared navigation data', () => {
    expect(PUBLIC_NAV_ITEMS.map(item => [item.href, item.label])).toEqual([
      ['/', '首页'],
      ['/works', '作品展示'],
      ['/returns', '返图墙'],
      ['/commission', '自设委托'],
      ['/adoptions', '设定领养'],
      ['/updates', '最新动态'],
      ['/about', '关于我们'],
    ])
    expect(PUBLIC_NAV_ITEMS.find(item => item.href === '/commission')?.children).toBeUndefined()
    expect(PUBLIC_NAV_ITEMS.find(item => item.href === '/adoptions')?.children).toBeUndefined()
    expect(PUBLIC_NAV_ITEMS.find(item => item.href === '/about')?.children).toHaveLength(3)
  })
})
