import { getDatabase } from '../utils/database'
import { getMediaStorage } from '../utils/media-storage'
import { recoverExpiredOperations } from '../utils/operation-lease'
import { safeLog } from '../utils/safe-log'
import { cleanupExpiredUploadSessions } from '../utils/upload-session'

const UPLOAD_SWEEP_INTERVAL_MS = 15 * 60 * 1_000

export default defineNitroPlugin((nitroApp) => {
  try {
    const recovered = recoverExpiredOperations(getDatabase().sqlite)
    if (recovered.publication > 0 || recovered.watermark > 0) {
      safeLog('warn', 'Recovered expired operation leases.', recovered)
    }
  }
  catch (error) {
    safeLog('warn', 'Operation recovery was skipped.', { error })
  }

  const sweep = async () => {
    try {
      const result = await cleanupExpiredUploadSessions(
        getDatabase().sqlite,
        getMediaStorage(),
      )
      if (result.expiredCount > 0 || result.failedCount > 0) {
        safeLog('info', 'Expired upload sweep completed.', result)
      }
    }
    catch (error) {
      safeLog('warn', 'Expired upload sweep was skipped.', { error })
    }
  }

  void sweep()
  const timer = setInterval(() => void sweep(), UPLOAD_SWEEP_INTERVAL_MS)
  timer.unref()
  nitroApp.hooks.hook('close', () => clearInterval(timer))
})
