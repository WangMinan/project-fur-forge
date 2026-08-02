import { describe, expect, it } from 'vitest'
import {
  buildSrcset,
  pickFallbackImg,
} from '../../app/utils/public-sources'
import type { PublicSourceSetDto } from '../../shared/types/contracts'

const sources: PublicSourceSetDto = {
  webp: [
    { src: 'https://media.example.test/a-480.webp', width: 480, height: 640, format: 'webp' },
    { src: 'https://media.example.test/a-768.webp', width: 768, height: 1024, format: 'webp' },
    { src: 'https://media.example.test/a-1200.webp', width: 1200, height: 1600, format: 'webp' },
  ],
  fallback: [
    { src: 'https://media.example.test/a-480.jpg', width: 480, height: 640, format: 'jpeg' },
    { src: 'https://media.example.test/a-768.jpg', width: 768, height: 1024, format: 'jpeg' },
    { src: 'https://media.example.test/a-1200.jpg', width: 1200, height: 1600, format: 'jpeg' },
  ],
}

describe('buildSrcset', () => {
  it('按服务端给定顺序拼接 width 描述符，不重排', () => {
    expect(buildSrcset(sources.webp)).toBe(
      'https://media.example.test/a-480.webp 480w, '
      + 'https://media.example.test/a-768.webp 768w, '
      + 'https://media.example.test/a-1200.webp 1200w',
    )
  })

  it('保持调用方给出的顺序（不自行升序）', () => {
    const reversed = [...sources.fallback].reverse()
    expect(buildSrcset(reversed)).toBe(
      'https://media.example.test/a-1200.jpg 1200w, '
      + 'https://media.example.test/a-768.jpg 768w, '
      + 'https://media.example.test/a-480.jpg 480w',
    )
  })
})

describe('pickFallbackImg', () => {
  it('取 fallback 组末位（最大宽度）作为 <img> src 与宽高来源', () => {
    const picked = pickFallbackImg(sources)
    expect(picked.src).toBe('https://media.example.test/a-1200.jpg')
    expect(picked.width).toBe(1200)
    expect(picked.height).toBe(1600)
  })
})
