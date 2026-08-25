import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V11_BASE_URL ?? 'http://127.0.0.1:3000/'
const evidenceDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V11/after',
)
await mkdir(evidenceDirectory, { recursive: true })

const executablePath = process.env.V11_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})

const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
]

const adoptionResponse = await fetch(new URL('/api/public/v1/adoptions', baseURL))
const adoptionPayload = await adoptionResponse.json()
const adoptionItems = adoptionPayload?.data?.items ?? []
const availableCount = adoptionPayload?.data?.availableCount ?? 0
const homepageAdoptions = adoptionItems
  .filter(item => item.work.adoptionStatus === 'available')
  .slice(0, 3)
const firstAvailable = homepageAdoptions[0] ?? null
if (!firstAvailable) {
  throw new Error('V11 evidence requires at least one public available adoption.')
}

async function waitForVisuals(page, root) {
  await page.evaluate(() => document.fonts.ready)
  const images = root.locator('img')
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index)
    await image.scrollIntoViewIfNeeded()
    await image.evaluate(async (element) => {
      if (!element.complete) {
        await new Promise(resolveLoad => {
          element.addEventListener('load', resolveLoad, { once: true })
          element.addEventListener('error', resolveLoad, { once: true })
        })
      }
      if (element.complete && element.naturalWidth > 0)
        await element.decode()
    })
  }
}

async function inspectImages(root) {
  return root.locator('img').evaluateAll(images => images.map(image => ({
    complete: image.complete,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    objectFit: getComputedStyle(image).objectFit,
  })))
}

async function scrollSceneIntoView(page, testId) {
  const root = page.getByTestId(testId)
  const offset = await root.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    const token = innerWidth >= 1024
      ? '--public-header-height'
      : '--public-anchor-offset'
    const rawOffset = styles.getPropertyValue(token).trim()
    const resolvedOffset = rawOffset.endsWith('rem')
      ? Number.parseFloat(rawOffset) * Number.parseFloat(styles.fontSize)
      : Number.parseFloat(rawOffset)
    return Number.isFinite(resolvedOffset) ? resolvedOffset : 0
  })

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const top = await root.evaluate(element => element.getBoundingClientRect().top)
    const distance = top - offset
    if (Math.abs(distance) <= 1) break
    const viewportHeight = await page.evaluate(() => window.innerHeight)
    await page.mouse.wheel(0, Math.sign(distance) * Math.min(Math.abs(distance), viewportHeight))
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(300)
}

