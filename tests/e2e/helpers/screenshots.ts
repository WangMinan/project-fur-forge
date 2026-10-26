import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'

const ARTIFACT_ROOT = resolve(process.cwd(), 'test-results/screenshots')

export async function capture(page: Page, name: string, directory?: string) {
  const content = await page.screenshot({
    fullPage: false,
  })
  const target = resolve(ARTIFACT_ROOT, directory ?? '')
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
