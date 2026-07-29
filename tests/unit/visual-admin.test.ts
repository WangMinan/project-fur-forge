import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  adminWorkFixtures,
  findAdminWorkById,
  summarizeAssets,
} from '../../shared/fixtures/visual-admin'
import { adminWorkDtoSchema } from '../../shared/schemas/work'

describe('visual-admin 夹具', () => {
  it('每条 AdminWorkDto 均符合共享契约', () => {
    for (const work of adminWorkFixtures) {
      const parsed = adminWorkDtoSchema.safeParse(work.dto)
      expect(parsed.success, `${work.dto.slug}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`).toBe(true)
    }
  })

  it('提供 6 件作品且排序值升序、ID 唯一', () => {
    expect(adminWorkFixtures).toHaveLength(6)
    const ids = new Set(adminWorkFixtures.map(work => work.dto.id))
    expect(ids.size).toBe(adminWorkFixtures.length)
    const orders = adminWorkFixtures.map(work => work.sortOrder)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
  })

  it('领养作品 blueberry 带领养方式、业务状态与人民币价格', () => {
    const blueberry = adminWorkFixtures[0]!
    expect(blueberry.dto.slug).toBe('blueberry')
    expect(blueberry.dto.purpose).toBe('adoption')
    if (blueberry.dto.purpose === 'adoption') {
      expect(blueberry.dto.adoptionMethod).toBe('event_drop')
      expect(blueberry.dto.businessStatus).toBe('available')
      expect(blueberry.dto.priceCnyMinor).toBe(1_560_000)
    }
  })

  it('每件作品恰好一张主图，资产顺序不重复', () => {
    for (const work of adminWorkFixtures) {
      expect(work.assets.filter(asset => asset.isPrimary)).toHaveLength(1)
      const orders = work.assets.map(asset => asset.order)
      expect(new Set(orders).size).toBe(orders.length)
    }
  })

  it('READY 资产有缩略图，进行中/失败资产没有缩略图', () => {
    for (const work of adminWorkFixtures) {
      for (const asset of work.assets) {
        if (asset.state === 'ready') {
          expect(asset.thumb, `${work.dto.slug}#${asset.order}`).not.toBeNull()
          expect(asset.width).toBeGreaterThan(0)
          expect(asset.height).toBeGreaterThan(0)
        }
        else {
          expect(asset.thumb).toBeNull()
        }
      }
    }
  })

  it('失败资产必须标明失败环节（样例：lizi 校验失败）', () => {
    const lizi = adminWorkFixtures.find(work => work.dto.slug === 'lizi')!
    const failed = lizi.assets.find(asset => asset.state === 'failed')
    expect(failed?.failureStage).toBe('校验')
    for (const work of adminWorkFixtures) {
      for (const asset of work.assets) {
        if (asset.state === 'failed') {
          expect(asset.failureStage).not.toBeNull()
        }
      }
    }
  })

  it('资产只暴露业务 ID，不含私有 Object Key 或签名 URL', () => {
    for (const work of adminWorkFixtures) {
      expect(work.dto.assetIds).toEqual(
        work.assets.map(asset => asset.assetId),
      )
      for (const asset of work.assets) {
        const keys = Object.keys(asset)
        expect(keys).not.toContain('objectKey')
        expect(keys).not.toContain('originalObjectKey')
        expect(keys).not.toContain('signedUrl')
      }
    }
  })

  it('列表缩略图文件存在于 public/fixtures 下', () => {
    for (const work of adminWorkFixtures) {
      if (work.thumb) {
        const path = join(process.cwd(), 'public', work.thumb.src)
        expect(() => readFileSync(path), work.thumb.src).not.toThrow()
      }
      for (const asset of work.assets) {
        if (asset.thumb) {
          const path = join(process.cwd(), 'public', asset.thumb)
          expect(() => readFileSync(path), asset.thumb).not.toThrow()
        }
      }
    }
  })

  it('findAdminWorkById 命中与未命中', () => {
    const first = adminWorkFixtures[0]!
    expect(findAdminWorkById(first.dto.id)?.dto.slug).toBe('blueberry')
    expect(findAdminWorkById('00000000-0000-4000-8000-000000000000')).toBeUndefined()
  })

  it('summarizeAssets 统计正确', () => {
    const doudou = adminWorkFixtures.find(work => work.dto.slug === 'doudou')!
    expect(summarizeAssets(doudou.assets)).toEqual({
      total: 2,
      ready: 1,
      processing: 1,
      failed: 0,
    })
  })
})
