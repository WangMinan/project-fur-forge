import { expect, test } from '@playwright/test'
import { adminBaseURL, fetchSession, loginAsAdmin } from './helpers/auth'
import { bumpWorkViaApi, createWorkViaApi } from './helpers/admin-work'
import { capture } from './helpers/screenshots'

test.describe('未登录访问保护', () => {
  test('未登录访问新建与编辑页只落登录页', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/new`)
    await expect(page).toHaveURL(/\/admin\/login/)

    await page.goto(`${adminBaseURL}/admin/works/00000000-0000-4000-8000-000000000000`)
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})

test.describe('创建作品', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('界面创建草稿后进入编辑页，刷新后读取持久化数据', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/new`)
    await page.getByLabel(/角色名/).fill('雪团')
    await page.getByLabel(/链接别名/).fill(`snow-tuan-${Date.now().toString(36)}`)
    await page.getByLabel(/物种/).fill('犬')
    await page.getByLabel('角色主人公开值').selectOption('不公开')
    await page.getByLabel(/联系人/).fill('QQ 123456（仅后台）')
    await page.getByRole('button', { name: '添加属性' }).click()
    await page.getByLabel('作品属性第 1 条').fill('蓝白')
    await page.getByRole('button', { name: '创建草稿' }).click()

    await expect(page).toHaveURL(/\/admin\/works\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { level: 1, name: '雪团' })).toBeVisible()
    await expect(page.getByLabel(/角色名/)).toHaveValue('雪团')
    await expect(page.getByLabel('角色主人公开值')).toHaveValue('不公开')
    await expect(page.getByLabel(/联系人/)).toHaveValue('QQ 123456（仅后台）')
    await expect(page.getByLabel('作品属性第 1 条')).toHaveValue('蓝白')

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: '雪团' })).toBeVisible()
    await expect(page.getByLabel(/联系人/)).toHaveValue('QQ 123456（仅后台）')

    // 列表包含新作品，且不出现联系人。
    await page.goto(`${adminBaseURL}/admin/works`)
    await expect(page.getByRole('link', { name: '雪团', exact: true }).first()).toBeVisible()
    await expect(page.getByText(/QQ 123456/)).toHaveCount(0)
  })

  test('链接别名冲突显示持久错误且输入保留', async ({ page }) => {
    const takenSlug = `taken-slug-${Date.now().toString(36)}`
    await createWorkViaApi(page, { slug: takenSlug })
    await page.goto(`${adminBaseURL}/admin/works/new`)
    await page.getByLabel(/角色名/).fill('冲突验证')
    await page.getByLabel(/链接别名/).fill(takenSlug)
    await page.getByLabel(/物种/).fill('猫')
    await page.getByRole('button', { name: '创建草稿' }).click()

    await expect(page.getByRole('alert')).toContainText('链接别名已被使用')
    await expect(page.getByLabel(/角色名/)).toHaveValue('冲突验证')
    await expect(page).toHaveURL(/\/admin\/works\/new$/)
  })

  test('客户端校验阻止空必填与非法 slug', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/new`)
    await page.getByRole('button', { name: '创建草稿' }).click()
    await expect(page.getByRole('alert')).toContainText('角色名与物种为必填项')

    await page.getByLabel(/角色名/).fill('校验验证')
    await page.getByLabel(/物种/).fill('犬')
    await page.getByLabel(/链接别名/).fill('INVALID SLUG')
    await page.getByRole('button', { name: '创建草稿' }).click()
    await expect(page.getByRole('alert')).toContainText('链接别名只能使用小写字母')
    await expect(page).toHaveURL(/\/admin\/works\/new$/)
  })
})

test.describe('删除作品', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('列表确认后删除草稿并保留明确影响说明', async ({ page }) => {
    const work = await createWorkViaApi(page, { characterName: '待删除作品' })
    await page.goto(`${adminBaseURL}/admin/works`)
    const row = page.getByRole('row').filter({ hasText: '待删除作品' })

    await row.getByRole('button', { name: '删除 待删除作品' }).click()
    const dialog = page.getByRole('dialog', { name: '删除「待删除作品」？' })
    await expect(dialog).toContainText('私有原图保留')
    await dialog.getByRole('button', { name: '确认删除' }).click()

    await expect(page.getByRole('link', { name: '待删除作品', exact: true })).toHaveCount(0)
    expect((await page.request.get(
      `${adminBaseURL}/api/admin/v1/works/${work.id}`,
    )).status()).toBe(404)
  })
})

test.describe('编辑与保存', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('保存后 dirty 清除，刷新读取持久化数据', async ({ page }) => {
    const work = await createWorkViaApi(page, { characterName: '保存验证' })
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')

    await page.getByLabel(/角色名/).fill('保存验证改')
    await expect(page.getByText('有未保存更改')).toBeVisible()
    await page.getByRole('button', { name: '保存', exact: true }).click()

    await expect(page.getByText('已保存。')).toBeVisible()
    await expect(page.getByText('有未保存更改')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: '保存验证改' })).toBeVisible()

    await page.reload()
    await expect(page.getByLabel(/角色名/)).toHaveValue('保存验证改')
    await expect(page.getByText('未更改')).toBeVisible()
  })

  test('未保存离开时浏览器确认提醒', async ({ page }) => {
    const work = await createWorkViaApi(page)
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')
    await page.getByLabel(/角色名/).fill('未保存修改')

    let dialogSeen = false
    page.on('dialog', async (dialog) => {
      dialogSeen = true
      expect(dialog.message()).toContain('未保存')
      await dialog.dismiss()
    })
    await page.getByRole('link', { name: '← 作品' }).click()
    await expect.poll(() => dialogSeen).toBe(true)
    // 取消离开后仍在编辑页。
    await expect(page).toHaveURL(new RegExp(`/admin/works/${work.id}$`))
  })

  test('版本冲突：显示持久横幅，重新加载后可保存', async ({ page }) => {
    const work = await createWorkViaApi(page, { characterName: '冲突目标' })
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')
    await page.getByLabel(/角色名/).fill('本地编辑')

    // 另一会话修改了作品（版本递增）
    await bumpWorkViaApi(page, work, { characterName: '远端版本' })

    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByRole('alert').first()).toContainText('版本冲突')

    await page.getByRole('button', { name: '重新加载（放弃本地更改）' }).click()
    await expect(page.getByLabel(/角色名/)).toHaveValue('远端版本')
    await expect(page.getByText('未更改')).toBeVisible()

    await page.getByLabel(/角色名/).fill('再次编辑')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByText('已保存。')).toBeVisible()
  })

  test('400 与 500：持久错误提示，输入保留，恢复后可保存', async ({ page }) => {
    const work = await createWorkViaApi(page, { characterName: '错误验证' })
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')

    await page.route(`**/api/admin/v1/works/${work.id}`, async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'VALIDATION_ERROR', message: 'Request body is invalid.' },
          }),
        })
        return
      }
      await route.continue()
    })
    await page.getByLabel(/角色名/).fill('错误验证改')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('未通过校验')
    await expect(page.getByLabel(/角色名/)).toHaveValue('错误验证改')

    await page.unrouteAll()
    await page.route(`**/api/admin/v1/works/${work.id}`, async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' },
          }),
        })
        return
      }
      await route.continue()
    })
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('保存失败，请稍后重试')

    await page.unrouteAll()
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByText('已保存。')).toBeVisible()
  })

  test('保存期间禁用重复提交', async ({ page }) => {
    const work = await createWorkViaApi(page)
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')

    let putRequests = 0
    await page.route(`**/api/admin/v1/works/${work.id}`, async (route) => {
      if (route.request().method() === 'PUT') {
        putRequests += 1
        await new Promise(resolvePromise => setTimeout(resolvePromise, 400))
      }
      await route.continue()
    })
    await page.getByLabel(/角色名/).fill('防重验证')
    const save = page.getByRole('button', { name: '保存', exact: true })
    await save.click()
    await expect(save).toBeDisabled()
    await expect(page.getByText('已保存。')).toBeVisible()
    expect(putRequests).toBe(1)
  })
})

test.describe('公开预览与泄漏边界', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('公开预览展示安全字段，DOM 与响应不含联系人/私有 Key/签名 URL', async ({ page }) => {
    const contact = `e2e-leak-contact-${Date.now().toString(36)}`
    const work = await createWorkViaApi(page, {
      characterName: '泄漏验证',
      ownerContact: contact,
      featureTags: ['长毛', '蓝白'],
    })

    const adminResponses: string[] = []
    page.on('response', (response) => {
      if (
        response.url().includes('/api/admin/')
        && !/\/api\/admin\/v1\/media\/assets\/[^/]+\/preview$/u.test(response.url())
      ) {
        void response.text().then(text => adminResponses.push(text)).catch(() => {})
      }
    })

    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')

    const preview = page.getByTestId('public-preview')
    await expect(preview).toContainText('泄漏验证')
    await expect(preview).toContainText(`/works/${work.slug}`)
    await expect(preview).toContainText('长毛、蓝白')
    await expect(preview).toContainText('媒体未就绪')
    await expect(preview).toContainText('不含联系人')

    // 编辑页详情允许显示联系人（仅后台）；公开预览面板与列表不得出现。
    await expect(page.getByLabel(/联系人/)).toHaveValue(contact)
    await expect(preview).not.toContainText(contact)

    await page.goto(`${adminBaseURL}/admin/works`)
    await expect(page.getByText(contact)).toHaveCount(0)

    // 全部管理端响应：不含私有 Object Key、签名参数；列表/公开预览不含联系人。
    await expect
      .poll(() => adminResponses.some(text => text.includes('/original/') || text.includes('/processing/')))
      .toBe(false)
    for (const text of adminResponses) {
      expect(text).not.toContain('x-oss-')
      expect(text).not.toContain('Signature=')
      expect(text).not.toContain('X-Oss-')
    }
    const listOrPreview = adminResponses.filter(text =>
      text.includes('studioPhotoCount') || text.includes('mediaReady'),
    )
    for (const text of listOrPreview) {
      expect(text).not.toContain(contact)
    }
  })

  test('管理端请求带 no-store 与 noindex', async ({ page }) => {
    const work = await createWorkViaApi(page)
    const response = await page.request.get(`${adminBaseURL}/api/admin/v1/works/${work.id}`)
    expect(response.headers()['cache-control']).toContain('no-store')
    expect(response.headers()['x-robots-tag']).toContain('noindex')
  })

  test('列表与新建页三视口截图与横向溢出检查', async ({ page }) => {
    await createWorkViaApi(page, { characterName: '截图验证' })
    for (const [width, height, label] of [
      [390, 844, '390x844'],
      [768, 1024, '768x1024'],
      [1440, 900, '1440x900'],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(`${adminBaseURL}/admin/works`)
      await expect(page.getByRole('heading', { level: 1, name: '作品' })).toBeVisible()
      await capture(page, `works-list-${label}`)
      const overflow = await page.evaluate(() =>
        document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${label} 列表页不应横向溢出`).toBeLessThanOrEqual(1)
    }
  })

  test('编辑器键盘可达性与 reduced-motion', async ({ page }) => {
    const work = await createWorkViaApi(page, { characterName: '可达验证' })
    const session = await page.context().newCDPSession(page)
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')

    // 键盘从角色名开始可顺次到达保存按钮与文件选择按钮。
    await page.getByLabel(/角色名/).focus()
    await expect(page.getByLabel(/角色名/)).toBeFocused()
    await page.getByRole('button', { name: '选择照片' }).focus()
    await expect(page.getByRole('button', { name: '选择照片' })).toBeFocused()

    const transitionDuration = await page
      .getByRole('button', { name: '选择照片' })
      .evaluate(element => getComputedStyle(element).transitionDuration)
    expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.011)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.setViewportSize({ width: 1440, height: 900 })
    const overflow = await page.evaluate(() =>
      document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('登录 Session 在使用中失效回到登录页', async ({ page }) => {
    const work = await createWorkViaApi(page)
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')

    await page.context().clearCookies()
    await page.getByLabel(/角色名/).fill('失效验证')
    await page.getByRole('button', { name: '保存', exact: true }).click()

    await expect(page).toHaveURL(/\/admin\/login/)
    expect((await fetchSession(page)).status()).toBe(401)
  })
})