async function captureHome(viewport) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: viewport.width, height: viewport.height },
  })
  const page = await context.newPage()
  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  const root = page.getByTestId('home-current-adoptions')
  await root.waitFor()
  await waitForVisuals(page, root)
  await page.waitForTimeout(700)
  await scrollSceneIntoView(page, 'home-current-adoptions')

  const result = await root.evaluate((element, currentViewport) => {
    const section = element.getBoundingClientRect()
    const media = element.querySelector('.home-adoption-poster__media')
    const record = element.querySelector('.home-adoption-poster__caption')
    const selector = element.querySelector('.home-adoption-poster__selector')
    const mediaRect = media?.getBoundingClientRect()
    const recordRect = record?.getBoundingClientRect()
    const selectorRect = selector?.getBoundingClientRect()
    const lastActionRect = element.querySelector('.home-adoption-poster__actions')
      ?.getBoundingClientRect()
    return {
      viewport: currentViewport,
      slug: element.querySelector('[data-work-slug]')?.getAttribute('data-work-slug') ?? null,
      title: element.querySelector('.home-adoption-poster__identity h3')?.textContent?.trim() ?? null,
      species: element.querySelector('.home-adoption-poster__species')?.textContent?.trim() ?? null,
      folio: element.querySelector('.home-adoption-poster__folio strong')?.textContent?.trim() ?? null,
      facts: element.querySelector('.home-adoption-poster__facts')?.textContent
        ?.replace(/\s+/gu, ' ').trim() ?? null,
      actionHrefs: [...element.querySelectorAll('.home-adoption-poster__actions a')]
        .map(anchor => anchor.getAttribute('href')),
      mediaHref: element.querySelector('[data-testid="home-adoption-media-link"]')
        ?.getAttribute('href') ?? null,
      selectorCount: element.querySelectorAll('.home-adoption-poster__selector-item').length,
      selectorSlugs: [...element.querySelectorAll('.home-adoption-poster__selector-item')]
        .map(button => button.getAttribute('data-work-slug')),
      selectorLabels: [...element.querySelectorAll('.home-adoption-poster__selector-item strong')]
        .map(label => label.textContent?.trim() ?? null),
      stepperLabels: [...element.querySelectorAll('.home-adoption-poster__stepper button')]
        .map(button => button.textContent?.replace(/\s+/gu, ' ').trim() ?? null),
      stepperDisabled: [...element.querySelectorAll('.home-adoption-poster__stepper button')]
        .map(button => button.disabled),
      mediaBorderRadius: media ? getComputedStyle(media).borderRadius : null,
      mediaRecordOverlap: Boolean(
        currentViewport.width >= 1024
        && mediaRect && recordRect
        && mediaRect.left < recordRect.right
        && mediaRect.right > recordRect.left,
      ),
      mobileOrder: Boolean(
        currentViewport.width >= 1024
        || (
          mediaRect && recordRect
          && (!selectorRect || (
            mediaRect.bottom <= selectorRect.top
            && selectorRect.bottom <= recordRect.top
          ))
          && (selectorRect || mediaRect.bottom <= recordRect.top)
        ),
      ),
      sectionFitsViewport: section.top >= -1 && section.bottom <= currentViewport.height + 1,
      visibleContentFitsViewport: Boolean(
        section.top >= -1
        && lastActionRect
        && lastActionRect.bottom <= currentViewport.height + 1,
      ),
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      runningAnimations:
        element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
      decorativeEnglishLabelCount: document.querySelectorAll([
        '.featured-works__eyebrow',
        '.featured-works__meta',
        '.home-commission__eyebrow',
        '.home-commission__meta',
        '.home-adoptions__eyebrow',
      ].join(',')).length,
    }
  }, viewport)
  result.responseStatus = response?.status() ?? null
  result.images = await inspectImages(root)
  result.stepperResults = []
  const stepperButtons = root.locator('.home-adoption-poster__stepper button')
  if (await stepperButtons.count() === 2) {
    await stepperButtons.nth(0).click()
    result.stepperResults.push(await root.locator('.home-adoption-poster').getAttribute('data-work-slug'))
    await stepperButtons.nth(1).click()
    result.stepperResults.push(await root.locator('.home-adoption-poster').getAttribute('data-work-slug'))
    await stepperButtons.nth(1).click()
    result.stepperResults.push(await root.locator('.home-adoption-poster').getAttribute('data-work-slug'))
    await stepperButtons.nth(0).click()
    result.stepperResults.push(await root.locator('.home-adoption-poster').getAttribute('data-work-slug'))
  }
  result.selectionResults = []
  const selectorButtons = root.locator('.home-adoption-poster__selector-item')
  for (let index = 0; index < await selectorButtons.count(); index += 1) {
    await selectorButtons.nth(index).click()
    result.selectionResults.push(await root.evaluate((element) => {
      const title = element.querySelector('.home-adoption-poster__identity h3')
      const titleStyles = title ? getComputedStyle(title) : null
      const titleLineHeight = titleStyles ? Number.parseFloat(titleStyles.lineHeight) : 0
      return {
        slug: element.querySelector('.home-adoption-poster')?.getAttribute('data-work-slug') ?? null,
        title: title?.textContent?.trim() ?? null,
        titleFontSize: titleStyles ? Number.parseFloat(titleStyles.fontSize) : null,
        titleLineCount: title && titleLineHeight > 0
          ? Math.round(title.getBoundingClientRect().height / titleLineHeight)
          : null,
        currentIndex: element.querySelector('.home-adoption-poster__selector-item[aria-current="true"]')
          ?.getAttribute('data-work-slug') ?? null,
        mediaHref: element.querySelector('[data-testid="home-adoption-media-link"]')
          ?.getAttribute('href') ?? null,
        runningAnimations:
          element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
      }
    }))
    if (index === await selectorButtons.count() - 1) {
      await waitForVisuals(page, root)
      await page.screenshot({
        animations: 'disabled',
        path: resolve(
          evidenceDirectory,
          `home-adoption-selected-${String(index + 1).padStart(2, '0')}-${viewport.name}.png`,
        ),
      })
    }
  }
  if (await selectorButtons.count() > 0) {
    await selectorButtons.first().click()
    await scrollSceneIntoView(page, 'home-current-adoptions')
  }
  await page.screenshot({
    animations: 'disabled',
    path: resolve(evidenceDirectory, `home-adoption-${viewport.name}.png`),
  })
  await context.close()
  return result
}

