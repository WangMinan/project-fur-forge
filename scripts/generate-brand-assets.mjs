import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const brand = resolve(root, 'public/brand')
mkdirSync(brand, { recursive: true })

function generate(source, target, width, height, markSize, background) {
  const output = resolve(brand, target)
  const transparent = background === '0x00000000'
  const smallIcon = width === 16 && height === 16
  const scaleFlags = smallIcon ? 'neighbor' : 'lanczos'
  const alphaHint = smallIcon ? ",lut=a='if(gte(val,96),255,0)'" : ''
  const inputs = transparent
    ? ['-i', resolve(brand, source)]
    : [
        '-f', 'lavfi',
        '-i', `color=c=${background}:s=${width}x${height}`,
        '-i', resolve(brand, source),
      ]
  const filter = transparent
    ? [
        'format=rgba',
        `scale=${markSize}:${markSize}:force_original_aspect_ratio=decrease:flags=${scaleFlags}${alphaHint}`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${background}`,
      ].join(',')
    : [
        `[1:v]format=rgba,scale=${markSize}:${markSize}:force_original_aspect_ratio=decrease:flags=lanczos[mark]`,
        '[0:v][mark]overlay=(W-w)/2:(H-h)/2:format=auto',
      ].join(';')
  const result = spawnSync(ffmpegPath, [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    ...inputs,
    '-frames:v', '1',
    '-map_metadata', '-1',
    transparent ? '-vf' : '-filter_complex', filter,
    '-compression_level', '9',
    '-pred', 'mixed',
    output,
  ], { windowsHide: true })
  if (result.status !== 0) {
    throw new Error(`Failed to generate ${target}: ${result.stderr.toString().trim()}`)
  }

  const png = readFileSync(output)
  if (
    png.subarray(1, 4).toString('ascii') !== 'PNG'
    || png.readUInt32BE(16) !== width
    || png.readUInt32BE(20) !== height
  ) {
    throw new Error(`${target} has an invalid PNG signature or size.`)
  }
  return {
    file: target,
    sha256: createHash('sha256').update(png).digest('hex'),
  }
}

function generateHashed(source, stem, width, height, markSize, background) {
  const temporary = `${stem}.tmp.png`
  const generated = generate(source, temporary, width, height, markSize, background)
  const file = `${stem}.${generated.sha256.slice(0, 8)}.png`
  const target = resolve(brand, file)

  if (existsSync(target)) {
    rmSync(resolve(brand, temporary))
  } else {
    renameSync(resolve(brand, temporary), target)
  }
  return { file, sha256: generated.sha256 }
}

const outputs = [
  generate('logo-mark.png', 'favicon-dark-32.png', 32, 32, 28, '0x00000000'),
  generate('favicon-dark-32.png', 'favicon-dark-16.png', 16, 16, 16, '0x00000000'),
  generate('logo-mark.png', 'favicon-light-32.png', 32, 32, 28, '0xF7F6F2'),
  generate('favicon-light-32.png', 'favicon-light-16.png', 16, 16, 16, '0x00000000'),
  generate('logo-mark.png', 'apple-touch-icon.png', 180, 180, 138, 'white'),
  generateHashed('logo-mark.png', 'og-default', 1200, 1200, 920, 'white'),
]

process.stdout.write(`${JSON.stringify({ generated: outputs })}\n`)
