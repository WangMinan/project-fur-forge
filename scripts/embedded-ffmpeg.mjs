import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  readFileSync,
} from 'node:fs'
import { isAbsolute } from 'node:path'
import ffmpegPath from 'ffmpeg-static'

export const OSS_IMAGE_PROCESSING_MAX_BYTES = 20_000_000

const PNG_SIGNATURE = Buffer.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
])

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

export function compressPngForOss(content) {
  if (
    !Buffer.isBuffer(content)
    || !content.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new Error('Embedded FFmpeg preflight input must be a PNG Buffer.')
  }

  const result = runEmbeddedFfmpeg([
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-c:v',
    'png',
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

  const version = runEmbeddedFfmpeg(['-version'], {
    encoding: 'utf8',
  }).stdout.split(/\r?\n/u)[0]

  return {
    content: output,
    contentType: 'image/png',
    dimensions: {
      width: output.readUInt32BE(16),
      height: output.readUInt32BE(20),
    },
    binary: {
      provider: 'ffmpeg-static',
      version,
      sha256: createHash('sha256')
        .update(readFileSync(ffmpegPath))
        .digest('hex'),
      usedPathLookup: false,
    },
  }
}
