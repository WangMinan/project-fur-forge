import type { CropRect } from '../schemas/image-composition'
import type { HeroOrientation, HeroPlacement } from '../types/contracts'

export const HERO_FRAMES = {
  home: {
    landscape: { ratio: 16 / 9, label: '16:9', outputWidth: 3840 },
    portrait: { ratio: 9 / 16, label: '9:16', outputWidth: 1080 },
  },
  commission: {
    landscape: { ratio: 7 / 5, label: '7:5', outputWidth: 1920 },
    portrait: { ratio: 4 / 5, label: '4:5', outputWidth: 1080 },
  },
} as const

export const COMMISSION_ENTRY_FRAME = { ratio: 3 / 2, label: '3:2', outputWidth: 1080 } as const
type HeroFrame = (typeof HERO_FRAMES)[HeroPlacement][HeroOrientation] | typeof COMMISSION_ENTRY_FRAME

export function heroMinimumWithEntry(target: { width: number, height: number }, entryRect?: CropRect | null) {
  if (!entryRect) return target
  const entry = heroCropMinimum(COMMISSION_ENTRY_FRAME, entryRect)
  return { width: Math.max(target.width, entry.width), height: Math.max(target.height, entry.height) }
}

export function heroCropMinimum(frame: HeroFrame, rect: CropRect) {
  return {
    width: Math.ceil(frame.outputWidth / rect.width),
    height: Math.ceil(Math.round(frame.outputWidth / frame.ratio) / rect.height),
  }
}

export function heroCropError(frame: HeroFrame, rect: CropRect, width: number, height: number) {
  const ratio = rect.width * width / (rect.height * height)
  if (Math.abs(ratio - frame.ratio) > frame.ratio * 0.00001) return '选区比例与当前画幅不符'
  const minimum = heroCropMinimum(frame, rect)
  const scale = Math.max(minimum.width / width, minimum.height / height)
  if (Math.ceil(Math.max(width, height) * scale) > 12000) return '选区过小，请扩大选区后再保存'
  return null
}
