import { getDatabase } from '../utils/database'
import { getMediaStorage } from '../utils/media-storage'
// 导入这些模块会注册各自的 resumer（Hero 发布/放大、作品发布/下架、
// 返图发布/下架、水印预览/应用、站点展示 reconcile），
// recovery 本身不反向依赖业务细节。
import '../utils/runner/home-management'
import '../utils/runner/return-photo-publication'
import '../utils/runner/site-display-reconcile'
import '../utils/runner/watermark-branding'
import '../utils/runner/work-publication'
import { recoverPendingOperations } from '../utils/runner/operation-recovery'
import { getRuntimeConfig } from '../utils/runtime-config'
import { safeLog } from '../utils/safe-log'

/**
 * T34-F5 启动恢复。
 *
 * 序号 02 保证它在 00.runtime-config 与 01.database-config 之后运行。
 * 恢复是后台任务：不阻塞第一个请求，失败只记录脱敏日志，不让进程起不来。
 */
export default defineNitroPlugin(() => {
  if (getRuntimeConfig().appEnv === 'test' && !process.env.E2E_RECOVER_ON_BOOT) {
    // 测试构建默认不自动恢复：E2E 需要确定的 operation 状态。
    // 进程中断测试通过 E2E_RECOVER_ON_BOOT=1 显式打开。
    return
  }
  void (async () => {
    try {
      await recoverPendingOperations({
        sqlite: getDatabase().sqlite,
        storage: getMediaStorage(),
      })
    }
    catch (error) {
      safeLog('error', 'Operation recovery failed at startup.', {
        errorName: (error as { name?: unknown }).name,
      })
    }
  })()
})
