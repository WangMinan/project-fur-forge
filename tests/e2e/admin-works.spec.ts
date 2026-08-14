import { expect, test } from '@playwright/test'
import { adminBaseURL, fetchSession, loginAsAdmin, publicBaseURL } from './helpers/auth'
import { bumpWorkViaApi, createWorkViaApi } from './helpers/admin-work'
import { seedPublicCatalog } from './helpers/public-catalog'
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
    await page.getByRole('button', { name: '不公开' }).click()
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
    await page.getByRole('searchbox', { name: '查找作品' }).fill('雪团')
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

    await expect(page.getByRole('alert')).toContainText('链接别名已被其他作品使用')
    await expect(page.getByLabel(/角色名/)).toHaveValue('冲突验证')
    await expect(page).toHaveURL(/\/admin\/works\/new$/)
  })

  test('客户端校验阻止空必填与非法 slug，错误与控件关联', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/new`)
    await page.getByRole('button', { name: '创建草稿' }).click()
    await expect(page.getByRole('alert')).toContainText('请修正下方标注的字段')
    await expect(page.getByText('角色名为必填项')).toBeVisible()
    await expect(page.getByText('物种为必填项')).toBeVisible()
    await expect(page.getByLabel(/角色名/)).toHaveAttribute('aria-invalid', 'true')

    await page.getByLabel(/角色名/).fill('校验验证')
    await page.getByLabel(/物种/).fill('犬')
    await page.getByLabel(/链接别名/).fill('INVALID SLUG')
    await expect(page.getByText('只能使用小写字母、数字与连字符')).toBeVisible()
    await page.getByRole('button', { name: '创建草稿' }).click()
    await expect(page).toHaveURL(/\/admin\/works\/new$/)
  })
})

test.describe('T22 完整字段：三用途、领养、价格与首页精选', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  async function fillBasics(
    page: import('@playwright/test').Page,
    name: string,
    slug: string,
  ) {
    await page.goto(`${adminBaseURL}/admin/works/new`)
    await page.getByLabel(/角色名/).fill(name)
    await page.getByLabel(/链接别名/).fill(slug)
    await page.getByLabel(/物种/).fill('犬')
  }

  test('创建委托作品：不提交领养字段，公开预览无领养事实', async ({ page }) => {
    const slug = `t22-commission-${Date.now().toString(36)}`
    await fillBasics(page, 'T22 委托', slug)
    await expect(page.getByTestId('purpose-note')).toContainText('委托作品')
    await expect(page.getByTestId('adoption-fields')).toHaveCount(0)

    const request = page.waitForRequest(req =>
      req.url().endsWith('/api/admin/v1/works') && req.method() === 'POST',
    )
    await page.getByRole('button', { name: '创建草稿' }).click()
    const body = JSON.parse((await request).postData() ?? '{}') as Record<string, unknown>
    expect(body.purpose).toBe('commission')
    expect(body).not.toHaveProperty('adoptionMethod')
    expect(body).not.toHaveProperty('businessStatus')
    expect(body).not.toHaveProperty('priceCnyMinor')
    expect(body.sortOrder).toBe(0)
    expect(body.featured).toBe(false)

    await expect(page).toHaveURL(/\/admin\/works\/[0-9a-f-]{36}$/)
    const preview = page.getByTestId('public-preview')
    await expect(preview).toContainText('委托作品')
    await expect(preview).not.toContainText('领养方式')
    await expect(preview).not.toContainText('价格')
  })

  test('创建展示作品并加入精选，顺序交给精选 Tab 维护', async ({ page }) => {
    const slug = `t22-showcase-${Date.now().toString(36)}`
    await fillBasics(page, 'T22 展示', slug)
    await page.getByLabel('业务类型').selectOption('showcase')
    await page.getByLabel('加入首页精选作品').check()
    await page.getByRole('button', { name: '创建草稿' }).click()

    await expect(page).toHaveURL(/\/admin\/works\/[0-9a-f-]{36}$/)
    await expect(page.getByTestId('public-preview')).toContainText('展示作品')
    await expect(page.getByTestId('public-preview')).toContainText('已加入（顺序在精选 Tab 调整）')
    await page.reload()
    await expect(page.getByLabel('人工排序')).toHaveCount(0)
    await expect(page.getByLabel('加入首页精选作品')).toBeChecked()
    await expect(page.getByRole('link', { name: '前往调整精选顺序' })).toBeVisible()
  })

  test('创建常规领养：价格按元输入、按分提交，刷新后往返一致', async ({ page }) => {
    const slug = `t22-adoption-${Date.now().toString(36)}`
    await fillBasics(page, 'T22 领养', slug)
    await page.getByLabel('业务类型').selectOption('regular_adoption')
    await expect(page.getByTestId('adoption-fields')).toBeVisible()
    await expect(page.getByLabel('领养方式')).toHaveValue('常规领养')
    await page.getByLabel('业务状态').selectOption('available')
    await page.getByLabel(/领养价格/).fill('8800.50')

    const request = page.waitForRequest(req =>
      req.url().endsWith('/api/admin/v1/works') && req.method() === 'POST',
    )
    await page.getByRole('button', { name: '创建草稿' }).click()
    const body = JSON.parse((await request).postData() ?? '{}') as Record<string, unknown>
    expect(body.purpose).toBe('adoption')
    expect(body.adoptionMethod).toBe('regular')
    expect(body.businessStatus).toBe('available')
    expect(body.priceCnyMinor).toBe(880_050)

    await expect(page).toHaveURL(/\/admin\/works\/[0-9a-f-]{36}$/)
    await expect(page.getByTestId('public-preview')).toContainText('¥8,800.50')
    await page.reload()
    await expect(page.getByLabel(/领养价格/)).toHaveValue('8800.50')
    await expect(page.getByLabel('业务状态')).toHaveValue('available')
    // T25 后端已开放 regular adoption；缺少 T23 设定图时必须明确阻断。
    await expect(page.getByTestId('publication-panel')).toContainText('领养作品必须保存一张设定图')
  })

  test('非法价格在客户端阻断并给出关联错误', async ({ page }) => {
    const work = await createWorkViaApi(page, {
      characterName: '价格校验',
      purpose: 'adoption',
      businessStatus: 'available',
    })
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')

    for (const [value, expected] of [
      ['0', '金额必须大于 0'],
      ['-1', '不接受负数'],
      ['12.345', '请输入最多两位小数的金额'],
    ] as const) {
      await page.getByLabel(/领养价格/).fill(value)
      await page.getByRole('button', { name: '保存', exact: true }).click()
      await expect(page.getByRole('alert')).toContainText('请修正下方标注的字段')
      await expect(page.getByText(expected)).toBeVisible()
      await expect(page.getByLabel(/领养价格/)).toHaveAttribute('aria-invalid', 'true')
      await page.getByRole('button', { name: '知道了' }).click()
    }

    await page.getByLabel(/领养价格/).fill('15600')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByText('已保存。')).toBeVisible()
    await expect(page.getByTestId('public-preview')).toContainText('¥15,600')
  })

  test('短属性重复、空白与超长逐条报错，顺序可调整', async ({ page }) => {
    const work = await createWorkViaApi(page, {
      characterName: '属性校验',
      featureTags: ['蓝白', '长毛'],
    })
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')

    await page.getByRole('button', { name: '添加属性' }).click()
    await page.getByLabel('作品属性第 3 条').fill('蓝白')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByText('与第 1 条重复')).toBeVisible()
    await page.getByRole('button', { name: '知道了' }).click()

    await page.getByLabel('作品属性第 3 条').fill('   ')
    await expect(page.getByText('属性不能为空')).toBeVisible()

    await page.getByLabel('作品属性第 3 条').fill('超'.repeat(25))
    await expect(page.getByText('属性最多 24 个字符')).toBeVisible()

    await page.getByRole('button', { name: '删除第 3 条属性' }).click()
    await page.getByRole('button', { name: '第 2 条属性上移' }).click()
    await expect(page.getByLabel('作品属性第 1 条')).toHaveValue('长毛')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByText('已保存。')).toBeVisible()
    await expect(page.getByTestId('public-preview')).toContainText('长毛、蓝白')

    await page.reload()
    await expect(page.getByLabel('作品属性第 1 条')).toHaveValue('长毛')
  })

  test('切换用途会说明字段变化，并且不提交隐藏字段', async ({ page }) => {
    const work = await createWorkViaApi(page, {
      characterName: '用途切换',
      purpose: 'adoption',
      businessStatus: 'available',
      priceCnyMinor: 1_560_000,
    })
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')
    await expect(page.getByLabel(/领养价格/)).toHaveValue('15600')

    await page.getByLabel('业务类型').selectOption('showcase')
    await expect(page.getByTestId('adoption-fields')).toHaveCount(0)
    await expect(page.getByTestId('purpose-note')).toContainText('不会提交')
    await expect(page.getByText('切换离开领养后')).toBeVisible()

    const request = page.waitForRequest(req =>
      req.url().includes(`/api/admin/v1/works/${work.id}`) && req.method() === 'PUT',
    )
    await page.getByRole('button', { name: '保存', exact: true }).click()
    const payload = (JSON.parse((await request).postData() ?? '{}') as {
      payload: Record<string, unknown>
    }).payload
    expect(payload.purpose).toBe('showcase')
    expect(payload).not.toHaveProperty('priceCnyMinor')
    expect(payload).not.toHaveProperty('businessStatus')

    await expect(page.getByText('已保存。')).toBeVisible()
    await expect(page.getByTestId('public-preview')).toContainText('展示作品')
    await expect(page.getByTestId('public-preview')).not.toContainText('¥15,600')
  })

  test('全部作品保留最近修改语义，可勾选精选并自动追加到末尾', async ({ page }) => {
    const suffix = Date.now().toString(36)
    const work = await createWorkViaApi(page, {
      characterName: `列表领养-${suffix}`,
      purpose: 'adoption',
      businessStatus: 'available',
      priceCnyMinor: 1_560_000,
    })
    await page.goto(`${adminBaseURL}/admin/works`)
    await page.getByRole('searchbox', { name: '查找作品' })
      .fill(`列表领养-${suffix}`)
    const row = page.getByRole('row').filter({ hasText: `列表领养-${suffix}` })
    await expect(row).toContainText('可领养')
    await expect(row).toContainText('¥15,600')

    await expect(row.getByLabel('排序')).toHaveCount(0)
    const saved = page.waitForResponse(response =>
      response.url().endsWith(`/api/admin/v1/works/${work.id}/presentation`)
      && response.request().method() === 'PUT',
    )
    const featured = row.getByLabel('加入首页精选', { exact: true })
    await featured.check()
    expect((await saved).status()).toBe(200)
    await expect(row.getByLabel('加入首页精选', { exact: true })).toBeChecked()
    await expect(row).toContainText(/当前第 \d+ 位/)
    await expect(row.getByRole('link', { name: '前往调整顺序' })).toBeVisible()

    await page.reload()
    await page.getByRole('searchbox', { name: '查找作品' })
      .fill(`列表领养-${suffix}`)
    const reloaded = page.getByRole('row').filter({ hasText: `列表领养-${suffix}` })
    await expect(reloaded.getByLabel('排序')).toHaveCount(0)
    await expect(reloaded.getByLabel('加入首页精选', { exact: true })).toBeChecked()
  })

  test('已发布作品可直接精选，重复精选顺位自动避让并进入公开首页', async ({ page }) => {
    const suffix = Date.now().toString(36)
    const firstName = `已精选-${suffix}`
    const secondName = `待精选-${suffix}`
    const firstSlug = `e2e-public-featured-${suffix}` as const
    const secondSlug = `e2e-public-featured-next-${suffix}` as const
    await seedPublicCatalog(page, [
      {
        slug: firstSlug,
        characterName: firstName,
        featured: true,
        sortOrder: 0,
        publicationStatus: 'published',
        photos: [{ alt: `${firstName}出厂照` }],
      },
      {
        slug: secondSlug,
        characterName: secondName,
        featured: false,
        sortOrder: 0,
        publicationStatus: 'published',
        photos: [{ alt: `${secondName}出厂照` }],
      },
    ])

    await page.goto(`${adminBaseURL}/admin/works`)
    const row = page.getByRole('row').filter({ hasText: secondName })
    const saved = page.waitForResponse(response =>
      response.url().endsWith('/presentation')
      && response.request().method() === 'PUT',
    )
    await row.getByLabel('加入首页精选', { exact: true }).check()
    expect((await saved).status()).toBe(200)

    const updated = page.getByRole('row').filter({ hasText: secondName })
    await expect(updated.getByLabel('加入首页精选', { exact: true })).toBeChecked()
    await expect(updated).toContainText(/当前第 \d+ 位/)

    await page.getByRole('link', { name: '首页精选', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/works\?tab=featured$/)
    await expect(page.getByRole('heading', { name: '首页精选顺序' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: firstName })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: secondName })).toBeVisible()

    await page.goto(publicBaseURL)
    const featured = page.getByTestId('featured-works')
    await expect(featured).toContainText(firstName)
    await expect(featured).toContainText(secondName)
  })

  test('已发布作品在内层编辑页仍可保存精选成员关系', async ({ page }) => {
    const suffix = Date.now().toString(36)
    const firstName = `详情优先-${suffix}`
    const secondName = `详情候选-${suffix}`
    await seedPublicCatalog(page, [
      {
        slug: `e2e-public-detail-featured-${suffix}`,
        characterName: firstName,
        featured: true,
        sortOrder: 0,
        publicationStatus: 'published',
        photos: [{ alt: `${firstName}出厂照` }],
      },
      {
        slug: `e2e-public-detail-next-${suffix}`,
        characterName: secondName,
        featured: false,
        sortOrder: 0,
        publicationStatus: 'published',
        photos: [{ alt: `${secondName}出厂照` }],
      },
    ])

    await page.goto(`${adminBaseURL}/admin/works`)
    await page.getByRole('link', { name: secondName, exact: true }).click()
    await expect(page.getByLabel('人工排序')).toHaveCount(0)
    await expect(page.getByLabel('加入首页精选作品')).toBeEnabled()

    const saved = page.waitForResponse(response =>
      response.url().endsWith('/presentation')
      && response.request().method() === 'PUT',
    )
    await page.getByLabel('加入首页精选作品').check()
    await page.getByRole('button', { name: '保存首页精选' }).click()
    expect((await saved).status()).toBe(200)
    await expect(page.getByText('首页精选设置已保存，公开端已更新。')).toBeVisible()
    await expect(page.getByLabel('加入首页精选作品')).toBeChecked()

    await page.goto(publicBaseURL)
    const featured = page.getByTestId('featured-works')
    await expect(featured).toContainText(firstName)
    await expect(featured).toContainText(secondName)
  })

  test('精选 Tab 将第 4 件置顶时一次提交完整顺序，其余作品保持相对次序', async ({ page }) => {
    const suffix = Date.now().toString(36)
    const entries: Array<Awaited<ReturnType<typeof createWorkViaApi>>> = []
    for (const index of [0, 1, 2, 3]) {
      entries.push(await createWorkViaApi(page, {
        characterName: `精选编排-${suffix}-${index}`,
        featured: true,
      }))
    }

    await page.goto(`${adminBaseURL}/admin/works?tab=featured`)
    await expect(page.getByRole('heading', { name: '首页精选顺序' })).toBeVisible()
    const targetName = `精选编排-${suffix}-3`
    const requestPromise = page.waitForRequest(request =>
      request.url().endsWith('/api/admin/v1/works/featured-order')
      && request.method() === 'PUT',
    )
    await page.getByRole('button', { name: `将 ${targetName} 置顶` }).click()
    const request = await requestPromise
    const payload = JSON.parse(request.postData() ?? '{}') as {
      payload: { items: Array<{ expectedVersion: number, id: string }> }
    }
    expect(payload.payload.items[0]?.id).toBe(entries[3]?.id)
    expect(new Set(payload.payload.items.map(item => item.id)).size)
      .toBe(payload.payload.items.length)
    const positions = entries.slice(0, 3).map(entry =>
      payload.payload.items.findIndex(item => item.id === entry.id),
    )
    expect(positions[0]).toBeLessThan(positions[1]!)
    expect(positions[1]).toBeLessThan(positions[2]!)

    const cards = page.locator('.featured-order__item')
    await expect(cards.first()).toContainText(targetName)
    await expect(cards.first().locator('.featured-order__position')).toHaveText('1')
  })

  test('精选完整排序遇到版本变化会整体冲突并自动重新加载', async ({ page }) => {
    const suffix = Date.now().toString(36)
    const firstName = `精选冲突-${suffix}-0`
    const secondName = `精选冲突-${suffix}-1`
    const first = await createWorkViaApi(page, {
      characterName: firstName,
      featured: true,
    })
    await createWorkViaApi(page, {
      characterName: secondName,
      featured: true,
    })

    await page.goto(`${adminBaseURL}/admin/works?tab=featured`)
    await expect(page.getByRole('button', { name: `将 ${secondName} 置顶` })).toBeEnabled()
    await bumpWorkViaApi(page, first, { characterName: `${firstName}-远端` })
    await page.getByRole('button', { name: `将 ${secondName} 置顶` }).click()

    await expect(page.getByRole('alert')).toContainText(
      '精选作品或版本已在其他地方变化，已重新加载',
    )
    await expect(page.getByRole('listitem').filter({ hasText: `${firstName}-远端` }))
      .toBeVisible()
  })

  test('列表内联编辑遇到服务端版本冲突时保留原状态并持续提示', async ({ page }) => {
    const work = await createWorkViaApi(page, { characterName: '列表冲突' })
    await page.goto(`${adminBaseURL}/admin/works`)
    const row = page.getByRole('row').filter({ hasText: '列表冲突' })
    await expect(row.getByLabel('排序')).toHaveCount(0)

    await page.route(`**/api/admin/v1/works/${work.id}/presentation`, async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'CONFLICT',
            message: 'Resource version is stale.',
            reason: 'VERSION_CONFLICT',
          },
        }),
      })
    })

    await row.getByLabel('加入首页精选', { exact: true }).check()
    await expect(page.getByRole('alert').filter({ hasText: '版本冲突' })).toBeVisible()
    await expect(row.getByLabel('加入首页精选', { exact: true })).not.toBeChecked()
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
    await expect(page.getByLabel('人工排序')).toHaveCount(0)
    await expect(page.getByText('未更改')).toBeVisible()
  })

  test('展会掉落可直接编辑展会名称和时间并保存', async ({ page }) => {
    const characterName = `展会掉落编辑-${Date.now().toString(36)}`
    await seedPublicCatalog(page, [{
      slug: `e2e-public-event-${Date.now().toString(36)}`,
      characterName,
      purpose: 'adoption',
      adoptionMethod: 'event_drop',
      businessStatus: 'available',
      eventName: '历史展会',
      eventTime: '历史展会时间',
      publicationStatus: 'draft',
      photos: [{ alt: '历史展会作品照' }],
    }])
    await page.goto(`${adminBaseURL}/admin/works`)
    await page.getByRole('link', { name: characterName, exact: true }).click()

    await expect(page.getByLabel('业务类型')).toHaveValue('event_drop')
    await expect(page.getByLabel('领养方式')).toHaveValue('展会掉落')
    await expect(page.getByLabel('展会名称')).toHaveValue('历史展会')
    await expect(page.getByLabel('展会时间')).toHaveValue('历史展会时间')
    await page.getByLabel('展会名称').fill('幻夏祭 2026')
    await page.getByLabel('展会时间').fill('8 月 15 日至 16 日')

    await expect(page.getByText('有未保存更改')).toBeVisible()
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByText('已保存。')).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('业务类型')).toHaveValue('event_drop')
    await expect(page.getByLabel('领养方式')).toHaveValue('展会掉落')
    await expect(page.getByLabel('业务状态')).toHaveValue('available')
    await expect(page.getByLabel('展会名称')).toHaveValue('幻夏祭 2026')
    await expect(page.getByLabel('展会时间')).toHaveValue('8 月 15 日至 16 日')
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
    await expect(page.getByRole('alert')).toContainText('未通过服务端校验')
    await expect(page.getByLabel(/角色名/)).toHaveValue('错误验证改')
    await page.getByRole('button', { name: '知道了' }).click()

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
    await page.getByRole('button', { name: '知道了' }).click()

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
        && !/\/api\/admin\/v1\/media\/assets\/[^/]+\/preview(?:\?.*)?$/u.test(response.url())
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
    await expect(preview).toContainText('不公开')

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
      await expect(page.getByRole('heading', { level: 1, name: '作品管理' })).toBeVisible()
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
