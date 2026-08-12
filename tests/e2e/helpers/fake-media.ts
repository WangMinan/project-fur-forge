import { randomBytes } from 'node:crypto'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createLargeSyntheticPng, createSyntheticSourcePng, createSyntheticWatermarkPng } from '../../../scripts/oss-preflight-core.mjs'
import { adminBaseURL } from './auth'

export interface FakeMediaState {
  deletedPrivateKeys: string[]
  deletedPublicKeys: string[]
  objects: string[]
  processCalls: number
  publicObjects: string[]
  putRecords: Array<{
    byteSize: number
    contentMd5: string | null
    contentType: string | null
    forbidOverwrite: string | null
    sha256Metadata: string | null
  }>
}

async function control(page: Page, body: Record<string, unknown>) {
  const response = await page.request.post(
    `${adminBaseURL}/api/e2e-fake-media-control`,
    { data: body },
  )
  expect(response.ok(), 'E2E fake 控制端点应可用').toBeTruthy()
  return response.json()
}

export async function fakeMediaState(page: Page): Promise<FakeMediaState> {
  const body = await control(page, { action: 'state' }) as { data: FakeMediaState }
  return body.data
}

export async function setFakeMediaFlags(
  page: Page,
  flags: Partial<{
    failDelete: boolean
    failGet: boolean
    failImageInfo: boolean
    failPut: boolean
    failProcess: boolean
    failSign: boolean
    omitSha256OnNextPut: boolean
    rejectNextPut403: boolean
  }>,
  imageInfoOverride?: {
    key: string
    info: {
      fileSize: number
      format: string
      height: number
      orientation: number
      width: number
    }
  } | null,
) {
  await control(page, { action: 'setFlags', flags, imageInfoOverride })
}

export async function resetFakeMedia(page: Page) {
  await control(page, { action: 'reset' })
}

// GATE-07：种入已发布作品照 + 启用的横竖首页图，并预生成当前活动水印的公开 variant。
export async function seedBrandingStage(page: Page) {
  await control(page, { action: 'seedBrandingStage' })
}

export async function seedHomePublicationOperation(page: Page, slideAlt: string) {
  await control(page, { action: 'seedHomePublicationOperation', slideAlt })
}

// 公开衍生图按配方身份哈希决定 asset_variants.id（不含资产 ID），E2E 库跨用例、
// 跨运行复用；固定内容会让两次上传得到相同身份并在发布时触发 UNIQUE 冲突。
// 追加随机尾字节（PNG 解码器在 IEND 后停止读取）使每次上传内容唯一。
function uniquePng(base: Buffer): Buffer {
  return Buffer.concat([base, randomBytes(16)])
}

// 160×64 小 PNG：常规上传链路。
export function smallStudioPng(): Buffer {
  return uniquePng(createSyntheticWatermarkPng() as Buffer)
}

let publishableStudioSource: Buffer | null = null

export function publishableStudioPng(): Buffer {
  publishableStudioSource ??= createSyntheticSourcePng(2400, 1600) as Buffer
  return uniquePng(publishableStudioSource)
}

let lowResolutionDesignSheetSource: Buffer | null = null

export function lowResolutionDesignSheetPng(): Buffer {
  lowResolutionDesignSheetSource ??= createSyntheticSourcePng(1560, 1080) as Buffer
  return uniquePng(lowResolutionDesignSheetSource)
}

// 9500×1030、约 29 MB 噪点 PNG：触发内嵌 FFmpeg 私有处理源。
export function largeStudioPng(): Buffer {
  return uniquePng(createLargeSyntheticPng() as Buffer)
}

// T20 首页横/竖槽位上传：横版必须宽大于高、竖版必须高大于宽（服务端配对校验）。
const heroSources: Partial<Record<'landscape' | 'portrait', Buffer>> = {}

export function heroPng(orientation: 'landscape' | 'portrait'): Buffer {
  heroSources[orientation] ??= createSyntheticSourcePng(
    orientation === 'landscape' ? 1920 : 1080,
    orientation === 'landscape' ? 1080 : 1920,
  ) as Buffer
  return uniquePng(heroSources[orientation])
}

export function lowResolutionHeroPng(
  orientation: 'landscape' | 'portrait',
): Buffer {
  return uniquePng(createSyntheticSourcePng(
    orientation === 'landscape' ? 960 : 540,
    orientation === 'landscape' ? 540 : 960,
  ) as Buffer)
}

let contactQrSource: Buffer | null = null

export function contactQrPng(): Buffer {
  contactQrSource ??= createSyntheticSourcePng(640, 640) as Buffer
  return uniquePng(contactQrSource)
}

export function nonSquareContactQrPng(): Buffer {
  return uniquePng(createSyntheticSourcePng(640, 320) as Buffer)
}

// T20 大图管理 E2E：临时停用/恢复活动水印 profile（验证预览与启用阻断）。
export async function setWatermarkProfileActive(page: Page, active: boolean) {
  await control(page, { action: 'setWatermarkProfileActive', active })
}

export function pngDimensions(content: Buffer) {
  return {
    height: content.readUInt32BE(20),
    width: content.readUInt32BE(16),
  }
}

export async function uploadFileToEditor(
  page: Page,
  content: Buffer,
  name = 'studio.png',
) {
  const input = page.getByLabel('选择出厂照文件')
  await input.setInputFiles({
    name,
    mimeType: 'image/png',
    buffer: content,
  })
  await page.getByRole('button', { name: '上传出厂照' }).click()
}

export async function uploadDesignSheetToEditor(
  page: Page,
  content: Buffer,
  name = 'design-sheet.png',
) {
  await page.getByLabel('选择领养设定图文件').setInputFiles({
    name,
    mimeType: 'image/png',
    buffer: content,
  })
  await page.getByRole('button', { name: '上传设定图' }).click()
}
