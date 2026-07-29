import type { PublicWorkDto } from '../types/contracts'
import type { FixtureMedia } from './visual-home'
import { visualWorkFixtures } from './visual-home'

/**
 * T06 作品列表与详情的统一类型化夹具。
 *
 * - 业务字段复用 `visual-home` 中已通过 `publicWorkDtoSchema` 校验的 DTO，不改变契约；
 * - `card` 按 recipe-v1 卡片衍生（3:4 @1200 宽）声明，`gallery` 按原比例详情衍生声明；
 * - `mediaOrigin = 'sample-photo'` 的媒体来自 materials/picture-examples/，
 *   只作内部开发样张（非标准出厂照，EXT-01 通过前不代表正式上线授权）；
 *   文件为 2:3 竖图，卡片 3:4 由 object-fit + 焦点裁切呈现，不附加任何 OSS 动态处理参数；
 * - `mediaOrigin = 'fixture-svg'` 的媒体沿用 T05 确定性矢量夹具。
 * EXT-01 与真实公开投影落地后，由 T20 以真实数据替换本模块。
 */

export type FixtureMediaOrigin = 'fixture-svg' | 'sample-photo'

export interface WorkCatalogEntry {
  dto: PublicWorkDto
  /** 列表/卡片衍生图：3:4，声明宽 1200。 */
  card: FixtureMedia
  /** 详情有序图集，第一项为主图；出厂照不超过 5 张。 */
  gallery: FixtureMedia[]
  mediaOrigin: FixtureMediaOrigin
}

const sampleMedia = (
  src: string,
  alt: string,
  width: number,
  height: number,
  focalDesktop: string,
  focalMobile = focalDesktop,
): FixtureMedia => ({
  src,
  alt,
  width,
  height,
  focal: { desktop: focalDesktop, mobile: focalMobile },
})

/** 把 recipe-v1 卡片声明（3:4 @1200×1600）套用到样张文件。 */
const sampleCard = (
  src: string,
  alt: string,
  focalDesktop: string,
  focalMobile = focalDesktop,
): FixtureMedia => sampleMedia(src, alt, 1200, 1600, focalDesktop, focalMobile)

const svgFixtureBySlug = new Map(
  visualWorkFixtures.map(work => [work.dto.slug, work] as const),
)

function svgEntry(slug: string): WorkCatalogEntry {
  const fixture = svgFixtureBySlug.get(slug)
  if (!fixture) {
    throw new Error(`visual-home 缺少作品夹具：${slug}`)
  }
  return {
    dto: fixture.dto,
    card: fixture.card,
    gallery: [fixture.card],
    mediaOrigin: 'fixture-svg',
  }
}

/** 作品目录的人工顺序，与首页精选顺序保持一致。 */
export const workCatalog: WorkCatalogEntry[] = [
  {
    dto: svgFixtureBySlug.get('blueberry')!.dto,
    card: sampleCard(
      '/fixtures/samples/photo-bluecat-grass.jpg',
      '蓝白色猫全装角色坐在草地上的样张照片（内部开发样张）',
      '50% 26%',
      '50% 24%',
    ),
    gallery: [
      sampleMedia(
        '/fixtures/samples/photo-bluecat-grass.jpg',
        '蓝白色猫全装角色坐在草地上的样张照片（内部开发样张）',
        1080,
        1620,
        '50% 26%',
        '50% 24%',
      ),
    ],
    mediaOrigin: 'sample-photo',
  },
  svgEntry('zhima'),
  svgEntry('doudou'),
  svgEntry('keke'),
  svgEntry('lizi'),
  {
    dto: svgFixtureBySlug.get('naigai')!.dto,
    card: sampleCard(
      '/fixtures/samples/studio-cream-standing.jpg',
      '奶油色猫全装角色站在草地上、抬起一只爪子的样张照片（内部开发样张）',
      '50% 20%',
      '50% 18%',
    ),
    gallery: [
      sampleMedia(
        '/fixtures/samples/studio-cream-standing.jpg',
        '奶油色猫全装角色站在草地上、抬起一只爪子的样张照片（内部开发样张）',
        1600,
        2399,
        '50% 20%',
        '50% 18%',
      ),
      sampleMedia(
        '/fixtures/samples/studio-cream-woods.jpg',
        '奶油色猫全装角色站在林间岩石上的样张照片（内部开发样张）',
        1600,
        2400,
        '50% 18%',
        '50% 16%',
      ),
      sampleMedia(
        '/fixtures/samples/studio-cream-lying.jpg',
        '奶油色猫全装角色侧躺在草地上的样张照片（内部开发样张）',
        1600,
        2400,
        '50% 40%',
        '50% 38%',
      ),
      sampleMedia(
        '/fixtures/samples/studio-cream-head.jpg',
        '奶油色猫全装角色头部特写的样张照片（内部开发样张）',
        1600,
        2473,
        '50% 30%',
        '50% 28%',
      ),
    ],
    mediaOrigin: 'sample-photo',
  },
]

export function findWorkBySlug(slug: string): WorkCatalogEntry | undefined {
  return workCatalog.find(work => work.dto.slug === slug)
}
