import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const mode = process.argv.includes('--before') ? 'before' : 'after'
const verify = process.argv.includes('--verify')
const baseURL = process.env.V12_E_F1_BASE_URL ?? 'http://127.0.0.1:3000/'
const evidenceDirectory = resolve(
  `agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V12-E-F1/${mode}`,
)
await mkdir(evidenceDirectory, { recursive: true })

const executablePath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})

const viewports = [
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '1440x900', width: 1440, height: 900 },
]
const routes = [
  { name: 'home', path: '/', status: 200 },
  { name: 'works', path: '/works', status: 200 },
  { name: 'adoptions', path: '/adoptions', status: 200 },
  { name: 'work-detail', path: '/works/brand-assets-b', status: 200 },
  { name: 'commission', path: '/commission', status: 200 },
  { name: 'commission-apply', path: '/commission/apply', status: 200 },
  { name: 'about', path: '/about', status: 200 },
  { name: 'service', path: '/service', status: 200 },
  { name: 'privacy', path: '/privacy', status: 200 },
  { name: 'licenses', path: '/licenses', status: 200 },
  { name: 'not-found', path: '/__v12-e-f1-not-found', status: 404 },
]
const roleSelectors = {
  brand: ['.home-hero__title'],
  display: ['.featured-works__section-title', 'main h1', 'main h2', 'main h3'],
  body: [
    '.featured-works__species',
    '.home-commission__process',
    '.home-adoption-poster__species',
    '.commission-page__text',
    '.legal-document__text',
    '.about-contact__description',
    '.works-page__identity p',
    'main p',
  ],
  metadata: [
    '.featured-works__wayfinding',
    '.commission-page__section-kicker',
    '.home-adoption-poster__folio',
    '[class*="eyebrow"]',
    '[class*="metadata"]',
    '[class*="result-count"]',
    '[class*="status"]',
    '[class*="label"]',
    'main dt',
  ],
  ui: ['.public-action', '.catalog-search__submit', 'main button', 'main input', 'main a', 'main summary'],
  legalCode: ['.licenses__license', '.license-full__text', 'main code', '.legal-document__text'],
}

function href(path) {
  return new URL(path, baseURL).href
}

async function settle(page) {
  await page.locator('main').first().waitFor()
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts.ready,
      new Promise(done => setTimeout(done, 3000)),
    ])
  })
  const images = page.locator('img')
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index)
    await image.scrollIntoViewIfNeeded().catch(() => {})
    await image.evaluate(element => Promise.race([
      element.complete
        ? Promise.resolve()
        : new Promise((done) => {
            element.addEventListener('load', done, { once: true })
            element.addEventListener('error', done, { once: true })
          }),
      new Promise(done => setTimeout(done, 3000)),
    ])).catch(() => {})
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(120)
}

async function firstSelector(page, selectors) {
  for (const selector of selectors) {
    if (await page.locator(selector).count()) return selector
  }
  return null
}

async function sampleFont(page, role, selectors) {
  const selector = await firstSelector(page, selectors)
  if (!selector) return null

  const marker = `v12-e-f1-${role}`
  const locator = page.locator(selector).first()
  const computed = await locator.evaluate((element, value) => {
    element.setAttribute('data-v12-font-node', value)
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      text: element.textContent?.replace(/\s+/gu, ' ').trim().slice(0, 160) ?? '',
      tag: element.tagName.toLowerCase(),
      className: element.getAttribute('class') ?? '',
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
      width: rect.width,
      height: rect.height,
    }
  }, marker)

  const session = await page.context().newCDPSession(page)
  await session.send('DOM.enable')
  await session.send('CSS.enable')
  const { root } = await session.send('DOM.getDocument')
  const { nodeId } = await session.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: `[data-v12-font-node="${marker}"]`,
  })
  const { fonts = [] } = nodeId
    ? await session.send('CSS.getPlatformFontsForNode', { nodeId })
    : { fonts: [] }
  await session.detach()
  await locator.evaluate(element => element.removeAttribute('data-v12-font-node'))

  return {
    role,
    selector,
    ...computed,
    platformFonts: fonts.map(font => ({
      familyName: font.familyName,
      postScriptName: font.postScriptName,
      glyphCount: font.glyphCount,
      isCustomFont: font.isCustomFont,
    })),
  }
}

