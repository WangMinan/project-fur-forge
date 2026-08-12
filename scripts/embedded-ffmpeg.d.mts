export const OSS_IMAGE_PROCESSING_MAX_BYTES: 20_000_000

export function preprocessImageForOss(content: Buffer): Promise<{
  content: Buffer
  contentType: 'image/png'
  dimensions: {
    width: number
    height: number
  }
  binary: {
    provider: 'ffmpeg-static'
    version: string
    sha256: string
    usedPathLookup: false
  }
}>

export function upscaleHeroImage(
  content: Buffer,
  orientation: 'landscape' | 'portrait',
): Promise<{
  content: Buffer
  contentType: 'image/png'
  dimensions: { width: number, height: number }
  filter: string
  binary: {
    provider: 'ffmpeg-static'
    version: string
    sha256: string
    usedPathLookup: false
  }
}>

export function upscaleImageToMinimum(
  content: Buffer,
  minimumDimensions: { width: number, height: number },
): Promise<{
  content: Buffer
  contentType: 'image/png'
  dimensions: { width: number, height: number }
  filter: string
  binary: {
    provider: 'ffmpeg-static'
    version: string
    sha256: string
    usedPathLookup: false
  }
}>

export function fitImageToSquare(
  content: Buffer,
  side: number,
): Promise<{
  content: Buffer
  contentType: 'image/png'
  dimensions: { width: number, height: number }
  filter: string
  binary: {
    provider: 'ffmpeg-static'
    version: string
    sha256: string
    usedPathLookup: false
  }
}>

export const upscaleDesignSheetImage: typeof upscaleImageToMinimum

export function compressPngForOss(content: Buffer): Promise<{
  content: Buffer
  contentType: 'image/png'
  dimensions: {
    width: number
    height: number
  }
  binary: {
    provider: 'ffmpeg-static'
    version: string
    sha256: string
    usedPathLookup: false
  }
}>
