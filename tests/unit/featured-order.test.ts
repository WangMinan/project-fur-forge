import { describe, expect, it } from 'vitest'
import { PUBLIC_FEATURED_LIMIT } from '../../shared/constants/featured'
import { moveFeaturedItem } from '../../app/utils/featured-order'
import { featuredWorkOrderRequestSchema } from '../../shared/schemas/work'

const items = [0, 1, 2, 3].map(id => ({ id: String(id) }))

describe('T51-F8 featured order', () => {
  it('moves an item with visible top, up, down and bottom semantics', () => {
    expect(moveFeaturedItem(items, '3', 'top').map(item => item.id))
      .toEqual(['3', '0', '1', '2'])
    expect(moveFeaturedItem(items, '2', 'up').map(item => item.id))
      .toEqual(['0', '2', '1', '3'])
    expect(moveFeaturedItem(items, '1', 'down').map(item => item.id))
      .toEqual(['0', '2', '1', '3'])
    expect(moveFeaturedItem(items, '0', 'bottom').map(item => item.id))
      .toEqual(['1', '2', '3', '0'])
  })

  it('uses a shared public limit of 12 and rejects duplicate submitted IDs', () => {
    expect(PUBLIC_FEATURED_LIMIT).toBe(12)
    const id = '11111111-1111-4111-8111-111111111111'
    expect(featuredWorkOrderRequestSchema.safeParse({
      payload: {
        items: [
          { id, expectedVersion: 1 },
          { id, expectedVersion: 1 },
        ],
      },
    }).success).toBe(false)
  })
})
