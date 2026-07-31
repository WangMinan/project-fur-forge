import type { z } from 'zod'
import {
  adminSessionDtoSchema,
  changePasswordResponseSchema,
  loginResponseSchema,
} from '~~/shared/schemas/auth'

export type AdminUser = z.infer<typeof adminSessionDtoSchema>['user']

export type AdminSessionStatus
  = 'unknown' | 'loading' | 'ready' | 'guest' | 'error'

export type LoginFailureKind
  = 'credentials' | 'forbidden' | 'unavailable' | 'unexpected'

export type LoginResult
  = { ok: true } | { ok: false, kind: LoginFailureKind }

export type ChangePasswordFailureKind
  = 'wrong-current'
    | 'conflict'
    | 'forbidden'
    | 'unauthenticated'
    | 'unavailable'
    | 'unexpected'

export type ChangePasswordResult
  = { ok: true } | { ok: false, kind: ChangePasswordFailureKind }

function responseStatusOf(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { status?: unknown } }).response
    return typeof response?.status === 'number' ? response.status : null
  }
  return null
}

// 认证状态只保存在页面内存：不写 localStorage/sessionStorage/IndexedDB/URL，
// 刷新后通过 GET /api/auth/session 恢复。sessionInFlight 去重并发检查，
// 避免多个页面/中间件同时发起 session 请求造成竞态。
let sessionInFlight: Promise<AdminSessionStatus> | null = null

export function useAdminAuth() {
  const user = useState<AdminUser | null>('admin-auth:user', () => null)
  const csrfToken = useState<string | null>('admin-auth:csrf', () => null)
  const status = useState<AdminSessionStatus>(
    'admin-auth:status',
    () => 'unknown',
  )

  function clearMemory() {
    user.value = null
    csrfToken.value = null
  }

  async function runSessionCheck(): Promise<AdminSessionStatus> {
    const wasReady = status.value === 'ready'

    try {
      const response = await $fetch.raw('/api/auth/session', {
        method: 'GET',
        credentials: 'same-origin',
      })
      const parsed = adminSessionDtoSchema.safeParse(response._data?.data)

      if (!parsed.success) {
        status.value = wasReady ? 'ready' : 'error'
        return status.value
      }

      user.value = parsed.data.user
      csrfToken.value = parsed.data.csrfToken
      status.value = 'ready'
      return status.value
    }
    catch (error) {
      const statusCode = responseStatusOf(error)

      if (statusCode === 401) {
        clearMemory()
        status.value = 'guest'
        return status.value
      }

      // 403/409/500 与网络错误都不能误判为未登录；已就绪的会话在后台
      // 重检失败时保持 ready，下次导航或操作会再次校验。
      status.value = wasReady ? 'ready' : 'error'
      return status.value
    }
  }

  async function ensureSession(
    options: { revalidate?: boolean } = {},
  ): Promise<AdminSessionStatus> {
    if (sessionInFlight) {
      return sessionInFlight
    }

    if (!options.revalidate) {
      // ready/guest 都是已确认结论：直接返回，避免登录页中间件反复发起
      // session 请求。状态翻转触发的新 navigateTo 会取消未完成的导航，
      // 否则 401→guest→重定向→再检查的链路无法收敛。
      if (status.value === 'ready') {
        return 'ready'
      }
      if (status.value === 'guest') {
        return 'guest'
      }
    }

    if (status.value !== 'ready') {
      status.value = 'loading'
    }

    sessionInFlight = runSessionCheck()
      .finally(() => {
        sessionInFlight = null
      })
    return sessionInFlight
  }

  async function login(credentials: {
    username: string
    password: string
  }): Promise<LoginResult> {
    try {
      const response = await $fetch.raw('/api/auth/login', {
        method: 'POST',
        body: {
          username: credentials.username,
          password: credentials.password,
        },
        credentials: 'same-origin',
      })
      const parsed = loginResponseSchema.safeParse(response._data)

      if (!parsed.success) {
        return { ok: false, kind: 'unexpected' }
      }

      user.value = parsed.data.data.user
      csrfToken.value = parsed.data.data.csrfToken
      status.value = 'ready'
      return { ok: true }
    }
    catch (error) {
      const statusCode = responseStatusOf(error)

      if (statusCode === 401) {
        return { ok: false, kind: 'credentials' }
      }
      if (statusCode === 403) {
        return { ok: false, kind: 'forbidden' }
      }
      return { ok: false, kind: 'unavailable' }
    }
  }

  async function logout(): Promise<{ ok: boolean }> {
    const token = csrfToken.value

    if (!token) {
      clearMemory()
      status.value = 'guest'
      return { ok: true }
    }

    try {
      await $fetch.raw('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'x-csrf-token': token,
        },
      })
      clearMemory()
      status.value = 'guest'
      return { ok: true }
    }
    catch (error) {
      if (responseStatusOf(error) === 401) {
        // 服务端会话已失效，本地内存态同样不得残留。
        clearMemory()
        status.value = 'guest'
        return { ok: true }
      }
      return { ok: false }
    }
  }

  async function probeSessionAlive() {
    try {
      await $fetch.raw('/api/auth/session', {
        method: 'GET',
        credentials: 'same-origin',
      })
      return true
    }
    catch (error) {
      return responseStatusOf(error) !== 401
    }
  }

  async function changePassword(input: {
    currentPassword: string
    newPassword: string
  }): Promise<ChangePasswordResult> {
    const token = csrfToken.value
    const current = user.value

    if (!token || !current) {
      return { ok: false, kind: 'unauthenticated' }
    }

    try {
      const response = await $fetch.raw('/api/admin/account/password', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'x-csrf-token': token,
        },
        body: {
          expectedVersion: current.version,
          payload: {
            currentPassword: input.currentPassword,
            newPassword: input.newPassword,
          },
        },
      })
      const parsed = changePasswordResponseSchema.safeParse(response._data)

      if (!parsed.success) {
        return { ok: false, kind: 'unexpected' }
      }

      // 改密成功后服务端已清除会话，本地内存态同步清空。
      clearMemory()
      status.value = 'guest'
      return { ok: true }
    }
    catch (error) {
      const statusCode = responseStatusOf(error)

      if (statusCode === 401) {
        // 401 可能是当前密码错误，也可能是会话已失效；用会话探测区分，
        // 不依赖错误文案。
        if (await probeSessionAlive()) {
          return { ok: false, kind: 'wrong-current' }
        }
        clearMemory()
        status.value = 'guest'
        return { ok: false, kind: 'unauthenticated' }
      }
      if (statusCode === 409) {
        return { ok: false, kind: 'conflict' }
      }
      if (statusCode === 403) {
        return { ok: false, kind: 'forbidden' }
      }
      return { ok: false, kind: 'unavailable' }
    }
  }

  return {
    user: readonly(user),
    csrfToken: readonly(csrfToken),
    status: readonly(status),
    ensureSession,
    login,
    logout,
    changePassword,
  }
}
