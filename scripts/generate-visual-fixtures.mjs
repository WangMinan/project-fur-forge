/**
 * 生成 T05 首页视觉样张使用的确定性夹具图片（SVG，含毛质纹理）。
 * 全部素材本地生成，不引入任何网络资源；EXT-01 后由正式作品图替换。
 *
 * 用法：node scripts/generate-visual-fixtures.mjs
 * 输出：public/fixtures/works/*.svg
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(rootDir, 'public', 'fixtures', 'works')

/** @typedef {{ base: string, marking: string, cream: string }} FurPalette */

/**
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {[string, string]} options.backdrop
 * @param {FurPalette} options.fur
 * @param {number} options.seed
 * @param {number} options.cx 主体中心（0–1）
 * @param {number} options.cy
 * @param {number} options.scale 主体尺寸（相对短边）
 */
function renderPortrait(options) {
  const { width, height, backdrop, fur, seed, cx, cy, scale } = options
  const unit = Math.min(width, height) * scale
  const ox = width * cx
  const oy = height * cy

  const bodyRx = unit * 0.62
  const bodyRy = unit * 0.58
  const headR = unit * 0.4
  const headCx = ox
  const headCy = oy - bodyRy * 0.68
  const earW = headR * 0.5
  const earH = headR * 0.72

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <defs>
    <linearGradient id="backdrop" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="${backdrop[0]}"/>
      <stop offset="1" stop-color="${backdrop[1]}"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.46" r="0.75">
      <stop offset="0.62" stop-color="#191f2a" stop-opacity="0"/>
      <stop offset="1" stop-color="#191f2a" stop-opacity="0.14"/>
    </radialGradient>
    <filter id="furEdge" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="${seed}" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="${Math.round(unit * 0.06)}" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed + 11}"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.05 0"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#backdrop)"/>

  <ellipse cx="${ox}" cy="${oy + bodyRy * 0.92}" rx="${bodyRx * 1.15}" ry="${unit * 0.1}" fill="#191f2a" opacity="0.10"/>

  <g filter="url(#furEdge)">
    <ellipse cx="${ox}" cy="${oy}" rx="${bodyRx}" ry="${bodyRy}" fill="${fur.base}"/>
    <ellipse cx="${ox - bodyRx * 0.34}" cy="${oy - bodyRy * 0.18}" rx="${bodyRx * 0.34}" ry="${bodyRy * 0.42}" fill="${fur.marking}" opacity="0.85"/>
    <ellipse cx="${ox}" cy="${oy + bodyRy * 0.18}" rx="${bodyRx * 0.44}" ry="${bodyRy * 0.52}" fill="${fur.cream}"/>

    <ellipse cx="${headCx - headR * 0.52}" cy="${headCy - headR * 0.66}" rx="${earW}" ry="${earH}" fill="${fur.base}" transform="rotate(-16 ${headCx - headR * 0.52} ${headCy - headR * 0.66})"/>
    <ellipse cx="${headCx + headR * 0.52}" cy="${headCy - headR * 0.66}" rx="${earW}" ry="${earH}" fill="${fur.base}" transform="rotate(16 ${headCx + headR * 0.52} ${headCy - headR * 0.66})"/>
    <ellipse cx="${headCx - headR * 0.5}" cy="${headCy - headR * 0.62}" rx="${earW * 0.48}" ry="${earH * 0.5}" fill="${fur.marking}" transform="rotate(-16 ${headCx - headR * 0.5} ${headCy - headR * 0.62})"/>
    <ellipse cx="${headCx + headR * 0.5}" cy="${headCy - headR * 0.62}" rx="${earW * 0.48}" ry="${earH * 0.5}" fill="${fur.marking}" transform="rotate(16 ${headCx + headR * 0.5} ${headCy - headR * 0.62})"/>

    <circle cx="${headCx}" cy="${headCy}" r="${headR}" fill="${fur.base}"/>
    <ellipse cx="${headCx}" cy="${headCy + headR * 0.34}" rx="${headR * 0.56}" ry="${headR * 0.46}" fill="${fur.cream}"/>
    <ellipse cx="${headCx}" cy="${headCy + headR * 0.12}" rx="${headR * 0.2}" ry="${headR * 0.14}" fill="${fur.marking}"/>
    <circle cx="${headCx - headR * 0.38}" cy="${headCy - headR * 0.12}" r="${headR * 0.085}" fill="#20242b"/>
    <circle cx="${headCx + headR * 0.38}" cy="${headCy - headR * 0.12}" r="${headR * 0.085}" fill="#20242b"/>
  </g>

  <rect width="${width}" height="${height}" filter="url(#grain)"/>
  <rect width="${width}" height="${height}" fill="url(#vignette)"/>
