import type { z } from 'zod'
import type { ErrorCode, ErrorReason } from '~~/shared/types/contracts'

export class AdminApiError extends Error {
  readonly code: ErrorCode | null
  /**
   * T34-F4 稳定业务原因：前端业务分支只允许匹配这个值。
   */
  readonly reason: ErrorReason | null
  /** 仅用于诊断日志，禁止用于业务分支判断。 */
  readonly serverMessage: string | null
  readonly status: number | null

  constructor(
    status: number | null,
    code: ErrorCode | null,
    serverMessage: string | null = null,
    reason: ErrorReason | null = null,
  ) {
    super(`Admin API request failed (${status ?? 'network'}).`)
    this.name = 'AdminApiError'
    this.code = code
    this.reason = reason
    this.serverMessage = serverMessage
    this.status = status
  }
}

interface AdminApiOptions<S extends z.ZodType> {
  body?: unknown
  method?: 'DELETE' | 'GET' | 'POST' | 'PUT'
  schema: S
}

function errorStatusOf(error: unknown) {
  const response = (error as { response?: { status?: unknown } })?.response
  return typeof response?.status === 'number' ? response.status : null
}

function errorCodeOf(error: unknown): ErrorCode | null {
  const data = (error as { data?: { error?: { code?: unknown } } })?.data
  const code = data?.error?.code
  return typeof code === 'string' ? code as ErrorCode : null
}

function errorMessageOf(error: unknown): string | null {
  const data = (error as { data?: { error?: { message?: unknown } } })?.data
  const message = data?.error?.message
  return typeof message === 'string' ? message : null
}

function errorReasonOf(error: unknown): ErrorReason | null {
  const data = (error as { data?: { error?: { reason?: unknown } } })?.data
  const reason = data?.error?.reason
  return typeof reason === 'string' ? reason as ErrorReason : null
}

// 管理端 v1 接口统一入口：同源凭据、内存 CSRF、Zod 响应校验与错误规整。
// 401 复用认证失效流程（清空内存态并置 guest，由全局 watcher 送往登录页）。
export function useAdminApi() {
  const { csrfToken, ensureSession } = useAdminAuth()

  return async function adminApi<S extends z.ZodType>(
    path: string,
    options: AdminApiOptions<S>,
  ): Promise<z.infer<S>> {
    const method = options.method ?? 'GET'
    const headers: Record<string, string> = {}
    if (!['GET', 'HEAD'].includes(method)) {
      const token = csrfToken.value
      if (!token) {
        throw new AdminApiError(401, 'UNAUTHORIZED')
      }
      headers['x-csrf-token'] = token
    }

    let raw: unknown
    try {
      const response = await $fetch.raw(path, {
        method,
        body: options.body as Record<string, unknown> | undefined,
        credentials: 'same-origin',
        headers,
      })
      raw = response._data
    }
    catch (error) {
      const status = errorStatusOf(error)
      if (status === 401) {
        // 复用认证失效流程：重检会话，确认 401 后清空内存态并置 guest。
        void ensureSession({ revalidate: true })
      }
      throw new AdminApiError(
        status,
        errorCodeOf(error),
        errorMessageOf(error),
        errorReasonOf(error),
      )
    }

    const parsed = options.schema.safeParse(raw)
    if (!parsed.success) {
      throw new AdminApiError(null, null)
    }
    return parsed.data
  }
}

export type AdminApi = ReturnType<typeof useAdminApi>