async function captureDirectory(viewport) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: viewport.width, height: viewport.height },
  })
  const page = await context.newPage()
  const response = await page.goto(new URL('/adoptions', baseURL).href, {
    waitUntil: 'domcontentloaded',
  })
  const root = page.locator('.adoptions-page')
  await root.waitFor()
  await waitForVisuals(page, root)
  const firstCard = page.locator('.adoption-card').first()
  await firstCard.focus()

  const result = await root.evaluate((element, currentViewport) => {
    const cards = [...element.querySelectorAll('.adoption-card')]
    const first = cards[0]
    return {
      viewport: currentViewport,
      h1Count: element.querySelectorAll('h1').length,
      headerTitle: element.querySelector('#adoptions-page-title')?.textContent?.trim() ?? null,
      headerLedgerAbsent: !element.querySelector('.adoption-archive-header__ledger'),
      headerTitleFontSize: Number.parseFloat(getComputedStyle(
        element.querySelector('.adoption-archive-header__title'),
      ).fontSize),
      headerDisplayFontSize: Number.parseFloat(getComputedStyle(
        element.querySelector('.adoption-archive-header__display'),
      ).fontSize),
      headerMark: (() => {
        const mark = element.querySelector('.adoption-archive-header__mark')
        if (!mark) return null
        const style = getComputedStyle(mark)
        return {
          src: mark.getAttribute('src'),
          opacity: Number.parseFloat(style.opacity),
          transform: style.transform,
          objectFit: style.objectFit,
        }
      })(),
      cardCount: cards.length,
      gridColumnCount: getComputedStyle(element.querySelector('.adoptions-page__grid'))
        .gridTemplateColumns.split(' ').filter(Boolean).length,
      slugs: cards.map(card => card.getAttribute('data-work-slug')),
      detailHrefs: cards.map(card => card.getAttribute('href')),
      allRecordsComplete: cards.every(card => (
        Boolean(card.querySelector('.adoption-card__title')?.textContent?.trim())
        && Boolean(card.querySelector('.adoption-card__facts')?.textContent?.trim())
        && Boolean(card.querySelector('.adoption-card__action')?.textContent?.trim())
      )),
      allRecordsMinimal: cards.every(card => (
        !card.querySelector('.adoption-card__section-label')
        && !/物种|领养价格|当前状态/.test(
          card.querySelector('.adoption-card__facts')?.textContent ?? '',
        )
      )),
      factValues: cards.map(card => (
        [...card.querySelectorAll('.adoption-card__facts > span')]
          .map(value => value.textContent?.trim() ?? '')
      )),
      factRulesAbsent: cards.every(card => (
        [...card.querySelectorAll('.adoption-card__facts > span')]
          .every(value => Number.parseFloat(getComputedStyle(value).borderBlockStartWidth) === 0)
      )),
      factMarkersPresent: cards.every(card => (
        [...card.querySelectorAll('.adoption-card__facts > span')]
          .every(value => getComputedStyle(value, '::before').content.includes('·'))
      )),
      folios: cards.map(card => card.querySelector('.adoption-card__folio')?.textContent?.trim() ?? null),
      folioVisibleWidths: cards.map((card) => {
        const folio = card.querySelector('.adoption-card__folio')?.getBoundingClientRect()
        const profile = card.querySelector('.adoption-card__profile')?.getBoundingClientRect()
        return folio && profile
          ? Math.max(0, Math.min(folio.right, profile.right) - Math.max(folio.left, profile.left))
          : 0
      }),
      allRecordsUnified: cards.every(card => (
        Boolean(card.querySelector('.adoption-card__record .adoption-card__canvas'))
        && Boolean(card.querySelector('.adoption-card__record .adoption-card__profile'))
        && !card.querySelector('.adoption-card__ledger')
      )),
      mediaInfoRelationships: cards.map((card) => {
        const media = card.querySelector('.adoption-card__canvas')?.getBoundingClientRect()
        const profile = card.querySelector('.adoption-card__profile')?.getBoundingClientRect()
        return {
          profileAfterMedia: currentViewport.width >= 768
            ? Boolean(media && profile && media.right <= profile.left + 1)
            : Boolean(media && profile && media.bottom <= profile.top + 1),
          mediaArea: media ? media.width * media.height : 0,
          profileArea: profile ? profile.width * profile.height : 0,
        }
      }),
      mediaRadii: cards.map(card => (
        getComputedStyle(card.querySelector('.adoption-card__record')).borderRadius
      )),
      cardShadows: cards.map(card => getComputedStyle(card).boxShadow),
      cardTopBorders: cards.map(card => Number.parseFloat(getComputedStyle(card).borderTopWidth)),
      firstCardFocusVisible: Boolean(first?.matches(':focus-visible')),
      firstCardOutline: first ? getComputedStyle(first).outlineStyle : null,
      contactHref:
        element.querySelector('[data-testid="adoption-contact-action"]')?.getAttribute('href') ?? null,
      searchAction:
        element.querySelector('.catalog-search')?.getAttribute('action') ?? null,
      searchLabel:
        element.querySelector('.adoptions-page__tools-meta span')?.textContent?.trim() ?? null,
      searchContactRelationship: (() => {
        const search = element.querySelector('.catalog-search')?.getBoundingClientRect()
        const contact = element.querySelector('[data-testid="adoption-contact-action"]')
          ?.getBoundingClientRect()
        if (!search || !contact) return false
        return currentViewport.width >= 768
          ? search.right <= contact.left + 1 && contact.left - search.right <= 32
          : search.bottom <= contact.top + 1
      })(),
      toolsPanelRightAligned: (() => {
        const tools = element.querySelector('.adoptions-page__tools')?.getBoundingClientRect()
        const panel = element.querySelector('.adoptions-page__tools-panel')?.getBoundingClientRect()
        return Boolean(tools && panel && Math.abs(tools.right - panel.right) <= 80)
      })(),
      toolsBordersAbsent: (() => {
        const tools = element.querySelector('.adoptions-page__tools')
        if (!tools) return false
        const style = getComputedStyle(tools)
        return Number.parseFloat(style.borderTopWidth) === 0
          && Number.parseFloat(style.borderBottomWidth) === 0
      })(),
      unsearchedResultSummaryVisible:
        element.querySelectorAll('.adoptions-page__tools-meta span').length > 1,
      firstCardHeight: first?.getBoundingClientRect().height ?? null,
      firstCardBottom: first?.getBoundingClientRect().bottom ?? null,
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      runningAnimations:
        element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
      decorativeEnglishLabelCount:
        element.querySelectorAll('.adoption-archive-header__eyebrow').length,
    }
  }, viewport)
  result.responseStatus = response?.status() ?? null
  result.images = await inspectImages(root)
  await firstCard.evaluate(element => element.blur())
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  await page.screenshot({
    animations: 'disabled',
    path: resolve(evidenceDirectory, `adoptions-${viewport.name}.png`),
  })
  await firstCard.evaluate((element) => {
    const header = document.querySelector('.public-site-header')
    const headerHeight = header?.getBoundingClientRect().height ?? 0
    const top = element.getBoundingClientRect().top + window.scrollY - headerHeight - 12
    window.scrollTo(0, Math.max(0, top))
  })
  await page.waitForTimeout(200)
  await page.screenshot({
    animations: 'disabled',
    path: resolve(evidenceDirectory, `adoptions-entry-${viewport.name}.png`),
  })
  await context.close()
  return result
}

