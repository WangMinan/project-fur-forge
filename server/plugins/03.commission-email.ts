import { getDatabase } from '../utils/database'
import { getMediaStorage } from '../utils/media-storage'
import { getRuntimeConfig } from '../utils/runtime-config'
import { smtpConfiguration } from '../utils/smtp-config'
import { deliverNextCommissionEmail } from '../utils/runner/commission-email'
import { safeLog } from '../utils/safe-log'

export default defineNitroPlugin((app) => {
  const config = getRuntimeConfig()
  if (config.appEnv === 'test') return
  const smtp = smtpConfiguration(config)
  if (smtp.status !== 'ready') {
    if (smtp.status === 'invalid') safeLog('error', 'Commission SMTP configuration is invalid.')
    return
  }
  let stopped = false
  let timer: ReturnType<typeof setTimeout>
  let running: Promise<void>
  // ponytail: one delivery at a time; increase concurrency only if measured volume requires it.
  async function tick() {
    let delivered = false
    try {
      delivered = await deliverNextCommissionEmail({ sqlite: getDatabase().sqlite, storage: getMediaStorage(), config })
    }
    catch {
      safeLog('error', 'Commission notification processing failed.')
    }
    if (!stopped) timer = setTimeout(start, delivered ? 100 : 5_000)
  }
  function start() { running = tick() }
  start()
  app.hooks.hook('close', async () => {
    stopped = true
    clearTimeout(timer)
    await running
  })
})
