import type { AdminWorkDto } from '../types/contracts'
import type { FixtureMedia } from './visual-home'
import { workCatalog } from './visual-works'

/**
 * T07 管理端作品工作台的统一类型化夹具。
 *
 * - `dto` 受 `adminWorkDtoSchema` 校验；`private.depositNote/paymentNote` 为 T03 旧契约
 *   字段，夹具一律置 `null`，界面不提供定金/付款备注控件（T09 将删除该契约字段）；
 * - 媒体资产是夹具本地类型 `AdminAssetFixture`，浏览器只见 `assetId` 业务标识，
 *   不含任何私有 Object Key；`thumb` 为 `null` 表示尚无可用衍生图，界面显示状态占位；
 * - 上传、保存、发布等动作不在夹具中模拟成功，只提供状态展示数据；
 * - 列表缩略图与公开站共用 recipe-v1 卡片声明（3:4 @1200）。
 */

export const ADMIN_MEDIA_STATE_VALUES = [
  'pending_upload',
  'uploading',
  'validating',
  'private_ready',
  'generating_public',
  'ready',
  'failed',
] as const

export type AdminMediaState = typeof ADMIN_MEDIA_STATE_VALUES[number]

export type AdminMediaFailureStage = '私有上传' | '校验' | '公开生成'

export interface AdminAssetFixture {
  assetId: string
  kind: 'studio_photo' | 'design_sheet'
  state: AdminMediaState
  order: number
  isPrimary: boolean
  alt: string
  width: number
  height: number
  thumb: string | null
  failureStage: AdminMediaFailureStage | null
}

export interface AdminWorkFixture {
  dto: AdminWorkDto
  sortOrder: number
  isFeatured: boolean
  thumb: FixtureMedia | null
  assets: AdminAssetFixture[]
}

const catalogBySlug = new Map(workCatalog.map(work => [work.dto.slug, work] as const))

function requireCatalog(slug: string) {
  const entry = catalogBySlug.get(slug)
  if (!entry) {
    throw new Error(`visual-works 缺少作品夹具：${slug}`)
  }
  return entry
}

function baseDto(slug: string) {
  const { dto } = requireCatalog(slug)
  return {
    id: dto.id,
    version: dto.version,
    slug: dto.slug,
    characterName: dto.characterName,
    species: dto.species,
    suitType: dto.suitType,
    ownerDisplay: dto.ownerDisplay,
    featureTags: [...dto.featureTags],
  }
}

function readyAsset(
  assetId: string,
  media: FixtureMedia,
  order: number,
  isPrimary = false,
): AdminAssetFixture {
  return {
    assetId,
    kind: 'studio_photo',
    state: 'ready',
    order,
    isPrimary,
    alt: media.alt,
    width: media.width,
    height: media.height,
    thumb: media.src,
    failureStage: null,
  }
}

function inflightAsset(
  assetId: string,
  state: AdminMediaState,
  order: number,
  failureStage: AdminMediaFailureStage | null = null,
): AdminAssetFixture {
  return {
    assetId,
    kind: 'studio_photo',
    state,
    order,
    isPrimary: false,
    alt: '',
    width: 0,
    height: 0,
    thumb: null,
    failureStage,
  }
}

const blueberry = requireCatalog('blueberry')
const zhima = requireCatalog('zhima')
const doudou = requireCatalog('doudou')
const keke = requireCatalog('keke')
const lizi = requireCatalog('lizi')
const naigai = requireCatalog('naigai')

