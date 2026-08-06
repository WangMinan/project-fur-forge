import {
  assertAdminOrigin,
  assertCsrfToken,
  requireAdminSession,
} from '../utils/auth-session'
import { assertRequestRateLimit } from '../utils/request-rate-limit'

function isAtOrBelow(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname

  if (
    event.method === 'POST'
    && pathname === '/api/auth/login'
  ) {
    assertAdminOrigin(event)
    // 按可信客户端 IP 摘要限流；用户名维度在登录处理器内解析 body 后追加。
    assertRequestRateLimit(event, 'login')
    return
  }

  if (
    pathname === '/api/auth/logout'
    || isAtOrBelow(pathname, '/api/admin')
  ) {
    // T34-F5：只对**认证失败**的管理探测按可信 IP 摘要限流。
    // 已认证流量不进这个桶，因此正常管理操作不会被匿名扫描挤掉；
    // 反过来匿名扫描也无法消耗管理员自己的写窗口。
    let session: Awaited<ReturnType<typeof requireAdminSession>>
    try {
      session = await requireAdminSession(event)
    }
    catch (error) {
      assertRequestRateLimit(event, 'adminProbe')
      throw error
    }
    event.context.adminSession = session

    if (!['GET', 'HEAD'].includes(event.method)) {
      assertAdminOrigin(event)
      assertCsrfToken(event, session.csrfToken)
      if (isAtOrBelow(pathname, '/api/admin')) {
        // 已认证管理写按管理员 ID 分桶。
        assertRequestRateLimit(event, 'adminWrite', {
          adminId: session.user.id,
        })
      }
    }
  }
})
