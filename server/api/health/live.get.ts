/**
 * T34-F6 liveness：只证明 Node 进程能响应请求。
 * 不触碰数据库、不触碰 OSS，因此容器重启风暴时不会被下游依赖拖死。
 */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  return { status: 'live' }
})
