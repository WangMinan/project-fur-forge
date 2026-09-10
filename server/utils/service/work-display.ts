import type Database from 'better-sqlite3'
import type { WorkDisplaySettings } from '../../../shared/schemas/image-composition'
import { hasActivePublicationOperation } from '../repository/publication-repository'
import { ServiceError } from '../service-error'
import { publicWorkAssetSources } from '../recipe/work-public-sources'

export interface WorkDisplayState extends WorkDisplaySettings {
  imageCompositionVersion: number
  purpose: string
  publicationStatus: string
}

export function workDisplayState(sqlite: Database.Database, workId: string): WorkDisplayState {
  const row = sqlite.prepare(`SELECT show_adoption_cover_in_detail AS showAdoptionCoverInDetail,
    show_design_sheet_in_detail AS showDesignSheetInDetail, adoption_cover_source AS adoptionCoverSource,
    image_composition_version AS imageCompositionVersion, purpose, publication_status AS publicationStatus FROM works WHERE id=?`).get(workId) as WorkDisplayState
  return { ...row, showAdoptionCoverInDetail: Boolean(row.showAdoptionCoverInDetail), showDesignSheetInDetail: Boolean(row.showDesignSheetInDetail) }
}

export function displayMediaState(sqlite: Database.Database, workId: string) {
  const state = workDisplayState(sqlite, workId)
  const rows = sqlite.prepare(`SELECT r.asset_id AS assetId,r.role FROM work_assets r JOIN assets a ON a.id=r.asset_id
    WHERE r.work_id=? AND a.status='READY' AND r.role=a.role AND length(trim(r.alt_text))>0`).all(workId) as Array<{ assetId: string, role: 'studio_photo' | 'adoption_cover' | 'design_sheet' }>
  const usable = rows.filter(row => state.publicationStatus !== 'published' || publicWorkAssetSources(sqlite, row.assetId,
    row.role === 'design_sheet' ? 'design-sheet' : row.role === 'adoption_cover' && !state.imageCompositionVersion ? 'adoption-card' : 'detail') !== null)
  const visible = usable.filter(row => row.role === 'studio_photo' || (row.role === 'adoption_cover' ? state.showAdoptionCoverInDetail : state.showDesignSheetInDetail))
  const source = state.adoptionCoverSource === 'auto'
    ? usable.find(row => row.role === 'design_sheet') ?? usable.find(row => row.role === 'adoption_cover')
    : usable.find(row => row.role === state.adoptionCoverSource)
  let sourceAvailable = Boolean(source) || state.adoptionCoverSource === 'auto'
  if (state.publicationStatus === 'published' && state.imageCompositionVersion && state.purpose === 'adoption') {
    sourceAvailable = Boolean(source && publicWorkAssetSources(sqlite, source.assetId, 'adoption-catalog') && publicWorkAssetSources(sqlite, source.assetId, 'home-adoption'))
  }
  return { visibleCount: visible.length, sourceAvailable }
}

export function assertWorkDisplay(sqlite: Database.Database, workId: string, requireNonempty: boolean) {
  const state = displayMediaState(sqlite, workId)
  if (requireNonempty && !state.visibleCount) throw new ServiceError(409, 'CONFLICT', '详情图集至少保留一张可展示图片，请先开启附加图或添加图片。', 'DETAIL_GALLERY_EMPTY')
  if (!state.sourceAvailable) throw new ServiceError(409, 'CONFLICT', '指定的领养封面来源不可用，请先调整来源设置。', 'ADOPTION_SOURCE_UNAVAILABLE')
}

export function assertNoWorkOperation(sqlite: Database.Database, workId: string) {
  if (hasActivePublicationOperation(sqlite, 'WORK', workId)) throw new ServiceError(409, 'CONFLICT', '发布操作进行中，请完成后再编辑。', 'ACTIVE_OPERATION_EXISTS')
}
