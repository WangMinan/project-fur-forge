import {
  describe,
  expect,
  it,
} from 'vitest'
import { PUBLIC_NAV_ITEMS } from '../../app/utils/public-nav'

describe('T12 public updates navigation', () => {
  it('places latest updates directly before about us for shared desktop and mobile data', () => {
    expect(PUBLIC_NAV_ITEMS.map(item => [item.href, item.label])).toEqual([
      ['/', '首页'],
      ['/works', '作品展示'],
      ['/returns', '返图墙'],
      ['/commission', '委托'],
      ['/updates', '最新动态'],
      ['/about', '关于我们'],
    ])
  })
})
