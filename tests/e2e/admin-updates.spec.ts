import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin } from './helpers/auth'

async function openUpdates(page: import('@playwright/test').Page) {
  await loginAsAdmin(page)
  await page.goto(`${adminBaseURL}/admin/updates`)
  await expect(page.getByRole('heading', { name: '动态管理', level: 1 }))
    .toBeVisible()
}

async function createDraft(
  page: import('@playwright/test').Page,
  title: string,
) {
  await page.locator('#update-form-title').fill(title)
  await page.getByLabel('正文').fill('第一行\n第二行')
  await page.getByRole('button', { name: '保存为草稿' }).click()
  const row = page.locator('[data-update-id]').filter({ hasText: title })
  await expect(row).toBeVisible()
  await expect(row).toContainText('草稿')
  return row
}

test('动态后台可新增、编辑、发布、下架与删除', async ({ page }) => {
  await openUpdates(page)
  const title = `E2E 动态 ${Date.now()}`
  let row = await createDraft(page, title)

  await row.getByRole('button', { name: '编辑' }).click()
  await page.getByLabel('类型').selectOption('drop')
  await page.locator('#update-form-title').fill(`${title}（更新）`)
  await page.getByRole('button', { name: '保存修改' }).click()
  row = page.locator('[data-update-id]').filter({ hasText: `${title}（更新）` })
  await expect(row).toContainText('掉落预告')

  await row.getByRole('button', { name: '发布' }).click()
  await expect(row).toContainText('已发布')
  await expect(row).toContainText('发布时间')

  await row.getByRole('button', { name: '下架' }).click()
  await expect(row).toContainText('已下架')

  await row.getByRole('button', { name: '删除' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: '确认删除' }).click()
  await expect(row).toHaveCount(0)
})

test('动态编辑遇到陈旧版本时保留本地草稿并给出中文反馈', async ({ browser }) => {
  const first = await browser.newContext()
  const second = await browser.newContext()
  const pageA = await first.newPage()
  const pageB = await second.newPage()

  try {
    await openUpdates(pageA)
    const title = `E2E 并发 ${Date.now()}`
    const rowA = await createDraft(pageA, title)
    await loginAsAdmin(pageB)
    await pageB.goto(`${adminBaseURL}/admin/updates`)
    await expect(pageB.locator('[data-update-id]').filter({ hasText: title }))
      .toBeVisible()

    await rowA.getByRole('button', { name: '编辑' }).click()
    const rowB = pageB.locator('[data-update-id]').filter({ hasText: title })
    await rowB.getByRole('button', { name: '编辑' }).click()

    await pageA.getByLabel('正文').fill('A 已保存的内容')
    await pageA.getByRole('button', { name: '保存修改' }).click()
    // `click()` 只等待点击派发，不等待 Vue 异步 submit 中的网络请求。
    // 先观察 A 端保存完成，才能确定随后 B 端提交使用的是陈旧版本。
    await expect(pageA.getByRole('heading', { name: '新增动态', level: 2 }))
      .toBeVisible()
    await expect(rowA).toContainText('A 已保存的内容')
    await pageB.getByLabel('正文').fill('B 需要保留的本地草稿')
    await pageB.getByRole('button', { name: '保存修改' }).click()

    await expect(pageB.getByRole('alert')).toContainText('已在别处修改')
    await expect(pageB.getByLabel('正文')).toHaveValue('B 需要保留的本地草稿')
  }
  finally {
    await first.close()
    await second.close()
  }
})

test('动态后台三个固定视口无横向溢出且控件可达', async ({ page }) => {
  await openUpdates(page)

  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height })
    await expect(page.locator('#update-form-title')).toBeVisible()
    await expect(page.getByRole('link', { name: '动态管理' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible()
    const username = page.locator('.admin-shell__user')
    if (width >= 1280) {
      await expect(username).toHaveText('e2e-admin')
      await expect(username).toBeVisible()
    }
    else {
      await expect(username).toBeHidden()
    }
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
  }
})
