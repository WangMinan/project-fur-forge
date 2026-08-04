import type { H3Event } from 'h3'
import { getQuery } from 'h3'
import { heroPlacementSchema } from '../../shared/schemas/home'
import { createApiError } from './api-error'

export function readHeroPlacement(event: H3Event) {
  const placement = heroPlacementSchema.safeParse(
    getQuery(event).placement ?? 'home',
  )
  if (!placement.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Hero placement is invalid.')
  }
  return placement.data
}
