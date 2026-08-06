import { evaluateReadiness } from '../utils/readiness'

/**
 * T34-F6：旧兼容端点。此前它固定返回 ok，无论数据库是否可用，因此可能被
 * 误当成真实健康信号。现在它与 `/api/health/ready` 使用同一份 readiness 判定：
 * 未就绪返回 503，不再谎报健康。
 *
 * 正式接口仍是 `/api/health/live` 与 `/api/health/ready`；Nginx 对公网屏蔽三者。
 * 响应体只有状态与服务名，不含数据库路径、SQL、Object Key 或异常栈。
 */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (!evaluateReadiness().ready) {
    setResponseStatus(event, 503)
    return { status: 'unready', service: 'project-fur-paws' }
  }
  return { status: 'ok', service: 'project-fur-paws' }
})
