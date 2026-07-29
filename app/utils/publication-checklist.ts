import type { AdminWorkFixture } from '../../shared/fixtures/visual-admin'
import { summarizeAssets } from '../../shared/fixtures/visual-admin'
import { formatCnyMinorUnits } from './format'

/**
 * T07 发布检查：契约来自 .design/admin-console/DESIGN_BRIEF.md §5 发布与回收站状态条：
 * 基础信息完整 / 已设定主图 / 全部媒体 READY / （领养）领养方式与业务状态已选择 /
 * （领养）价格已录入（可空）/ 发布影响说明。
 * 仅做状态求值与文案映射，不模拟发布成功。
 */

export type PublicationCheckState = 'satisfied' | 'missing' | 'processing' | 'blocked'

export interface PublicationCheckItem {
  id: 'basics' | 'primary_media' | 'media_ready' | 'adoption_fields' | 'price' | 'publish_impact'
  label: string
  state: PublicationCheckState
  detail: string
}

export interface PublicationChecklist {
  items: PublicationCheckItem[]
  /** 无 missing/processing/blocked 时允许发布（fixture 下点击发布仍提示接口未接入）。 */
  publishable: boolean
}

const PUBLISH_IMPACT =
  '发布会立即生成公开衍生图并使其在公开端可见；图片直接公开的规则不允许“悄悄改图”，隐藏或替换图片请使用下架。'

export function buildPublicationChecklist(work: AdminWorkFixture): PublicationChecklist {
  const { dto, assets } = work
  const summary = summarizeAssets(assets)

  const items: PublicationCheckItem[] = []

  const basicsComplete =
    dto.characterName.trim().length > 0
    && dto.species.trim().length > 0
    && dto.slug.trim().length > 0
  items.push({
    id: 'basics',
    label: '基础信息完整',
    state: basicsComplete ? 'satisfied' : 'missing',
    detail: basicsComplete ? '角色名、物种与链接别名已填写' : '角色名、物种与链接别名为必填',
  })

  const hasPrimary = assets.some(asset => asset.isPrimary)
  items.push({
    id: 'primary_media',
    label: '已设定主图',
    state: hasPrimary ? 'satisfied' : 'missing',
    detail: hasPrimary ? '主图决定卡片裁切与详情首屏' : '请在图片区把一张 READY 图片设为主图',
  })

  const mediaItem: PublicationCheckItem = {
    id: 'media_ready',
    label: '全部媒体 READY',
    state: 'satisfied',
    detail: `${summary.ready}/${summary.total} 张图片 READY`,
  }
  if (summary.failed > 0) {
    mediaItem.state = 'blocked'
    mediaItem.detail = `${summary.failed} 张图片失败，需修复或删除后才能发布`
  }
  else if (summary.processing > 0) {
    mediaItem.state = 'processing'
    mediaItem.detail = `${summary.processing} 张图片仍在上传或校验中`
  }
  else if (summary.total === 0) {
    mediaItem.state = 'missing'
    mediaItem.detail = '尚未上传任何图片'
  }
  items.push(mediaItem)

  if (dto.purpose === 'adoption') {
    const adoptionComplete = Boolean(dto.adoptionMethod) && Boolean(dto.businessStatus)
    items.push({
      id: 'adoption_fields',
      label: '领养方式与业务状态已选择',
      state: adoptionComplete ? 'satisfied' : 'missing',
      detail: adoptionComplete ? '公开端将展示领养方式与业务状态' : '领养作品发布前必须填写',
    })

    const hasPrice = typeof dto.priceCnyMinor === 'number'
    items.push({
      id: 'price',
      label: '价格已录入（可空）',
      state: 'satisfied',
      detail: hasPrice
        ? `${formatCnyMinorUnits(dto.priceCnyMinor!)} 将展示在公开端`
        : '未录入价格，公开端整区隐藏',
    })
  }

  items.push({
    id: 'publish_impact',
    label: '发布影响说明',
    state: 'satisfied',
    detail: PUBLISH_IMPACT,
  })

  const publishable = items.every(item => item.state === 'satisfied')

  return { items, publishable }
}
