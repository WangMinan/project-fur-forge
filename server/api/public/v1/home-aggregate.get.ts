import { publicHomeAggregateResponseSchema } from '../../../../shared/schemas/public-content'
import { getPublicSiteRepository } from '../../../utils/repository/public-site-repository'
import { asSafeApiError } from '../../../utils/service-error'

/**
 * T34-F2 首页聚合投影：一次请求覆盖 Hero、业务入口、精选作品与当前领养。
 * 非关键区块在仓库层受控降级为 `available: false`，不把服务端错误详情外泄。
 */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    return publicHomeAggregateResponseSchema.parse({
      data: getPublicSiteRepository().getHomeAggregate(),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})
