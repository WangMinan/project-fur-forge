import { createServer } from 'node:net'
import { once } from 'node:events'
import nodemailer from 'nodemailer'
import { expect, it, vi } from 'vitest'
import { sendCommissionMail } from '../../server/utils/runner/commission-email'
import * as smtpConfig from '../../server/utils/smtp-config'
import { loadRuntimeConfig } from '../../server/utils/runtime-config'

it('uses ten-minute stage timeouts and aborts an actual stalled local socket', async () => {
  // No SMTP greeting, authentication or message is exchanged with this local TCP fixture.
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = (server.address() as { port: number }).port
  vi.spyOn(smtpConfig, 'smtpConfiguration').mockReturnValue({ status: 'ready', transport: {
    host: '127.0.0.1', port: port as 587, secure: false,
    user: 'test@example.com', from: 'test@example.com', password: 'test-only',
  } })
  const create = vi.spyOn(nodemailer, 'createTransport')
  const stop = new AbortController()
  const connected = once(server, 'connection')
  const config = loadRuntimeConfig({ env: {
    APP_ENV: 'test', PUBLIC_BASE_URL: 'https://public.test.invalid', ADMIN_BASE_URL: 'https://admin.test.invalid',
    MEDIA_BASE_URL: 'https://media.test.invalid', OSS_UPLOAD_BASE_URL: 'https://upload.test.invalid',
  } })
  const running = sendCommissionMail({ ...config, appEnv: 'development' }, { to: 'test@example.com' }, stop.signal)
  const rejected = expect(running).rejects.toMatchObject({ name: 'AbortError' })
  const [socket] = await connected
  const closed = once(socket, 'close')
  try {
    expect(create.mock.calls[0]![0]).toMatchObject({
      connectionTimeout: 600_000, greetingTimeout: 600_000, socketTimeout: 600_000,
      requireTLS: true, tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    })
    stop.abort()
    await rejected
    await closed
  }
  finally {
    stop.abort()
    socket.destroy()
    server.close()
    vi.restoreAllMocks()
  }
})
