import { evaluateReadiness } from '../../utils/service/readiness'

/**
 * T34-F6 readiness：数据库可打开、迁移版本匹配、基础记录存在。
 * 未就绪返回 503，便于 compose 的 depends_on 与滚动升级正确等待。
 */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const result = evaluateReadiness()
  if (!result.ready) {
    setResponseStatus(event, 503)
  }
  return {
    status: result.ready ? 'ready' : 'unready',
    checks: result.checks,
  }
})
