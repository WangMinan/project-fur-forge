import { watermarkBrandingResponseSchema } from '../../../../../../shared/schemas/watermark'
import { getDatabase } from '../../../../../utils/database'
import { asSafeApiError } from '../../../../../utils/service-error'
import { getWatermarkBranding } from '../../../../../utils/watermark-branding'

export default defineEventHandler(() => {
  try {
    return watermarkBrandingResponseSchema.parse({
      data: getWatermarkBranding(getDatabase().sqlite),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})