async function captureDetail(viewport) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: viewport.width, height: viewport.height },
  })
  const page = await context.newPage()
  const detailURL = new URL(firstAvailable.href, baseURL)
  detailURL.searchParams.set('from', 'adoptions')
  const response = await page.goto(detailURL.href, { waitUntil: 'domcontentloaded' })
  const root = page.getByTestId('work-detail')
  await root.waitFor()
  await waitForVisuals(page, root)
  const result = await root.evaluate((element, currentViewport) => ({
    viewport: currentViewport,
    detailKind: element.getAttribute('data-detail-kind'),
    slug: element.getAttribute('data-work-slug'),
    ledger: element.querySelector('.work-detail__identity-ledger')?.textContent
      ?.replace(/\s+/gu, ' ').trim() ?? null,
    adoptionStatus: element.querySelector('[data-testid="adoption-detail-status"]')
      ?.textContent?.trim() ?? null,
    adoptionPrice: element.querySelector('[data-testid="adoption-detail-price"]')
      ?.textContent?.trim() ?? null,
    archiveHref: element.querySelector('.work-detail__archive-link')?.getAttribute('href') ?? null,
    contactHref: element.querySelector('.work-detail__adoption-actions .public-action')
      ?.getAttribute('href') ?? null,
    backHref: element.querySelector('.work-detail__back-link')?.getAttribute('href') ?? null,
    backLabel: element.querySelector('.work-detail__back-link')?.textContent
      ?.replace(/\s+/gu, ' ').trim() ?? null,
    mediaStageRadius: getComputedStyle(element.querySelector('.work-gallery__stage')).borderRadius,
    stageObjectFits: [...element.querySelectorAll('.work-gallery__stage img')]
      .map(image => getComputedStyle(image).objectFit),
    noHorizontalOverflow:
      document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    runningAnimations:
      element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
    decorativeEnglishLabelCount:
      element.querySelectorAll('.work-detail__eyebrow').length,
  }), viewport)
  result.responseStatus = response?.status() ?? null
  result.images = await inspectImages(root)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  await page.screenshot({
    animations: 'disabled',
    path: resolve(evidenceDirectory, `adoption-detail-${viewport.name}.png`),
  })
  await context.close()
  return result
}

