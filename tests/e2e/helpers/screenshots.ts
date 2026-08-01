import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'

const SCREENSHOT_DIR = resolve(
  process.cwd(),
  'agent_docs/需求1-兽装工作室主页/implementation/notes/t14-t18-ui/screenshots',
)

export async function capture(page: Page, name: string, directory?: string) {
  const content = await page.screenshot({
    fullPage: false,
  })
  const path = resolve(directory ?? SCREENSHOT_DIR, `${name}.png`)
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
