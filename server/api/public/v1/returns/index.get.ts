import {
  publicReturnWallQuerySchema,
  publicReturnWallResponseSchema,
} from '../../../../../shared/schemas/return-photo'
import { getPublicReturnWallForRequest } from '../../../../utils/repository/public-return-repository'

/**
 * 公开返图墙。非法页码不抛 500，也不泄漏内部信息：
 * 统一收敛为第 1 页；超出范围的页码返回空 items 与真实总数，
 * 由页面渲染受控空态。
 */
export default defineEventHandler((event) => {
  const parsed = publicReturnWallQuerySchema.safeParse(
    getQuery(event).page === undefined
      ? {}
      : { page: Number(getQuery(event).page) },
  )
  const page = parsed.success ? parsed.data.page ?? 1 : 1
  return publicReturnWallResponseSchema.parse({
    data: getPublicReturnWallForRequest(page),
  })
})
