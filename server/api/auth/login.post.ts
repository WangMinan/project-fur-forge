import {
  loginRequestSchema,
  loginResponseSchema,
} from '../../../shared/schemas/auth'
import { createApiError } from '../../utils/api-error'
import { authenticateAdmin } from '../../utils/auth'
import { startAdminSession } from '../../utils/auth-session'
import { getDatabase } from '../../utils/database'
import { readAdminJsonBody } from '../../utils/request-body'
import { assertRequestRateLimit } from '../../utils/request-rate-limit'

export default defineEventHandler(async (event) => {
  const parsed = loginRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!parsed.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Request body is invalid.',
    )
  }

  // T34-F5：登录同时按用户名摘要分桶，单个用户名被爆破不会拖垮其他来源，
  // 单个来源换用户名也不能绕过 IP 维度（IP 维度已在中间件校验）。
  assertRequestRateLimit(event, 'login', {
    username: parsed.data.username,
  })

  const user = await authenticateAdmin(
    getDatabase().sqlite,
    parsed.data,
  )
  if (!user) {
    throw createApiError(
      401,
      'UNAUTHORIZED',
      'Username or password is incorrect.',
    )
  }

  return loginResponseSchema.parse({
    data: await startAdminSession(event, user),
  })
})
