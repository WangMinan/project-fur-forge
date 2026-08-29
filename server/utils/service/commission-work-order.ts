import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import type Database from 'better-sqlite3'
import { PDFDocument, rgb } from 'pdf-lib'
import { decodeImageToPng } from '../../../scripts/embedded-ffmpeg.mjs'
import type { MediaStorage } from '../media-storage'
import {
  getCommissionDesignReference,
  getCommissionSubmissionDetail,
} from './commission-management'
import { ServiceError } from '../service-error'

/**
 * 已接受申请的制作单 PDF：两页 A4 横版，第一页单主信息，第二页满页设定图。
 *
 * 服务端自己生成而不是走浏览器打印——操作员的默认打印机（纸张、方向、灰度）
 * 会决定打印结果，导出的文件必须与打印机无关。
 *
 * 该 CJK OTF 必须完整嵌入：fontkit 的子集输出会被部分 PDF 阅读器判为无效。
 */

/** A4 横版，单位 pt。 */
const PAGE_WIDTH = 841.89
const PAGE_HEIGHT = 595.28
const MARGIN = 40
/**
 * 正文用开源宋体（Noto Serif SC，SIL OFL 1.1，可随镜像分发，已登记在 /licenses）。
 * 不用首页那套拼贴品牌字体：制作单是内部正式文件。
 * 也不用系统宋体：SimSun 是商业授权字体，不能随仓库和镜像分发。
 */
export function commissionWorkOrderFontFile(
  nodeEnv = process.env.NODE_ENV,
  cwd = process.cwd(),
  variant: 'common' | 'full' = 'full',
) {
  const fileName = variant === 'common'
    ? 'noto-serif-sc-work-order-common.otf'
    : 'noto-serif-sc-regular.otf'
  return resolve(cwd, nodeEnv === 'production'
    ? `.output/public/fonts/${fileName}`
    : `public/fonts/${fileName}`)
}

function fontSupportsText(fontBytes: Uint8Array, text: string) {
  const font = fontkit.create(fontBytes)
  return [...text].every((character) => {
    const codePoint = character.codePointAt(0)!
    return codePoint === 0x09
      || codePoint === 0x0A
      || codePoint === 0x0D
      || font.hasGlyphForCodePoint(codePoint)
  })
}

async function commissionWorkOrderFont(text: string) {
  try {
    const common = await readFile(commissionWorkOrderFontFile(
      process.env.NODE_ENV,
      process.cwd(),
      'common',
    ))
    if (fontSupportsText(common, text)) {
      return { bytes: common, variant: 'common' as const }
    }
  }
  catch {
    // 精简字体缺失或损坏时保持导出可用，回退到完整字体。
  }
  return {
    bytes: await readFile(commissionWorkOrderFontFile()),
    variant: 'full' as const,
  }
}

/** pdf-lib 只能嵌入 JPEG 与 PNG；WebP 原图先用内置 FFmpeg 转成 PNG。 */
async function embeddableImage(content: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
    return { content, mimeType }
  }
  const decoded = await decodeImageToPng(content)
  return { content: decoded.content, mimeType: 'image/png' }
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return '—'
  }
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value))
}

export async function buildCommissionWorkOrderPdf(
  sqlite: Database.Database,
  storage: MediaStorage,
  submissionId: string,
) {
  const detail = getCommissionSubmissionDetail(sqlite, submissionId)
  if (detail.status !== 'accepted') {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Only accepted commission submissions can be exported.',
    )
  }

  const reference = await getCommissionDesignReference(sqlite, storage, submissionId)
  const image = await embeddableImage(reference.content, reference.mimeType)

  const rows: [string, string][] = [
    ['称呼', detail.nickname],
    ['物种', detail.species ?? '待人工补录'],
    ['手机号', `${detail.phone.countryCode} ${detail.phone.number}`],
    ['QQ', detail.qq],
    ['身高', `${detail.heightCm} cm`],
    ['体重', `${detail.weightKg} kg`],
    ['状态', '已接受'],
    ['提交时间', formatTimestamp(detail.createdAt)],
    ['处理时间', formatTimestamp(detail.handledAt)],
  ]
  const pdfText = [
    '自设委托制作单',
    `回执 ${detail.receiptCode}`,
    ...rows.flat(),
    detail.internalNote ?? '',
  ].join('\n')

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  // 制作单是内部文件：不写入任何可用于追踪单主的元数据。
  pdf.setTitle(`委托制作单 ${detail.receiptCode}`)
  pdf.setProducer('DITE DOG Studio')
  pdf.setCreator('DITE DOG Studio')

  const selectedFont = await commissionWorkOrderFont(pdfText)
  const font = await pdf.embedFont(selectedFont.bytes, { subset: false })

  const infoPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const ink = rgb(0, 0, 0)
  const muted = rgb(0.35, 0.37, 0.4)

  let cursor = PAGE_HEIGHT - MARGIN - 24
  infoPage.drawText('自设委托制作单', { x: MARGIN, y: cursor, size: 24, font, color: ink })
  cursor -= 22
  infoPage.drawText(`回执 ${detail.receiptCode}`, {
    x: MARGIN,
    y: cursor,
    size: 11,
    font,
    color: muted,
  })
  cursor -= 18
  infoPage.drawLine({
    start: { x: MARGIN, y: cursor },
    end: { x: PAGE_WIDTH - MARGIN, y: cursor },
    thickness: 1,
    color: ink,
  })
  cursor -= 30

  // 两列排布：A4 横版一列会剩下大半页空白。
  const columnWidth = (PAGE_WIDTH - MARGIN * 2) / 2
  const rowHeight = 34
  const perColumn = Math.ceil(rows.length / 2)
  rows.forEach(([label, value], index) => {
    const column = Math.floor(index / perColumn)
    const x = MARGIN + column * columnWidth
    const y = cursor - (index % perColumn) * rowHeight
    infoPage.drawText(label, { x, y, size: 10, font, color: muted })
    infoPage.drawText(value, { x, y: y - 15, size: 14, font, color: ink })
  })

  if (detail.internalNote) {
    const noteTop = cursor - perColumn * rowHeight - 16
    infoPage.drawText('内部备注', { x: MARGIN, y: noteTop, size: 10, font, color: muted })
    infoPage.drawText(detail.internalNote, {
      x: MARGIN,
      y: noteTop - 16,
      size: 11,
      font,
      color: ink,
      lineHeight: 15,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
    })
  }

  const sheetPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const embedded = image.mimeType === 'image/png'
    ? await pdf.embedPng(image.content)
    : await pdf.embedJpg(image.content)
  // 等比放到最大：设定图是做毛的依据，不裁切、不拉伸。
  const fitted = embedded.scaleToFit(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN)
  sheetPage.drawImage(embedded, {
    x: (PAGE_WIDTH - fitted.width) / 2,
    y: (PAGE_HEIGHT - fitted.height) / 2,
    width: fitted.width,
    height: fitted.height,
  })

  return {
    content: Buffer.from(await pdf.save()),
    fileName: `commission-work-order-${detail.receiptCode}.pdf`,
    fontVariant: selectedFont.variant,
  }
}