export const adminWorkFixtures: AdminWorkFixture[] = [
  {
    dto: {
      ...baseDto('blueberry'),
      purpose: 'adoption',
      adoptionMethod: 'event_drop',
      businessStatus: 'available',
      priceCnyMinor: 1_560_000,
      publicationStatus: 'published',
      private: {
        ownerContact: '领养沟通群管理员（示例私有联系人）',
        depositNote: null,
        paymentNote: null,
        originalObjectKeys: [],
      },
    },
    sortOrder: 1,
    isFeatured: true,
    thumb: blueberry.card,
    assets: [
      readyAsset('f2c9a1b4-3d5e-4f6a-8b7c-9d0e1f2a3b4c', blueberry.gallery[0]!, 1, true),
    ],
  },
  {
    dto: {
      ...baseDto('zhima'),
      purpose: 'commission',
      publicationStatus: 'published',
      private: {
        ownerContact: '阿灰（QQ 示例私有联系人）',
        depositNote: null,
        paymentNote: null,
        originalObjectKeys: [],
      },
    },
    sortOrder: 2,
    isFeatured: true,
    thumb: zhima.card,
    assets: [
      readyAsset('a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6', zhima.gallery[0]!, 1, true),
    ],
  },
  {
    dto: {
      ...baseDto('doudou'),
      purpose: 'commission',
      publicationStatus: 'draft',
      private: {
        ownerContact: null,
        depositNote: null,
        paymentNote: null,
        originalObjectKeys: [],
      },
    },
    sortOrder: 3,
    isFeatured: true,
    thumb: doudou.card,
    assets: [
      readyAsset('b2c3d4e5-f6a7-48b9-c0d1-e2f3a4b5c6d7', doudou.gallery[0]!, 1, true),
      inflightAsset('c3d4e5f6-a7b8-49c0-d1e2-f3a4b5c6d7e8', 'validating', 2),
    ],
  },
  {
    dto: {
      ...baseDto('keke'),
      purpose: 'showcase',
      publicationStatus: 'published',
      private: {
        ownerContact: null,
        depositNote: null,
        paymentNote: null,
        originalObjectKeys: [],
      },
    },
    sortOrder: 4,
    isFeatured: true,
    thumb: keke.card,
    assets: [
      readyAsset('d4e5f6a7-b8c9-4ad0-e1f2-a3b4c5d6e7f8', keke.gallery[0]!, 1, true),
    ],
  },
  {
    dto: {
      ...baseDto('lizi'),
      purpose: 'showcase',
      publicationStatus: 'draft',
      private: {
        ownerContact: '果核（邮箱示例私有联系人）',
        depositNote: null,
        paymentNote: null,
        originalObjectKeys: [],
      },
    },
    sortOrder: 5,
    isFeatured: false,
    thumb: lizi.card,
    assets: [
      readyAsset('e5f6a7b8-c9d0-4be1-f2a3-b4c5d6e7f8a9', lizi.gallery[0]!, 1, true),
      inflightAsset('f6a7b8c9-d0e1-4cf2-a3b4-c5d6e7f8a9b0', 'failed', 2, '校验'),
    ],
  },
  {
    dto: {
      ...baseDto('naigai'),
      purpose: 'showcase',
      publicationStatus: 'unpublished',
      private: {
        ownerContact: null,
        depositNote: null,
        paymentNote: null,
        originalObjectKeys: [],
      },
    },
    sortOrder: 6,
    isFeatured: false,
    thumb: naigai.card,
    assets: naigai.gallery.map((media, index) => readyAsset(
      `0a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5${index}`,
      media,
      index + 1,
      index === 0,
    )),
  },
]

export function findAdminWorkById(id: string): AdminWorkFixture | undefined {
  return adminWorkFixtures.find(work => work.dto.id === id)
}

/** 媒体完整性摘要：READY 数 / 总数 + 进行中与失败计数。 */
export function summarizeAssets(assets: AdminAssetFixture[]) {
  const ready = assets.filter(asset => asset.state === 'ready').length
  const processing = assets.filter(asset =>
    asset.state !== 'ready' && asset.state !== 'failed',
  ).length
  const failed = assets.filter(asset => asset.state === 'failed').length

  return {
    total: assets.length,
    ready,
    processing,
    failed,
  }
}
