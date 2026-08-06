import { mkdir, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import type { Page } from '@playwright/test'

const SCREENSHOT_DIR = resolve(
  process.cwd(),
  'agent_docs/需求1-兽装工作室主页/implementation/notes/t14-t18/t14-t18-ui/screenshots',
)

const NOTES_ROOT = resolve(
  process.cwd(),
  'agent_docs/需求1-兽装工作室主页/implementation/notes',
)
const ARTIFACT_ROOT = resolve(process.cwd(), 'test-results/screenshots')

/**
 * T34-F2：E2E 截图一律进入 test-results，不覆盖 implementation/notes 里的
 * 历史证据。各 spec 仍按语义传入 notes 路径，这里统一改写为镜像目录，
 * 因此不需要在六个 spec 里各改一次，也不会丢掉分目录结构。
 */
function artifactPath(directory: string) {
  const inNotes = relative(NOTES_ROOT, directory)
  return inNotes.startsWith('..')
    ? directory
    : resolve(ARTIFACT_ROOT, inNotes)
}

export async function capture(page: Page, name: string, directory?: string) {
  const content = await page.screenshot({
    fullPage: false,
  })
  const target = artifactPath(resolve(directory ?? SCREENSHOT_DIR))
  await mkdir(target, { recursive: true })
  const path = resolve(target, `${name}.png`)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await writeFile(path, content)
      return
    }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (attempt === 2 || !['EBUSY', 'EPERM', 'UNKNOWN'].includes(code ?? '')) {
        throw error
      }
      await new Promise(resolveDelay => setTimeout(resolveDelay, 100))
    }
  }
}
