import maintenanceHtml from './maintenance.html'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (!['ditedog.com', 'admin.ditedog.com'].includes(url.hostname)) {
      return new Response(null, { status: 421 })
    }
    const options = { redirect: 'manual', decompress: 'manual' }
    if (!['GET', 'HEAD'].includes(request.method)
      || !request.headers.get('accept')?.includes('text/html')
      || url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return fetch(request, options)
    }

    let timer
    let failure = 'connection-failed'
    try {
      // Read-only wait limit; HTTP responses, including every 5xx, are passed through.
      const response = await Promise.race([
        fetch(request, options),
        new Promise(resolve => { timer = setTimeout(() => resolve(null), 10000) }),
      ])
      if (response) return response
      failure = 'origin-timeout'
    }
    catch {
      // Network failure: the fallback is embedded and needs no origin request.
    }
    finally {
      clearTimeout(timer)
    }

    return new Response(request.method === 'HEAD' ? null : maintenanceHtml, {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '60',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'X-Ditedog-Fallback': failure,
      },
    })
  },
}