async function inspectPage(page, response, fontResponses) {
  const samples = {}
  for (const [role, selectors] of Object.entries(roleSelectors)) {
    const sample = await sampleFont(page, role, selectors)
    if (sample) samples[role] = sample
  }

  return page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement)
    return {
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      footerCount: document.querySelectorAll('footer').length,
      documentFontsStatus: document.fonts.status,
      fontFaces: [...document.fonts].map(face => ({
        family: face.family,
        status: face.status,
        display: face.display,
        weight: face.weight,
        style: face.style,
      })),
      fontPreloads: [...document.querySelectorAll('link[rel="preload"][as="font"]')]
        .map(link => link.getAttribute('href')),
      semanticTokens: {
        display: rootStyle.getPropertyValue('--font-role-display').trim(),
        body: rootStyle.getPropertyValue('--font-role-body').trim(),
        metadata: rootStyle.getPropertyValue('--font-role-metadata').trim(),
        ui: rootStyle.getPropertyValue('--font-role-ui').trim(),
        legal: rootStyle.getPropertyValue('--font-role-legal').trim(),
        code: rootStyle.getPropertyValue('--font-role-code').trim(),
      },
      cls: window.__v12TypographyCls ?? 0,
    }
  }).then(result => ({
    status: response?.status() ?? null,
    ...result,
    fontResponses,
    samples,
  }))
}

async function addClsObserver(context) {
  await context.addInitScript(() => {
    window.__v12TypographyCls = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__v12TypographyCls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
}

async function captureSpecimen(viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(href('/licenses'), { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => {
    document.body.innerHTML = `
      <main class="type-specimen">
        <p class="type-specimen__kicker">V12-E-F1 · TYPOGRAPHY GOVERNANCE</p>
        <header class="type-specimen__header">
          <h1>字体语义样本</h1>
          <p>中文、English、数字 0123456789 与标点「」/，。共同验证。</p>
        </header>
        <section class="type-specimen__row type-specimen__display">
          <span>01 · DISPLAY</span><strong>角色与摄影之间的叙事</strong>
          <p>Selected Works / 代表作品 · 2026</p>
        </section>
        <section class="type-specimen__row type-specimen__body">
          <span>02 · BODY</span><strong>正文应安静、稳定且适合连续阅读</strong>
          <p>从角色设定、神态到毛流细节，中文与 English 说明保持自然基线。</p>
        </section>
        <section class="type-specimen__row type-specimen__metadata">
          <span>03 · METADATA</span><strong>AVAILABLE · ¥12800 · 2026/08/25</strong>
          <p>物种：北极狐 · 状态：可领养 · Folio 03</p>
        </section>
        <section class="type-specimen__row type-specimen__ui">
          <span>04 · UI</span><strong>查看角色详情 · 提交委托申请</strong>
          <p>上一项 / 02 / 下一项 · Search 角色名称</p>
        </section>
        <section class="type-specimen__row type-specimen__legal">
          <span>05 · LEGAL / CODE</span><strong>个人信息与服务条款</strong>
          <p>仅处理完成委托申请所需的信息；LICENSE: OFL-1.1</p>
          <code>font-family: "Noto Serif SC"; sha256:e8f396de…</code>
        </section>
      </main>`
  })
  await page.addStyleTag({ content: `
    body { background: #fff; color: #20242b; }
    .type-specimen { width: min(72rem, calc(100% - 2rem)); margin: 0 auto; padding: clamp(2rem, 6vw, 5rem) 0; }
    .type-specimen__kicker { margin: 0 0 1rem; font: 600 0.75rem/1.4 var(--font-role-metadata, var(--font-public-mono)); letter-spacing: 0.08em; }
    .type-specimen__header { display: grid; gap: 0.75rem; margin-bottom: 3rem; }
    .type-specimen__header h1 { font: var(--type-display-weight, 600) clamp(3rem, 8vw, 6rem)/var(--type-display-line-height, 1.1) var(--font-role-display, var(--font-public-display)); letter-spacing: var(--type-display-letter-spacing, -0.025em); }
    .type-specimen__header p { font: 400 1rem/1.65 var(--font-role-body, var(--font-public-body)); }
    .type-specimen__row { display: grid; gap: 0.65rem; padding: 1.5rem 0; border-top: 1px solid #dde1e7; }
    .type-specimen__row > span { color: #646c77; font: var(--type-metadata-weight, 600) var(--type-metadata-size, 0.75rem)/var(--type-metadata-line-height, 1.4) var(--font-role-metadata, var(--font-public-mono)); letter-spacing: var(--type-metadata-letter-spacing, 0.06em); }
    .type-specimen__row strong { font-weight: inherit; }
    .type-specimen__display { font: var(--type-display-weight, 600) var(--type-display-section-size, 2rem)/var(--type-display-line-height, 1.18) var(--font-role-display, var(--font-public-display)); letter-spacing: var(--type-display-letter-spacing, -0.025em); }
    .type-specimen__body { font: var(--type-body-weight, 400) var(--type-body-size, 1rem)/var(--type-body-line-height, 1.65) var(--font-role-body, var(--font-public-body)); }
    .type-specimen__metadata { font: var(--type-metadata-weight, 600) var(--type-metadata-size, 0.75rem)/var(--type-metadata-line-height, 1.4) var(--font-role-metadata, var(--font-public-mono)); letter-spacing: var(--type-metadata-letter-spacing, 0.06em); }
    .type-specimen__ui { font: var(--type-ui-weight, 600) var(--type-ui-size, 0.875rem)/var(--type-ui-line-height, 1.35) var(--font-role-ui, var(--font-public-body)); }
    .type-specimen__legal { font: var(--type-legal-weight, 400) var(--type-legal-size, 1rem)/var(--type-legal-line-height, 1.8) var(--font-role-legal, var(--font-public-body)); }
    .type-specimen__legal code { overflow-wrap: anywhere; font: var(--type-code-weight, 400) var(--type-code-size, 0.75rem)/var(--type-code-line-height, 1.6) var(--font-role-code, var(--font-public-mono)); }
    @media (min-width: 768px) { .type-specimen__row { grid-template-columns: 10rem 1fr; } .type-specimen__row > p, .type-specimen__row > code { grid-column: 2; } }
  ` })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: resolve(evidenceDirectory, `specimen-${viewport.name}.png`),
    fullPage: true,
  })
  const state = await inspectPage(page, null, [])
  await context.close()
  return state
}

const audit = {
  mode,
  capturedAt: new Date().toISOString(),
  baseURL,
  routes: {},
  specimens: {},
}

for (const route of routes) {
  audit.routes[route.name] = {}
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
    await addClsObserver(context)
    const page = await context.newPage()
    const fontResponses = []
    page.on('response', (response) => {
      if (/\.(?:woff2?|ttf|otf)(?:\?|$)/iu.test(response.url())) {
        fontResponses.push({ url: response.url(), status: response.status() })
      }
    })
    const response = await page.goto(href(route.path), { waitUntil: 'domcontentloaded' })
    await settle(page)
    await page.screenshot({
      path: resolve(evidenceDirectory, `${route.name}-${viewport.name}.png`),
      fullPage: true,
    })
    audit.routes[route.name][viewport.name] = await inspectPage(page, response, fontResponses)
    await context.close()
    console.log(`[V12-E-F1] ${mode} ${route.name} ${viewport.name}`)
  }
}

