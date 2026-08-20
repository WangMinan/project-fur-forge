import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  apiErrorSchema,
  ERROR_REASON_VALUES,
} from '../../shared/schemas/api'
import { ServiceError } from '../../server/utils/service-error'

/**
 * T34-F4 稳定错误契约。
 * `reason` 是前端唯一允许匹配的业务判据；英文 `message` 可以自由改写。
 */
describe('stable business error reasons', () => {
  it('carries reason through ServiceError and the wire schema', () => {
    const error = new ServiceError(
      409,
      'CONFLICT',
      'Disable the hero item before editing it.',
      'HERO_ITEM_ENABLED',
    )
    expect(error.reason).toBe('HERO_ITEM_ENABLED')

    expect(apiErrorSchema.safeParse({
      error: {
        code: 'CONFLICT',
        reason: 'HERO_ITEM_ENABLED',
        message: 'anything',
      },
    }).success).toBe(true)
    // reason 可选：通用失败不必携带。
    expect(apiErrorSchema.safeParse({
      error: { code: 'INTERNAL_ERROR', message: 'Service is unavailable.' },
    }).success).toBe(true)
    // 未登记的 reason 一律拒绝，防止随手新增字符串。
    expect(apiErrorSchema.safeParse({
      error: { code: 'CONFLICT', reason: 'MADE_UP', message: 'x' },
    }).success).toBe(false)
  })

  it('keeps reasons unique', () => {
    expect(new Set(ERROR_REASON_VALUES).size).toBe(ERROR_REASON_VALUES.length)
  })

  it('never branches on English server messages in the admin frontend', async () => {
    // 红线：前端业务分支只能匹配 reason。
    const roots = ['app/composables', 'app/pages', 'app/components', 'app/utils']
    const offenders: string[] = []

    async function walk(directory: string) {
      const entries = await readdir(resolve(directory), {
        withFileTypes: true,
      })
      for (const entry of entries) {
        const path = `${directory}/${entry.name}`
        if (entry.isDirectory()) {
          await walk(path)
          continue
        }
        if (!/\.(?:ts|vue)$/u.test(entry.name)) {
          continue
        }
        const source = readFileSync(resolve(path), 'utf8')
        if (/serverMessage\s*===/u.test(source)
          || /serverMessage\s*\)\s*\{/u.test(source)
          || /\[\s*error\.serverMessage\s*\]/u.test(source)) {
          offenders.push(path)
        }
      }
    }

    for (const root of roots) {
      await walk(root)
    }
    expect(offenders).toEqual([])
  })
})
