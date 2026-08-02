import type {
  PublicSourceSetDto,
  PublicVariantDto,
} from '../../shared/types/contracts'

/**
 * 公开图片 srcset 拼接与 fallback 选取。
 * 服务端给出的 variant 数组已按宽度升序；这里只按原顺序拼接，
 * 不重排、不补宽度、不从 URL 推导 profile。
 */
export function buildSrcset(variants: readonly PublicVariantDto[]): string {
  return variants
    .map(variant => `${variant.src} ${variant.width}w`)
    .join(', ')
}

/** `<img>` 的 src/宽高属性取 fallback 组最大宽度项（数组末位）。 */
export function pickFallbackImg(sources: PublicSourceSetDto): PublicVariantDto {
  return sources.fallback[sources.fallback.length - 1]!
}
