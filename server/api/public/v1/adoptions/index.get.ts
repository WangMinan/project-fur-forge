import { publicAdoptionListResponseSchema } from '../../../../../shared/schemas/public-content'
import { getPublicSiteRepository } from '../../../../utils/repository/public-site-repository'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    // 筛选参数原样透传（含非法值），由投影层判定 filter.valid，
    // 非法值收敛为“全部”，不抛 500 也不泄漏内部信息。
    return publicAdoptionListResponseSchema.parse({
      data: getPublicSiteRepository().listAdoptions({
        method: getQuery(event).method,
        page: getQuery(event).page,
      }),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})
