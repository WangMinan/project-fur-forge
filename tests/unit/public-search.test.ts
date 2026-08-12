import { describe, expect, it } from 'vitest'
import { publicSearchFromQuery } from '../../app/utils/public-search'

describe('公开搜索 URL 状态', () => {
  it('separates absent, blank, valid and invalid q values', () => {
    expect(publicSearchFromQuery(undefined)).toEqual({
      active: false,
      query: '',
      valid: true,
    })
    expect(publicSearchFromQuery('   ')).toEqual({
      active: false,
      query: '',
      valid: true,
    })
    expect(publicSearchFromQuery('  蓝湄  ')).toEqual({
      active: true,
      query: '蓝湄',
      valid: true,
    })
    expect(publicSearchFromQuery(['蓝湄'])).toEqual({
      active: true,
      query: '',
      valid: false,
    })
  })
})
