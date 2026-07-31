// 登录成功后的回跳目标只接受站内 /admin 路径：
// 拒绝外部 origin、协议相对地址与登录页自身，防止开放重定向。
export function safeAdminRedirectTarget(raw: unknown): string {
  const fallback = '/admin/works'

  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) {
    return fallback
  }

  try {
    const url = new URL(raw, 'https://admin.invalid')

    if (url.origin !== 'https://admin.invalid') {
      return fallback
    }
    if (
      url.pathname !== '/admin'
      && !url.pathname.startsWith('/admin/')
    ) {
      return fallback
    }
    if (url.pathname === '/admin/login') {
      return fallback
    }

    return `${url.pathname}${url.search}${url.hash}`
  }
  catch {
    return fallback
  }
}
