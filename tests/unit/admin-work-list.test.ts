import { describe, expect, it } from 'vitest'
import {
  adminWorkPageCount,
  clampAdminWorkPage,
  filterAdminWorks,
  paginateAdminWorks,
} from '../../app/utils/admin-work-list'

const works = [
  {
    characterName: '蓝湄',
    species: '水鹿',
    purpose: 'showcase',
    publicationStatus: 'published',
    suitType: 'full',
  },
  {
    characterName: 'Mochi',
    species: '狐狸',
    purpose: 'commission',
    publicationStatus: 'draft',
    suitType: 'partial',
  },
  {
    characterName: '奶盖',
    species: '狐狸',
    purpose: 'commission',
    publicationStatus: 'published',
    suitType: 'partial',
  },
] as const

describe('后台作品列表视图', () => {
  it('组合查找与筛选时保留服务端顺序', () => {
    expect(filterAdminWorks(works, {
      publicationStatus: 'published',
      purpose: 'commission',
      query: '狐狸',
      suitType: 'partial',
    })).toEqual([works[2]])

    expect(filterAdminWorks(works, {
      publicationStatus: 'all',
      purpose: 'all',
      query: 'moCHI',
      suitType: 'all',
    })).toEqual([works[1]])
  })

  it('分页在空结果和越界页码下保持合法', () => {
    expect(adminWorkPageCount(0, 10)).toBe(1)
    expect(adminWorkPageCount(21, 10)).toBe(3)
    expect(clampAdminWorkPage(4, 21, 10)).toBe(3)
    expect(paginateAdminWorks(works, 2, 2)).toEqual([works[2]])
  })
})
