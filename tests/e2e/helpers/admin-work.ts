import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { adminBaseURL, loginAsAdmin } from './auth'

export interface CreatedWork {
  id: string
  version: number
  slug: string
}

let slugCounter = 0

// 复用浏览器上下文中已登录的会话：重复登录会替换 Cookie 罐中的 Session，
// 使页面内存中的 CSRF token 与新 Session 不匹配（写请求 403）。
async function currentCsrfToken(page: Page) {
  const session = await page.request.get(`${adminBaseURL}/api/auth/session`)
  if (session.status() === 401) {
    const { csrfToken } = await loginAsAdmin(page)
    return csrfToken
  }
  const body = await session.json() as { data: { csrfToken: string } }
  return body.data.csrfToken
}

export interface CreateWorkOverrides {
  adoptionStatus?: 'available' | 'adopted'
  characterName?: string
  featured?: boolean
  priceCnyMinor?: number | null
  purpose?: 'adoption' | 'commission' | 'showcase'
  slug?: string
  sortOrder?: number
  species?: string
}

export async function createWorkViaApi(
  page: Page,
  overrides: CreateWorkOverrides = {},
): Promise<CreatedWork> {
  const csrfToken = await currentCsrfToken(page)
  slugCounter += 1
  const slug = overrides.slug ?? `e2e-work-${Date.now().toString(36)}-${slugCounter}`
  const purpose = overrides.purpose ?? 'commission'
  const base = {
    slug,
    characterName: overrides.characterName ?? `测试作品${slugCounter}`,
    species: overrides.species ?? '犬',
    sortOrder: overrides.sortOrder ?? 0,
    featured: overrides.featured ?? false,
  }
  const response = await page.request.post(`${adminBaseURL}/api/admin/v1/works`, {
    data: purpose === 'adoption'
      ? {
          ...base,
          purpose,
          adoptionStatus: overrides.adoptionStatus ?? 'available',
          priceCnyMinor: overrides.priceCnyMinor ?? null,
        }
      : { ...base, purpose },
    headers: {
      'Origin': adminBaseURL,
      'x-csrf-token': csrfToken,
    },
  })
  expect(response.status(), '创建作品应成功').toBe(201)
  const body = await response.json() as { data: { id: string, version: number } }
  return { id: body.data.id, version: body.data.version, slug }
}

// 直接用 API 修改作品字段：制造“其他地方已修改”的版本冲突场景。
export async function bumpWorkViaApi(
  page: Page,
  work: CreatedWork,
  fields: { characterName?: string } = {},
) {
  const csrfToken = await currentCsrfToken(page)
  const detail = await page.request.get(`${adminBaseURL}/api/admin/v1/works/${work.id}`)
  const current = (await detail.json() as {
    data: {
      adoptionStatus?: 'available' | 'adopted' | null
      characterName: string
      featured: boolean
      priceCnyMinor?: number | null
      purpose: 'adoption' | 'commission' | 'showcase'
      slug: string
      sortOrder: number
      species: string
      version: number
    }
  }).data
  const base = {
    slug: current.slug,
    characterName: fields.characterName ?? `${current.characterName}改`,
    species: current.species,
    sortOrder: current.sortOrder,
    featured: current.featured,
  }
  const response = await page.request.put(`${adminBaseURL}/api/admin/v1/works/${work.id}`, {
    data: {
      expectedVersion: current.version,
      payload: current.purpose === 'adoption'
        ? {
            ...base,
            purpose: current.purpose,
            adoptionStatus: current.adoptionStatus ?? 'available',
            priceCnyMinor: current.priceCnyMinor ?? null,
          }
        : { ...base, purpose: current.purpose },
    },
    headers: {
      'Origin': adminBaseURL,
      'x-csrf-token': csrfToken,
    },
  })
  expect(response.status(), 'API 修改作品应成功').toBe(200)
}

export function digests(content: Buffer) {
  return {
    contentMd5: createHash('md5').update(content).digest('base64'),
    sha256: createHash('sha256').update(content).digest('hex'),
  }
}
