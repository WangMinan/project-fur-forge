import type { PublicWorkSummaryDto } from '~~/shared/types/contracts'

export type V00PrototypeView =
  | 'a'
  | 'a-m2'
  | 'a-m3'
  | 'b'
  | 'b-m2'
  | 'b-m3'
  | 'c'
  | 'm1'
  | 'm2'
  | 'm3'
  | 'shared'
  | 'shared-detail'

export type V00MotionCharacter = 'm1' | 'm2' | 'm3'

export interface V00MotionProfile {
  label: string
  summary: string
  duration: number
  distance: number
  overshoot: number
  scale: number
  crossAxis: number
  easing: string
}

export const v00MotionProfiles: Record<V00MotionCharacter, V00MotionProfile> = {
  m1: {
    label: 'M1 / RESTRAINED EDITORIAL',
    summary: '5px 级低振幅、接近静止；让空间和字体完成主要工作。',
    duration: 260,
    distance: 5,
    overshoot: 0,
    scale: 1,
    crossAxis: 0,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
  m2: {
    label: 'M2 / SOFT SETTLE',
    summary: '44px 级柔软位移，轻微放大越过目标再回位，能看见 settle 过程但不弹跳。',
    duration: 680,
    distance: 44,
    overshoot: 9,
    scale: 0.96,
    crossAxis: 18,
    easing: 'cubic-bezier(0.2, 1.16, 0.32, 1)',
  },
  m3: {
    label: 'M3 / STRONGER DIRECTIONAL',
    summary: '58px 级方向性位移；标题、说明和 CTA 使用不同距离跟随切换方向。',
    duration: 480,
    distance: 58,
    overshoot: 0,
    scale: 1,
    crossAxis: 0,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
}

export interface V00FeaturedItemContext {
  work: PublicWorkSummaryDto
  imageSrc: string
  imageWidth: number
  imageHeight: number
}

export interface V00FeaturedContext {
  items: V00FeaturedItemContext[]
  activeIndex: number
  work: PublicWorkSummaryDto
  imageSrc: string
  imageWidth: number
  imageHeight: number
  eyebrow: 'SELECTED WORKS'
  title: '代表作品'
  description: '更多角色与制作细节，请前往完整作品展示。'
  ctaLabel: '浏览作品展示'
}

export function v00WorkDetailTarget(context: V00FeaturedContext) {
  return {
    path: context.work.href,
    query: { view: 'home-featured' },
  }
}