async function verifySearch() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(new URL('/adoptions', baseURL).href, { waitUntil: 'domcontentloaded' })
  const search = page.locator('.catalog-search__input')
  await search.fill('小绿狗')
  await page.locator('.catalog-search__submit').click()
  await page.waitForURL(url => url.pathname === '/adoptions' && url.searchParams.get('q') === '小绿狗')
  await page.locator('.adoption-card').first().waitFor()
  const result = {
    query: new URL(page.url()).searchParams.get('q'),
    resultCount: await page.locator('.adoption-card').count(),
    resultSummary: await page.locator('.adoptions-page__tools-meta span').nth(1).textContent(),
    titles: await page.locator('.adoption-card__title').allTextContents(),
    clearHref: await page.locator('.catalog-search__clear').getAttribute('href'),
  }
  await page.locator('.catalog-search__clear').click()
  await page.waitForURL(url => url.pathname === '/adoptions' && !url.searchParams.has('q'))
  result.resultSummaryAfterClear = await page.locator('.adoptions-page__tools-meta span').count()
  await context.close()
  return result
}

const audit = {
  capturedAt: new Date().toISOString(),
  source: {
    firstAvailableSlug: firstAvailable.work.slug,
    homepageSlugs: homepageAdoptions.map(item => item.work.slug),
    publicItemCount: adoptionItems.length,
    availableCount,
    responseStatus: adoptionResponse.status,
  },
  home: {},
  directory: {},
  detail: {},
  search: await verifySearch(),
}

