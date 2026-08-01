import { resolve } from 'node:path'
import type { Page } from '@playwright/test'

const SCREENSHOT_DIR = resolve(
  process.cwd(),
  'agent_docs/需求1-兽装工作室主页/implementation/notes/t14-t18-ui/screenshots',
)

export async function capture(page: Page, name: string) {
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, `${name}.png`),
    fullPage: false,
  })
}
