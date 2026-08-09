import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  readFileSync,
} from 'node:fs'
import { isAbsolute } from 'node:path'
import ffmpegPath from 'ffmpeg-static'

export const OSS_IMAGE_PROCESSING_MAX_BYTES = 20_000_000

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex')

function inputCodec(content) {
  if (content.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return 'png'
  }
  if (content.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) {
    return 'mjpeg'
  }
  if (
    content.subarray(0, 4).toString('ascii') === 'RIFF'
    && content.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp'
  }
  throw new Error('Embedded FFmpeg input is not a supported image Buffer.')
}

function embeddedEnvironment() {
  const environment = {
    ...process.env,
  }

  for (const name of Object.keys(environment)) {
    if (name.toLowerCase() === 'path') {
      delete environment[name]
    }
  }

  return environment
}

function runEmbeddedFfmpeg(arguments_, options = {}) {
  if (
    !ffmpegPath
    || !isAbsolute(ffmpegPath)
    || !existsSync(ffmpegPath)
  ) {
    throw new Error('The ffmpeg-static binary is unavailable.')
  }

  const result = spawnSync(ffmpegPath, arguments_, {
    env: embeddedEnvironment(),
    maxBuffer: 30_000_000,
    timeout: 120_000,
    windowsHide: true,
    ...options,
  })

  if (result.error || result.status !== 0) {
    const error = new Error('Embedded FFmpeg execution failed.')
    error.code = result.error?.code ?? 'EmbeddedFfmpegFailed'
    throw error
  }

  return result
}

function embeddedBinaryIdentity() {
  const version = runEmbeddedFfmpeg(['-version'], {
    encoding: 'utf8',
  }).stdout.split(/\r?\n/u)[0]
  return {
    provider: 'ffmpeg-static',
    version,
    sha256: createHash('sha256')
      .update(readFileSync(ffmpegPath))
      .digest('hex'),
    usedPathLookup: false,
  }
}

export function preprocessImageForOss(content) {
  if (!Buffer.isBuffer(content)) {
    throw new Error('Embedded FFmpeg input must be an image Buffer.')
  }
  const codec = inputCodec(content)
  const result = runEmbeddedFfmpeg([
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-c:v',
    codec,
    '-i',
    'pipe:0',
    '-frames:v',
    '1',
    '-map_metadata',
    '-1',
    '-vf',
    "scale=w='min(4096,iw)':h='min(4096,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    '-threads',
    '1',
    '-c:v',
    'png',
    '-compression_level',
    '9',
    '-pred',
    'mixed',
    '-f',
    'image2pipe',
    'pipe:1',
  ], {
    input: content,
  })
  const output = result.stdout

  if (
    output.length === 0
    || output.length < 24
    || output.length > OSS_IMAGE_PROCESSING_MAX_BYTES
    || !output.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new Error('Embedded FFmpeg output is not an OSS-processable PNG.')
  }

  return {
    content: output,
    contentType: 'image/png',
    dimensions: {
      width: output.readUInt32BE(16),
      height: output.readUInt32BE(20),
    },
    binary: embeddedBinaryIdentity(),
  }
}

export function upscaleHeroImage(content, orientation) {
  if (!Buffer.isBuffer(content)) {
    throw new Error('Embedded FFmpeg input must be an image Buffer.')
  }
  if (orientation !== 'landscape' && orientation !== 'portrait') {
    throw new Error('Hero upscale orientation is invalid.')
  }
  const width = orientation === 'landscape' ? 1920 : 1080
  const height = orientation === 'landscape' ? 1080 : 1920
  const filter = `scale=w=${width}:h=${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`
  const result = runEmbeddedFfmpeg([
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-c:v',
    inputCodec(content),
    '-i',
    'pipe:0',
    '-frames:v',
    '1',
    '-map_metadata',
    '-1',
    '-vf',
    filter,
    '-threads',
    '1',
    '-c:v',
    'png',
    '-compression_level',
    '9',
    '-pred',
    'mixed',
    '-f',
    'image2pipe',
    'pipe:1',
  ], { input: content })
  const output = result.stdout
  if (
    output.length === 0
    || output.length < 24
    || output.length > OSS_IMAGE_PROCESSING_MAX_BYTES
    || !output.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
    || output.readUInt32BE(16) !== width
    || output.readUInt32BE(20) !== height
  ) {
    throw new Error('Embedded FFmpeg hero upscale output is invalid.')
  }
  return {
    content: output,
    contentType: 'image/png',
    dimensions: { width, height },
    filter,
    binary: embeddedBinaryIdentity(),
  }
}

export function upscaleDesignSheetImage(content, minimumDimensions) {
  if (!Buffer.isBuffer(content)) {
    throw new Error('Embedded FFmpeg input must be an image Buffer.')
  }
  const minimumWidth = minimumDimensions?.width
  const minimumHeight = minimumDimensions?.height
  if (
    !Number.isInteger(minimumWidth)
    || minimumWidth < 1
    || minimumWidth > 12_000
    || !Number.isInteger(minimumHeight)
    || minimumHeight < 0
    || minimumHeight > 12_000
  ) {
    throw new Error('Design sheet upscale dimensions are invalid.')
  }

  const filter = minimumHeight > 0
    ? `scale=w=${minimumWidth}:h=${minimumHeight}:force_original_aspect_ratio=increase:force_divisible_by=2:flags=lanczos`
    : `scale=w=${minimumWidth}:h=-2:flags=lanczos`
  const result = runEmbeddedFfmpeg([
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-c:v',
    inputCodec(content),
    '-i',
    'pipe:0',
    '-frames:v',
    '1',
    '-map_metadata',
    '-1',
    '-vf',
    filter,
    '-threads',
    '1',
    '-c:v',
    'png',
    '-compression_level',
    '9',
    '-pred',
    'mixed',
    '-f',
    'image2pipe',
    'pipe:1',
  ], { input: content })
  const output = result.stdout
  const width = output.length >= 24 ? output.readUInt32BE(16) : 0
  const height = output.length >= 24 ? output.readUInt32BE(20) : 0
  if (
    output.length === 0
    || output.length < 24
    || output.length > OSS_IMAGE_PROCESSING_MAX_BYTES
    || !output.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
    || width < minimumWidth
    || height < minimumHeight
    || width > 12_000
    || height > 12_000
  ) {
    throw new Error('Embedded FFmpeg design sheet upscale output is invalid.')
  }
  return {
    content: output,
    contentType: 'image/png',
    dimensions: { width, height },
    filter,
    binary: embeddedBinaryIdentity(),
  }
}

export function compressPngForOss(content) {
  if (!Buffer.isBuffer(content) || inputCodec(content) !== 'png') {
    throw new Error('Embedded FFmpeg preflight input must be a PNG Buffer.')
  }
  return preprocessImageForOss(content)
}
