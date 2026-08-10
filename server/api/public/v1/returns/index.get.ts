import {
  publicReturnWallQuerySchema,
  publicReturnWallResponseSchema,
} from '../../../../../shared/schemas/return-photo'
import {
  getPublicReturnWallForRequest,
  returnWallSeed,
} from '../../../../utils/repository/public-return-repository'

/**
 * 公开返图墙。非法页码不抛 500，也不泄漏内部信息：
 * 统一收敛为第 1 页；超出范围的页码返回空 items 与真实总数，
 * 由页面渲染受控空态。
 *
 * 无 seed 的页面请求生成新的随机种子；响应与分页链接保留该 seed，
 * 因此刷新或重新访问会重排，同一次浏览里翻页不会重复或漏图。
 */
export default defineEventHandler((event) => {
  const query = getQuery(event)
  const parsed = publicReturnWallQuerySchema.safeParse({
    ...(query.page === undefined ? {} : { page: Number(query.page) }),
    ...(query.seed === undefined ? {} : { seed: query.seed }),
  })
  const page = parsed.success ? parsed.data.page ?? 1 : 1
  const seed = parsed.success
    ? parsed.data.seed ?? returnWallSeed()
    : returnWallSeed()
  return publicReturnWallResponseSchema.parse({
    data: getPublicReturnWallForRequest(page, seed),
  })
})
