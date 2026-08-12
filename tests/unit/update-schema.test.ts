import { describe, expect, it } from 'vitest'
import {
  adminUpdateDtoSchema,
  createUpdateRequestSchema,
  mutateUpdateRequestSchema,
  publicUpdateDtoSchema,
  updateUpdateRequestSchema,
} from '../../shared/schemas/update'

const fields = {
  type: 'event' as const,
  title: '  夏日兽聚参展通知  ',
  content: '  我们将在周末参展。  ',
}

describe('update schemas', () => {
  it('trims strict create and edit fields', () => {
    expect(createUpdateRequestSchema.parse(fields)).toEqual({
      type: 'event',
      title: '夏日兽聚参展通知',
      content: '我们将在周末参展。',
    })
    expect(updateUpdateRequestSchema.parse({
      expectedVersion: 2,
      payload: fields,
    }).payload.title).toBe('夏日兽聚参展通知')
    expect(createUpdateRequestSchema.safeParse({
      ...fields,
      media: [],
    }).success).toBe(false)
  })

  it('rejects invalid types, blank content and oversized text', () => {
    expect(createUpdateRequestSchema.safeParse({
      ...fields,
      type: 'news',
    }).success).toBe(false)
    expect(createUpdateRequestSchema.safeParse({
      ...fields,
      content: ' ',
    }).success).toBe(false)
    expect(createUpdateRequestSchema.safeParse({
      ...fields,
      title: 'x'.repeat(201),
    }).success).toBe(false)
    expect(mutateUpdateRequestSchema.safeParse({
      expectedVersion: 1,
      payload: { scheduledAt: null },
    }).success).toBe(false)
  })

  it('keeps admin-only fields out of the public DTO', () => {
    const admin = adminUpdateDtoSchema.parse({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      type: 'drop',
      title: '新角色掉落预告',
      content: '本周六公开。',
      publicationStatus: 'published',
      publishedAt: '2026-08-12T12:00:00.000Z',
      version: 2,
      createdAt: '2026-08-12T11:00:00.000Z',
      updatedAt: '2026-08-12T12:00:00.000Z',
    })

    expect(publicUpdateDtoSchema.safeParse(admin).success).toBe(false)
    expect(publicUpdateDtoSchema.parse({
      id: admin.id,
      type: admin.type,
      title: admin.title,
      content: admin.content,
      publishedAt: admin.publishedAt,
    })).not.toHaveProperty('version')
  })
})
