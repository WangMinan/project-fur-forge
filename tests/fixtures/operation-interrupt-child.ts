import { appendFileSync } from 'node:fs'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../server/utils/database'
import { resetOperationLeaseOwner } from '../../server/utils/operation-lease'
import { recoverPendingOperations } from '../../server/utils/operation-recovery'
import { reconcileSiteDisplay } from '../../server/utils/site-display-reconcile'
import { FakeMediaStorage } from '../helpers/fake-media-storage'
import type {
  PublicProcessInput,
} from '../../server/utils/media-storage'

/**
 * T34-F5 真实进程中断子进程。
 *
 * 这个文件只在测试里被 spawn，永远不进生产产物；failpoint 因此完全留在
 * 测试侧，业务代码里没有任何 barrier 或 kill 钩子。
 *
 * 父进程读 barrier 文件得知子进程已经到达指定阶段，然后 SIGKILL。
 * 子进程在 barrier 之后主动 hang，保证 kill 精确落在该边界上。
 *
 * 用法：
 *   node tsx operation-interrupt-child.ts <databaseFile> <barrierFile> <mode>
 *
 * mode：
 *   generate  第一次公开对象生成时挂住 → 在生成阶段被杀
 *   verify    最后一个变体校验读取时挂住 → 在公开对象验证阶段被杀
 *   commit    全部生成完成、进入最终提交事务前挂住 → 在提交边界被杀
 *   cleanup   删除公开对象时挂住 → 在清理阶段被杀
 *   recover   不挂住：执行启动恢复扫描并打印摘要
 *   run       不挂住：正常跑完一次 reconcile 并打印摘要
 */

const [databaseFile, barrierFile, mode, ownerOverride] = process.argv.slice(2)

if (!databaseFile || !barrierFile || !mode) {
  throw new Error('usage: <databaseFile> <barrierFile> <mode> [leaseOwner]')
}

function reachedBarrier(stage: string) {
  appendFileSync(barrierFile, `${stage}\n`)
}

/** 永不 resolve：让父进程的 SIGKILL 精确落在当前阶段。 */
function hangForever(): Promise<never> {
  return new Promise(() => {})
}

const sqlite: Database.Database = openDatabase(databaseFile).sqlite
resetOperationLeaseOwner(ownerOverride ?? `interrupt-child/${process.pid}/aaaaaaaa`)

/** 期望的生成总数：由待补齐目标推导，用于识别"最后一个变体"。 */
const expectedProcessCalls = Number(process.env.INTERRUPT_EXPECTED_CALLS ?? '0')

class InterruptibleStorage extends FakeMediaStorage {
  processed = 0

  override async processPrivateToPublic(input: PublicProcessInput) {
    if (mode === 'generate' && this.processed === 0) {
      reachedBarrier('generate')
      await hangForever()
    }
    await super.processPrivateToPublic(input)
    this.processed += 1
    if (mode === 'commit' && this.processed === expectedProcessCalls) {
      // 全部对象已生成并落库，尚未进入最终提交事务。
      reachedBarrier('commit')
      await hangForever()
    }
  }

  override async getPublicAnonymous(objectKey: string) {
    if (mode === 'verify' && this.processed === expectedProcessCalls) {
      reachedBarrier('verify')
      await hangForever()
    }
    return super.getPublicAnonymous(objectKey)
  }

  override async deletePublic(objectKey: string) {
    if (mode === 'cleanup') {
      reachedBarrier('cleanup')
      await hangForever()
    }
    return super.deletePublic(objectKey)
  }
}

/** 子进程需要看到父进程种下的私有原图，因此按数据库记录重新 seed。 */
function seedPrivateSources(storage: FakeMediaStorage) {
  const assets = sqlite.prepare(`
    SELECT
      private_object_key AS objectKey, sha256, byte_size AS byteSize,
      mime_type AS mimeType, width, height
    FROM assets WHERE status = 'READY'
  `).all() as Array<{
    byteSize: number
    height: number
    mimeType: string
    objectKey: string
    sha256: string
    width: number
  }>
  for (const asset of assets) {
    // 内容本身不参与断言，只需要长度与摘要一致的可读对象。
    const content = Buffer.alloc(asset.byteSize, 1)
    storage.seedPrivate(asset.objectKey, content, asset.mimeType, asset.sha256, {
      fileSize: asset.byteSize,
      format: asset.mimeType === 'image/png' ? 'png' : 'jpeg',
      height: asset.height,
      orientation: 1,
      width: asset.width,
    })
  }
}

const storage = new InterruptibleStorage()
seedPrivateSources(storage)

if (mode === 'recover') {
  const summary = await recoverPendingOperations({ sqlite, storage })
  process.stdout.write(`${JSON.stringify(summary)}\n`)
}
else {
  const result = await reconcileSiteDisplay({
    sqlite,
    storage,
    dryRun: false,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
sqlite.close()
