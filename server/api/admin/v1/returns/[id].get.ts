import { resourceIdSchema } from '../../../../../shared/schemas/api'
import { adminReturnCharacterResponseSchema } from '../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { asApiError } from '../../../../utils/service-error'
import { getReturnCharacter } from '../../../../utils/service/return-photo'

/** 设定详情，含它的全部返图照片。 */
export default defineEventHandler((event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Return character id is invalid.',
    )
  }
  try {
    return adminReturnCharacterResponseSchema.parse({
      data: getReturnCharacter(getDatabase().sqlite, id.data),
    })
  }
  catch (error) {
    asApiError(error)
  }
})
