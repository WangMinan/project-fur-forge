import { describe, expect, it } from 'vitest'
import {
  publicPageFromQuery,
  publicPageHref,
} from '../../app/utils/public-pagination'

describe('公开列表分页 URL', () => {
  it('非法页码收敛为第一页', () => {
    expect(publicPageFromQuery(undefined)).toBe(1)
    expect(publicPageFromQuery('bad')).toBe(1)
    expect(publicPageFromQuery('0')).toBe(1)
    expect(publicPageFromQuery('10001')).toBe(1)
    expect(publicPageFromQuery(['2', '3'])).toBe(2)
  })

  it('第一页省略 page 并只保留页面显式允许的筛选', () => {
    expect(publicPageHref('/works', {
      purpose: 'commission',
      suitType: null,
    }, 1)).toBe('/works?purpose=commission')
    expect(publicPageHref('/works', {
      purpose: 'commission',
      suitType: 'full',
    }, 2)).toBe('/works?purpose=commission&suitType=full&page=2')
    expect(publicPageHref('/adoptions', { method: 'event_drop' }, 3))
      .toBe('/adoptions?method=event_drop&page=3')
  })
})