for (const viewport of [viewports[0], viewports[2]]) {
  audit.specimens[viewport.name] = await captureSpecimen(viewport)
}

if (mode === 'after') {
  const routeStates = Object.values(audit.routes).flatMap(route => Object.values(route))
  const semanticTokenValues = Object.values(routeStates[0]?.semanticTokens ?? {})
  const heroBrandFonts = Object.values(audit.routes.home)
    .flatMap(route => route.samples.brand?.platformFonts ?? [])
  audit.checks = {
    completeCoverage: routeStates.length === routes.length * viewports.length,
    expectedStatuses: routes.every(route => Object.values(audit.routes[route.name])
      .every(state => state.status === route.status)),
    noHorizontalOverflow: routeStates.every(state => state.noHorizontalOverflow),
    fontsSettled: routeStates.every(state => state.documentFontsStatus === 'loaded'),
    acceptableCls: routeStates.every(state => state.cls < 0.1),
    semanticTokens: semanticTokenValues.length === 6 && semanticTokenValues.every(Boolean),
    heroBrandLock: heroBrandFonts.some(font => (
      font.familyName.includes('ZhuoHeiPinTieTi')
      || font.familyName.includes('Zhuohei Collage Critical')
    )),
    onlyCriticalFontPreloaded: routeStates.every(state => (
      state.fontPreloads.length === 1
      && state.fontPreloads[0] === '/fonts/zhuohei-collage-critical.woff2'
    )),
    noNotoWebRequest: routeStates.every(state => state.fontResponses
      .every(response => !response.url.includes('noto-serif-sc'))),
  }
}

await writeFile(
  resolve(evidenceDirectory, 'typography-audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
)
await browser.close()

if (verify && Object.values(audit.checks ?? {}).some(value => !value)) {
  throw new Error('V12-E-F1 typography evidence checks failed.')
}

console.log(`[V12-E-F1] ${mode} typography evidence complete`)
