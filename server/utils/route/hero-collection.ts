import {
  heroItemIdSchema,
  heroOrientationSchema,
  heroPlacementSchema,
} from '../../../shared/schemas/home'
import { createApiError } from '../api-error'

export function readHeroCollectionRoute(event: Parameters<typeof getRouterParam>[0]) {
  const placement = heroPlacementSchema.safeParse(getRouterParam(event, 'placement'))
  const orientation = heroOrientationSchema.safeParse(getRouterParam(event, 'orientation'))
  if (!placement.success || !orientation.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Hero collection route is invalid.')
  }
  return { placement: placement.data, orientation: orientation.data }
}

export function readHeroCollectionItemId(event: Parameters<typeof getRouterParam>[0]) {
  const id = heroItemIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Hero item id is invalid.')
  }
  return id.data
}
