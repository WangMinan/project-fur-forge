import { describe, expect, it } from 'vitest'

import { adminWorkFixtures } from '../../shared/fixtures/visual-admin'
import { buildPublicationChecklist } from '../../app/utils/publication-checklist'

const bySlug = (slug: string) => adminWorkFixtures.find(work => work.dto.slug === slug)!

describe('buildPublicationChecklist', () => {
  it('blueberry：基础、主图、媒体、领养字段、价格与影响说明齐备 → 可发布', () => {
    const checklist = buildPublicationChecklist(bySlug('blueberry'))
    expect(checklist.publishable).toBe(true)
    const ids = checklist.items.map(item => item.id)
    expect(ids).toEqual([
      'basics',
      'primary_media',
      'media_ready',
      'adoption_fields',
      'price',
      'publish_impact',
    ])
    const price = checklist.items.find(item => item.id === 'price')!
    expect(price.state).toBe('satisfied')
    expect(price.detail).toContain('¥15,600')
  })

  it('非领养作品不包含领养字段与价格项', () => {
    const checklist = buildPublicationChecklist(bySlug('zhima'))
    const ids = checklist.items.map(item => item.id)
    expect(ids).not.toContain('adoption_fields')
    expect(ids).not.toContain('price')
    expect(checklist.publishable).toBe(true)
  })

  it('doudou：有资产校验中 → media_ready 为 processing 且不可发布', () => {
    const checklist = buildPublicationChecklist(bySlug('doudou'))
    expect(checklist.publishable).toBe(false)
    const media = checklist.items.find(item => item.id === 'media_ready')!
    expect(media.state).toBe('processing')
    expect(media.detail).toContain('1 张')
  })

  it('lizi：有资产失败 → media_ready 为 blocked 且不可发布', () => {
    const checklist = buildPublicationChecklist(bySlug('lizi'))
    expect(checklist.publishable).toBe(false)
    const media = checklist.items.find(item => item.id === 'media_ready')!
    expect(media.state).toBe('blocked')
    expect(media.detail).toContain('失败')
  })

  it('用途切换为领养但缺领养字段 → adoption_fields missing', () => {
    const zhima = bySlug('zhima')
    const checklist = buildPublicationChecklist({
      ...zhima,
      dto: { ...zhima.dto, purpose: 'adoption' } as typeof zhima.dto,
    })
    const adoption = checklist.items.find(item => item.id === 'adoption_fields')!
    expect(adoption.state).toBe('missing')
    const price = checklist.items.find(item => item.id === 'price')!
    expect(price.state).toBe('satisfied')
    expect(price.detail).toContain('隐藏')
    expect(checklist.publishable).toBe(false)
  })

  it('无媒体作品：media_ready 为 missing 并提示上传', () => {
    const keke = bySlug('keke')
    const checklist = buildPublicationChecklist({ ...keke, assets: [] })
    const media = checklist.items.find(item => item.id === 'media_ready')!
    expect(media.state).toBe('missing')
    expect(checklist.publishable).toBe(false)
  })
})