for (const viewport of viewports) {
  audit.home[viewport.name] = await captureHome(viewport)
  audit.directory[viewport.name] = await captureDirectory(viewport)
  audit.detail[viewport.name] = await captureDetail(viewport)
}

const allHome = Object.values(audit.home)
const allDirectory = Object.values(audit.directory)
const allDetail = Object.values(audit.detail)
const allResults = [...allHome, ...allDirectory, ...allDetail]

audit.checks = {
  allRoutes200: adoptionResponse.status === 200
    && allResults.every(result => result.responseStatus === 200),
  allImagesDecoded: allResults.every(result => (
    result.images.length > 0
    && result.images.every(image => image.complete && image.naturalWidth > 0)
  )),
  containMedia: allHome.every(result => result.images.every(image => image.objectFit === 'contain'))
    && allDirectory.every(result => result.images.every(image => image.objectFit === 'contain'))
    && allDetail.every(result => result.stageObjectFits.every(objectFit => objectFit === 'contain')),
  noHorizontalOverflow: allResults.every(result => result.noHorizontalOverflow),
  noStaticMotion: allResults.every(result => result.runningAnimations === 0),
  homepageUsesLatestAvailable: allHome.every(result => (
    result.slug === firstAvailable.work.slug
    && result.title === firstAvailable.work.characterName
    && result.species === firstAvailable.work.species
    && result.folio === (homepageAdoptions.length > 1
      ? `01 / ${String(homepageAdoptions.length).padStart(2, '0')}`
      : null)
    && result.facts?.includes('角色状态')
    && result.facts?.includes('领养价格')
    && result.actionHrefs.includes('/adoptions')
    && result.actionHrefs.some(href => href?.startsWith(firstAvailable.href))
    && result.mediaHref?.startsWith(firstAvailable.href)
    && Number.parseFloat(result.mediaBorderRadius) === 12
    && result.mobileOrder
    && result.visibleContentFitsViewport
    && result.selectorCount === (homepageAdoptions.length > 1 ? homepageAdoptions.length : 0)
    && JSON.stringify(result.selectorSlugs) === JSON.stringify(
      homepageAdoptions.length > 1 ? homepageAdoptions.map(item => item.work.slug) : [],
    )
    && JSON.stringify(result.stepperLabels) === JSON.stringify(
      homepageAdoptions.length > 1 ? ['← 上一个', '下一个 →'] : [],
    )
    && JSON.stringify(result.stepperDisabled) === JSON.stringify(
      homepageAdoptions.length > 1 ? [false, false] : [],
    )
    && JSON.stringify(result.stepperResults) === JSON.stringify(
      homepageAdoptions.length > 1
        ? [
            homepageAdoptions.at(-1)?.work.slug,
            homepageAdoptions[0]?.work.slug,
            homepageAdoptions[1]?.work.slug,
            homepageAdoptions[0]?.work.slug,
          ]
        : [],
    )
    && result.selectionResults.every((selection, index) => (
      selection.slug === homepageAdoptions[index]?.work.slug
      && selection.title === homepageAdoptions[index]?.work.characterName
      && selection.currentIndex === homepageAdoptions[index]?.work.slug
      && selection.mediaHref?.startsWith(homepageAdoptions[index]?.href)
      && selection.titleFontSize <= (result.viewport.width >= 1024 ? 64 : 44)
      && selection.titleLineCount <= 2
      && selection.runningAnimations === 0
    ))
  )),
  desktopHomepageOverlap: audit.home['1440x900'].mediaRecordOverlap,
  archiveDirectory: allDirectory.every(result => (
    result.h1Count === 1
    && result.headerTitle === '设定领养'
    && result.headerLedgerAbsent
    && result.headerTitleFontSize >= (result.viewport.width >= 768 ? 56 : 48)
    && result.headerDisplayFontSize >= (result.viewport.width >= 768 ? 96 : 72)
    && result.headerMark?.src === '/brand/logo-mark.png'
    && result.headerMark.opacity > 0
    && result.headerMark.opacity <= 0.08
    && result.headerMark.transform !== 'none'
    && result.headerMark.objectFit === 'contain'
    && result.cardCount === adoptionItems.length
    && result.slugs[0] === firstAvailable.work.slug
    && result.gridColumnCount === (result.viewport.width >= 1024 ? 2 : 1)
    && result.detailHrefs.every(href => href?.startsWith('/works/'))
    && result.allRecordsComplete
    && result.allRecordsMinimal
    && result.factValues.every(values => values.length >= 2 && values.every(Boolean))
    && result.factRulesAbsent
    && result.factMarkersPresent
    && result.folios.every((folio, index) => folio === String(index + 1).padStart(2, '0'))
    && result.folioVisibleWidths.every(width => width >= 40)
    && result.allRecordsUnified
    && result.mediaInfoRelationships.every(relation => (
      relation.profileAfterMedia
      && (result.viewport.width < 768 || relation.mediaArea > relation.profileArea)
    ))
    && result.mediaRadii.every(radius => Number.parseFloat(radius) === 12)
    && result.cardShadows.every(shadow => shadow === 'none')
    && result.cardTopBorders.every(width => width === 0)
    && result.firstCardFocusVisible
    && result.firstCardOutline !== 'none'
    && result.contactHref === '/about#contact'
    && result.searchAction === '/adoptions'
    && result.searchLabel === '搜索角色'
    && result.searchContactRelationship
    && result.toolsPanelRightAligned
    && result.toolsBordersAbsent
    && !result.unsearchedResultSummaryVisible
  )),
  desktopDirectoryDensity: audit.directory['1440x900'].gridColumnCount === 2
    && audit.directory['1440x900'].firstCardHeight <= 650
    && audit.directory['390x844'].firstCardBottom <= 845
    && audit.directory['430x932'].firstCardBottom <= 933
    && audit.directory['390x844'].gridColumnCount === 1
    && audit.directory['430x932'].gridColumnCount === 1,
  searchPreserved: audit.search.query === '小绿狗'
    && audit.search.resultCount > 0
    && audit.search.resultSummary?.includes('项结果')
    && audit.search.titles.every(title => title.includes('小绿狗'))
    && audit.search.clearHref === '/adoptions'
    && audit.search.resultSummaryAfterClear === 1,
  adoptionDetailVariant: allDetail.every(result => (
    result.detailKind === 'adoption'
    && result.slug === firstAvailable.work.slug
    && result.ledger?.includes('物种')
    && result.ledger?.includes('内容类型设定领养')
    && result.ledger?.includes('领养状态')
    && result.ledger?.includes('领养价格')
    && Boolean(result.adoptionStatus)
    && Boolean(result.adoptionPrice)
    && result.archiveHref === '/adoptions'
    && result.contactHref === '/about#contact'
    && result.backHref === '/adoptions'
    && result.backLabel?.includes('返回设定领养')
    && Number.parseFloat(result.mediaStageRadius) === 12
  )),
  decorativeEnglishLabelsRemoved: [
    ...allHome,
    ...allDirectory,
    ...allDetail,
  ].every(result => result.decorativeEnglishLabelCount === 0),
}

await writeFile(
  resolve(evidenceDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
)
await browser.close()

if (Object.values(audit.checks).some(value => !value))
  throw new Error('V11 static evidence checks failed.')

console.log('[V11] static evidence complete')
