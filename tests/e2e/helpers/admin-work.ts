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

export async function createWorkViaApi(
  page: Page,
  overrides: Partial<{
    characterName: string
    featureTags: string[]
    ownerContact: string | null
    ownerDisplay: '不公开' | '有点小狗工作室'
    purpose: 'commission' | 'showcase'
    slug: string
    species: string
    suitType: 'full' | 'partial'
  }> = {},
): Promise<CreatedWork> {
  const csrfToken = await currentCsrfToken(page)
  slugCounter += 1
  const slug = overrides.slug ?? `e2e-work-${Date.now().toString(36)}-${slugCounter}`
  const response = await page.request.post(`${adminBaseURL}/api/admin/v1/works`, {
    data: {
      slug,
      characterName: overrides.characterName ?? `测试作品${slugCounter}`,
      species: overrides.species ?? '犬',
      suitType: overrides.suitType ?? 'full',
      purpose: overrides.purpose ?? 'commission',
      ownerDisplay: overrides.ownerDisplay ?? '不公开',
      ownerContact: overrides.ownerContact === undefined
        ? `e2e-private-contact-${slugCounter}`
        : overrides.ownerContact,
      featureTags: overrides.featureTags ?? ['测试属性'],
    },
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
      characterName: string
      featureTags: string[]
      ownerDisplay: '不公开' | '有点小狗工作室'
      private: { ownerContact: string | null }
      purpose: 'commission' | 'showcase'
      slug: string
      species: string
      suitType: 'full' | 'partial'
      version: number
    }
  }).data
  const response = await page.request.put(`${adminBaseURL}/api/admin/v1/works/${work.id}`, {
    data: {
      expectedVersion: current.version,
      payload: {
        slug: current.slug,
        characterName: fields.characterName ?? `${current.characterName}改`,
        species: current.species,
        suitType: current.suitType,
        purpose: current.purpose,
        ownerDisplay: current.ownerDisplay,
        ownerContact: current.private.ownerContact,
        featureTags: current.featureTags,
      },
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
