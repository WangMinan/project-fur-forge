import { describe, expect, it } from 'vitest'
import {
  publicAdoptionListQuerySchema,
  publicCatalogSearchQuerySchema,
  publicWorkListQuerySchema,
} from '../../shared/schemas/public-content'
import { publicReturnWallQuerySchema } from '../../shared/schemas/return-photo'
import { includesSearchText, normalizeSearchText } from '../../shared/utils/search'

describe('统一名称搜索', () => {
  it('trims and matches names with Chinese locale case folding', () => {
    expect(normalizeSearchText('  Mochi  ')).toBe('mochi')
    expect(includesSearchText('蓝湄 Mochi', '  mOCH  ')).toBe(true)
    expect(includesSearchText('蓝湄', '雪球')).toBe(false)
    expect(includesSearchText('蓝湄', '   ')).toBe(true)
  })

  it('accepts blank as no search and rejects unsafe query shapes', () => {
    expect(publicCatalogSearchQuerySchema.parse(undefined)).toBeUndefined()
    expect(publicCatalogSearchQuerySchema.parse('   ')).toBeUndefined()
    expect(publicCatalogSearchQuerySchema.parse('  蓝湄  ')).toBe('蓝湄')
    expect(publicCatalogSearchQuerySchema.safeParse(['蓝湄']).success).toBe(false)
    expect(publicCatalogSearchQuerySchema.safeParse({ q: '蓝湄' }).success).toBe(false)
    expect(publicCatalogSearchQuerySchema.safeParse('犬'.repeat(101)).success).toBe(false)
  })

  it('uses the same q contract for works, adoptions and returns', () => {
    expect(publicWorkListQuerySchema.parse({ q: '  蓝湄  ' }).q).toBe('蓝湄')
    expect(publicAdoptionListQuerySchema.parse({ q: '  蓝湄  ' }).q).toBe('蓝湄')
    expect(publicReturnWallQuerySchema.parse({ q: '  蓝湄  ' }).q).toBe('蓝湄')
  })
})