</svg>
`
}

/** @type {Array<[string, Parameters<typeof renderPortrait>[0]]>} */
const fixtures = [
  ['card-blueberry.svg', {
    width: 1200, height: 1600, seed: 21, cx: 0.5, cy: 0.6, scale: 0.72,
    backdrop: ['#e9e7e1', '#d5d2c9'],
    fur: { base: '#8fa0cc', marking: '#5f74b8', cream: '#edf0f6' },
  }],
  ['card-zhima.svg', {
    width: 1200, height: 1600, seed: 7, cx: 0.5, cy: 0.6, scale: 0.72,
    backdrop: ['#e8e5de', '#d3cfc4'],
    fur: { base: '#55555e', marking: '#3a3a42', cream: '#e9e4d8' },
  }],
  ['card-doudou.svg', {
    width: 1200, height: 1600, seed: 13, cx: 0.5, cy: 0.6, scale: 0.72,
    backdrop: ['#eae7df', '#d8d2c4'],
    fur: { base: '#c08a5a', marking: '#9c683c', cream: '#f0e6d2' },
  }],
  ['card-keke.svg', {
    width: 1200, height: 1600, seed: 33, cx: 0.5, cy: 0.6, scale: 0.72,
    backdrop: ['#e9e5dd', '#d5cfc1'],
    fur: { base: '#6b5343', marking: '#4e3c30', cream: '#c9ae8e' },
  }],
  ['card-lizi.svg', {
    width: 1200, height: 1600, seed: 47, cx: 0.5, cy: 0.6, scale: 0.72,
    backdrop: ['#eae6dd', '#d6d0c2'],
    fur: { base: '#8a6a4c', marking: '#6b4f36', cream: '#e3d3b8' },
  }],
  ['card-naigai.svg', {
    width: 1200, height: 1600, seed: 59, cx: 0.5, cy: 0.6, scale: 0.72,
    backdrop: ['#edeae3', '#dcd7ca'],
    fur: { base: '#e4d9c8', marking: '#b9a68c', cream: '#f4eee2' },
  }],
  ['hero-naigai.svg', {
    width: 1920, height: 1080, seed: 71, cx: 0.66, cy: 0.62, scale: 0.8,
    backdrop: ['#e3ddd0', '#c8bfa9'],
    fur: { base: '#e4d9c8', marking: '#b9a68c', cream: '#f4eee2' },
  }],
  ['route-commission.svg', {
    width: 1800, height: 1200, seed: 83, cx: 0.62, cy: 0.62, scale: 0.76,
    backdrop: ['#e8e5de', '#d3cfc4'],
    fur: { base: '#55555e', marking: '#3a3a42', cream: '#e9e4d8' },
  }],
  ['route-adoption.svg', {
    width: 1800, height: 1200, seed: 97, cx: 0.6, cy: 0.62, scale: 0.76,
    backdrop: ['#e9e7e1', '#d5d2c9'],
    fur: { base: '#8fa0cc', marking: '#5f74b8', cream: '#edf0f6' },
  }],
]

mkdirSync(outDir, { recursive: true })

for (const [name, options] of fixtures) {
  writeFileSync(join(outDir, name), renderPortrait(options))
  console.log(`generated public/fixtures/works/${name}`)
}
