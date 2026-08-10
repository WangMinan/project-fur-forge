import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  createReadStream,
  existsSync,
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

const MAX_OUTPUT_BYTES = 30_000_000
const MAX_ERROR_BYTES = 1_000_000
const FFMPEG_TIMEOUT_MS = 120_000

function requireEmbeddedFfmpeg() {
  if (
    !ffmpegPath
    || !isAbsolute(ffmpegPath)
    || !existsSync(ffmpegPath)
  ) {
    throw new Error('The ffmpeg-static binary is unavailable.')
  }
  return ffmpegPath
}

function embeddedFfmpegError(code) {
  const error = new Error('Embedded FFmpeg execution failed.')
  error.code = code
  return error
}

function runEmbeddedFfmpeg(arguments_, options = {}) {
  const binaryPath = requireEmbeddedFfmpeg()
  return new Promise((resolve, reject) => {
    const stdout = []
    const stderr = []
    let stdoutBytes = 0
    let stderrBytes = 0
    let outputOverflow = false
    let timedOut = false
    let settled = false

    const child = spawn(binaryPath, arguments_, {
      env: embeddedEnvironment(),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const finish = (callback) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      callback()
    }
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, options.timeout ?? FFMPEG_TIMEOUT_MS)

    child.stdout.on('data', (chunk) => {
      if (outputOverflow) {
        return
      }
      stdoutBytes += chunk.length
      if (stdoutBytes > (options.maxBuffer ?? MAX_OUTPUT_BYTES)) {
        outputOverflow = true
        child.kill()
        return
      }
      stdout.push(chunk)
    })
    child.stderr.on('data', (chunk) => {
      if (stderrBytes >= MAX_ERROR_BYTES) {
        return
      }
      const remaining = MAX_ERROR_BYTES - stderrBytes
      const bounded = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk
      stderr.push(bounded)
      stderrBytes += bounded.length
    })
    child.on('error', (cause) => {
      finish(() => reject(embeddedFfmpegError(cause.code ?? 'EmbeddedFfmpegFailed')))
    })
    child.on('close', (status) => {
      finish(() => {
        if (timedOut) {
          reject(embeddedFfmpegError('ETIMEDOUT'))
          return
        }
        if (outputOverflow) {
          reject(embeddedFfmpegError('EmbeddedFfmpegOutputTooLarge'))
          return
        }
        if (status !== 0) {
          reject(embeddedFfmpegError('EmbeddedFfmpegFailed'))
          return
        }
        resolve({
          stderr: Buffer.concat(stderr),
          stdout: Buffer.concat(stdout),
        })
      })
    })

    child.stdin.on('error', () => {
      // The close status remains authoritative (for example, an early FFmpeg
      // validation failure can close stdin before the whole image is written).
    })
    child.stdin.end(options.input)
  })
}

function hashEmbeddedBinary() {
  const binaryPath = requireEmbeddedFfmpeg()
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(binaryPath)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

let binaryIdentityPromise

function embeddedBinaryIdentity() {
  binaryIdentityPromise ??= Promise.all([
    runEmbeddedFfmpeg(['-version']),
    hashEmbeddedBinary(),
  ]).then(([result, sha256]) => ({
    provider: 'ffmpeg-static',
    version: result.stdout.toString('utf8').split(/\r?\n/u)[0],
    sha256,
    usedPathLookup: false,
  }))
  return binaryIdentityPromise
}

export async function preprocessImageForOss(content) {
  if (!Buffer.isBuffer(content)) {
    throw new Error('Embedded FFmpeg input must be an image Buffer.')
  }
  const codec = inputCodec(content)
  const result = await runEmbeddedFfmpeg([
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
    binary: await embeddedBinaryIdentity(),
  }
}

export async function upscaleHeroImage(content, orientation) {
  if (!Buffer.isBuffer(content)) {
    throw new Error('Embedded FFmpeg input must be an image Buffer.')
  }
  if (orientation !== 'landscape' && orientation !== 'portrait') {
    throw new Error('Hero upscale orientation is invalid.')
  }
  const width = orientation === 'landscape' ? 1920 : 1080
  const height = orientation === 'landscape' ? 1080 : 1920
  const filter = `scale=w=${width}:h=${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`
  const result = await runEmbeddedFfmpeg([
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
    binary: await embeddedBinaryIdentity(),
  }
}

export async function upscaleImageToMinimum(content, minimumDimensions) {
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
    throw new Error('Image upscale dimensions are invalid.')
  }

  const filter = minimumHeight > 0
    ? `scale=w=${minimumWidth}:h=${minimumHeight}:force_original_aspect_ratio=increase:force_divisible_by=2:flags=lanczos`
    : `scale=w=${minimumWidth}:h=-2:flags=lanczos`
  const result = await runEmbeddedFfmpeg([
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
    throw new Error('Embedded FFmpeg image upscale output is invalid.')
  }
  return {
    content: output,
    contentType: 'image/png',
    dimensions: { width, height },
    filter,
    binary: await embeddedBinaryIdentity(),
  }
}

/** Backward-compatible name retained for the existing design-sheet call sites. */
export const upscaleDesignSheetImage = upscaleImageToMinimum

export async function compressPngForOss(content) {
  if (!Buffer.isBuffer(content) || inputCodec(content) !== 'png') {
    throw new Error('Embedded FFmpeg preflight input must be a PNG Buffer.')
  }
  return preprocessImageForOss(content)
}
