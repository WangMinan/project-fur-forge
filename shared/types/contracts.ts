import type { z } from 'zod'
import type {
  policeFilingStatusSchema,
  publicFilingItemSchema,
  publicSiteMetaSchema,
} from '../schemas/site-meta'
import type {
  analyticsActionKeySchema,
  analyticsContentRankingItemSchema,
  analyticsContactActionItemSchema,
  analyticsEntityTypeSchema,
  analyticsEventRequestSchema,
  analyticsEventTypeSchema,
  analyticsOverviewDtoSchema,
  analyticsPageRankingItemSchema,
  analyticsRangeSummarySchema,
  analyticsRouteKeySchema,
} from '../schemas/analytics'
import type {
  adminAssetDtoSchema,
  assetStatusSchema,
  mediaRoleSchema,
  publicHeroSlideDtoSchema,
  publicPngSourceSetDtoSchema,
  publicSourceSetDtoSchema,
  publicVariantDtoSchema,
} from '../schemas/media'
import type {
  adminHeroAssetDtoSchema,
  adminHeroCollectionDtoSchema,
  adminHeroItemDtoSchema,
  adminHeroItemPreviewDtoSchema,
  adminHeroPreviewDtoSchema,
  adminHeroSlideDtoSchema,
  adminHomeDtoSchema,
  heroPlacementSchema,
  heroOrientationSchema,
  homeEntryKindSchema,
  publicCommissionHeroDtoSchema,
  publicHomeDtoSchema,
  publicHomeEntriesDtoSchema,
  publicHomeEntryDtoSchema,
  publicHeroItemDtoSchema,
  publicHeroPlacementDtoSchema,
} from '../schemas/home'
import type {
  publicAdoptionListDtoSchema,
  publicAdoptionListItemDtoSchema,
  publicDesignSheetDtoSchema,
  publicFeaturedWorksDtoSchema,
  publicHomeAggregateDtoSchema,
  publicHomeEntryCardDtoSchema,
  publicWorkCardDtoSchema,
  publicWorkDetailDtoSchema,
  publicWorkFilterStateSchema,
  publicWorkGalleryItemDtoSchema,
  publicWorkListDtoSchema,
  publicWorkSummaryDtoSchema,
} from '../schemas/public-content'
import type {
  adminSiteBusinessStatusDtoSchema,
  adminSiteContentDtoSchema,
  adminOfficialChannelSchema,
  contactPlatformSchema,
  publicOfficialChannelSchema,
  publicSiteBusinessStatusDtoSchema,
  publicSiteContentDtoSchema,
  siteBusinessStatusKindSchema,
  siteBusinessStatusToneSchema,
} from '../schemas/site-content'
import type {
  edgePurgeStatusSchema,
  publicationBlockerSchema,
  publicationFailureStageSchema,
  publicationOperationDtoSchema,
  publicationOperationStatusSchema,
  workPublicationCheckDtoSchema,
} from '../schemas/publication'
import type {
  apiErrorSchema,
  errorCodeSchema,
  errorReasonSchema,
} from '../schemas/api'
import type {
  adminWorkDtoSchema,
  adoptionStatusSchema,
  managedAdoptionCoverDtoSchema,
  managedDesignSheetDtoSchema,
  managedStudioPhotoDtoSchema,
  managedWorkDtoSchema,
  publicationStatusSchema,
  publicWorkDtoSchema,
  publicAdoptionWorkDtoSchema,
  publicSafeWorkPreviewDtoSchema,
  featuredWorkOrderRequestSchema,
  workListItemDtoSchema,
  workFieldsSchema,
  workPurposeSchema,
} from '../schemas/work'
import type {
  conditionalPutDtoSchema,
  uploadFailureCodeSchema,
  uploadFailureStageSchema,
  uploadOwnerSchema,
  uploadSessionDtoSchema,
  uploadSessionStatusSchema,
  verifiedAssetDtoSchema,
  watermarkAnchorSchema,
} from '../schemas/upload'
import type {
  watermarkBrandingDtoSchema,
  watermarkCandidateDtoSchema,
  watermarkImpactDtoSchema,
  watermarkOperationDtoSchema,
  watermarkOperationStatusSchema,
  watermarkPreviewKindSchema,
  watermarkProfileDtoSchema,
  watermarkProfileStatusSchema,
} from '../schemas/watermark'
import type {
  createCommissionSubmissionRequestSchema,
  commissionSubmissionDetailDtoSchema,
  commissionSubmissionListItemDtoSchema,
  commissionSubmissionStatusSchema,
  commissionUploadSessionDtoSchema,
  commissionUploadStatusSchema,
} from '../schemas/commission'

export type ApiError = z.infer<typeof apiErrorSchema>
export type CommissionUploadStatus = z.infer<
  typeof commissionUploadStatusSchema
>
export type CommissionUploadSessionDto = z.infer<
  typeof commissionUploadSessionDtoSchema
>
export type CreateCommissionSubmissionRequest = z.infer<
  typeof createCommissionSubmissionRequestSchema
>
export type CommissionSubmissionStatus = z.infer<
  typeof commissionSubmissionStatusSchema
>
export type CommissionSubmissionListItemDto = z.infer<
  typeof commissionSubmissionListItemDtoSchema
>
export type CommissionSubmissionDetailDto = z.infer<
  typeof commissionSubmissionDetailDtoSchema
>
export type AnalyticsEventType = z.infer<typeof analyticsEventTypeSchema>
export type AnalyticsRouteKey = z.infer<typeof analyticsRouteKeySchema>
export type AnalyticsEntityType = z.infer<typeof analyticsEntityTypeSchema>
export type AnalyticsActionKey = z.infer<typeof analyticsActionKeySchema>
export type AnalyticsEventRequest = z.infer<typeof analyticsEventRequestSchema>
export type AnalyticsRangeSummary = z.infer<typeof analyticsRangeSummarySchema>
export type AnalyticsPageRankingItem = z.infer<
  typeof analyticsPageRankingItemSchema
>
export type AnalyticsContentRankingItem = z.infer<
  typeof analyticsContentRankingItemSchema
>
export type AnalyticsContactActionItem = z.infer<
  typeof analyticsContactActionItemSchema
>
export type AnalyticsOverviewDto = z.infer<typeof analyticsOverviewDtoSchema>
export type PoliceFilingStatus = z.infer<typeof policeFilingStatusSchema>
export type PublicFilingItem = z.infer<typeof publicFilingItemSchema>
export type PublicSiteMeta = z.infer<typeof publicSiteMetaSchema>
export type ErrorCode = z.infer<typeof errorCodeSchema>
export type ErrorReason = z.infer<typeof errorReasonSchema>
export type WorkPurpose = z.infer<typeof workPurposeSchema>
export type PublicationStatus = z.infer<typeof publicationStatusSchema>
export type AdoptionStatus = z.infer<typeof adoptionStatusSchema>
export type MediaRole = z.infer<typeof mediaRoleSchema>
export type AssetStatus = z.infer<typeof assetStatusSchema>
export type AdminAssetDto = z.infer<typeof adminAssetDtoSchema>
export type PublicVariantDto = z.infer<typeof publicVariantDtoSchema>
export type PublicSourceSetDto = z.infer<typeof publicSourceSetDtoSchema>
export type PublicPngSourceSetDto = z.infer<typeof publicPngSourceSetDtoSchema>
export type PublicHeroSlideDto = z.infer<typeof publicHeroSlideDtoSchema>
export type AdminHeroAssetDto = z.infer<typeof adminHeroAssetDtoSchema>
export type AdminHeroItemDto = z.infer<typeof adminHeroItemDtoSchema>
export type AdminHeroCollectionDto = z.infer<
  typeof adminHeroCollectionDtoSchema
>
export type AdminHeroPreviewDto = z.infer<typeof adminHeroPreviewDtoSchema>
export type AdminHeroItemPreviewDto = z.infer<
  typeof adminHeroItemPreviewDtoSchema
>
export type AdminHeroSlideDto = z.infer<typeof adminHeroSlideDtoSchema>
export type AdminHomeDto = z.infer<typeof adminHomeDtoSchema>
export type HeroPlacement = z.infer<typeof heroPlacementSchema>
export type HeroOrientation = z.infer<typeof heroOrientationSchema>
export type PublicHeroItemDto = z.infer<typeof publicHeroItemDtoSchema>
export type PublicHeroPlacementDto = z.infer<
  typeof publicHeroPlacementDtoSchema
>
export type PublicCommissionHeroDto = z.infer<
  typeof publicCommissionHeroDtoSchema
>
export type PublicHomeDto = z.infer<typeof publicHomeDtoSchema>
export type HomeEntryKind = z.infer<typeof homeEntryKindSchema>
export type PublicHomeEntryDto = z.infer<typeof publicHomeEntryDtoSchema>
export type PublicHomeEntriesDto = z.infer<typeof publicHomeEntriesDtoSchema>
export type PublicHomeEntryCardDto = z.infer<
  typeof publicHomeEntryCardDtoSchema
>
export type PublicHomeAggregateDto = z.infer<
  typeof publicHomeAggregateDtoSchema
>
export type SiteBusinessStatusKind = z.infer<
  typeof siteBusinessStatusKindSchema
>
export type SiteBusinessStatusTone = z.infer<
  typeof siteBusinessStatusToneSchema
>
export type AdminSiteBusinessStatusDto = z.infer<
  typeof adminSiteBusinessStatusDtoSchema
>
export type PublicSiteBusinessStatusDto = z.infer<
  typeof publicSiteBusinessStatusDtoSchema
>
export type AdminSiteContentDto = z.infer<typeof adminSiteContentDtoSchema>
export type PublicSiteContentDto = z.infer<typeof publicSiteContentDtoSchema>
export type ContactPlatform = z.infer<typeof contactPlatformSchema>
export type AdminOfficialChannel = z.infer<typeof adminOfficialChannelSchema>
export type PublicOfficialChannel = z.infer<typeof publicOfficialChannelSchema>
export type PublicWorkCardDto = z.infer<typeof publicWorkCardDtoSchema>
export type PublicDesignSheetDto = z.infer<typeof publicDesignSheetDtoSchema>
export type PublicAdoptionListItemDto = z.infer<
  typeof publicAdoptionListItemDtoSchema
>
export type PublicAdoptionListDto = z.infer<typeof publicAdoptionListDtoSchema>
export type PublicWorkGalleryItemDto = z.infer<
  typeof publicWorkGalleryItemDtoSchema
>
export type PublicWorkSummaryDto = z.infer<typeof publicWorkSummaryDtoSchema>
export type PublicWorkDetailDto = z.infer<typeof publicWorkDetailDtoSchema>
export type PublicWorkFilterState = z.infer<typeof publicWorkFilterStateSchema>
export type PublicWorkListDto = z.infer<typeof publicWorkListDtoSchema>
export type PublicFeaturedWorksDto = z.infer<
  typeof publicFeaturedWorksDtoSchema
>
export type PublicationOperationStatus = z.infer<
  typeof publicationOperationStatusSchema
>
export type EdgePurgeStatus = z.infer<typeof edgePurgeStatusSchema>
export type PublicationFailureStage = z.infer<
  typeof publicationFailureStageSchema
>
export type PublicationBlocker = z.infer<typeof publicationBlockerSchema>
export type PublicationOperationDto = z.infer<
  typeof publicationOperationDtoSchema
>
export type WorkPublicationCheckDto = z.infer<
  typeof workPublicationCheckDtoSchema
>
export type PublicWorkDto = z.infer<typeof publicWorkDtoSchema>
export type PublicAdoptionWorkDto = z.infer<typeof publicAdoptionWorkDtoSchema>
export type AdminWorkDto = z.infer<typeof adminWorkDtoSchema>
export type WorkFields = z.infer<typeof workFieldsSchema>
export type ManagedDesignSheetDto = z.infer<typeof managedDesignSheetDtoSchema>
export type ManagedAdoptionCoverDto = z.infer<
  typeof managedAdoptionCoverDtoSchema
>
export type ManagedStudioPhotoDto = z.infer<typeof managedStudioPhotoDtoSchema>
export type ManagedWorkDto = z.infer<typeof managedWorkDtoSchema>
export type WorkListItemDto = z.infer<typeof workListItemDtoSchema>
export type FeaturedWorkOrderItem = z.infer<
  typeof featuredWorkOrderRequestSchema
>['payload']['items'][number]
export type PublicSafeWorkPreviewDto = z.infer<
  typeof publicSafeWorkPreviewDtoSchema
>
export type UploadOwner = z.infer<typeof uploadOwnerSchema>
export type UploadSessionStatus = z.infer<typeof uploadSessionStatusSchema>
export type UploadFailureCode = z.infer<typeof uploadFailureCodeSchema>
export type UploadFailureStage = z.infer<typeof uploadFailureStageSchema>
export type UploadSessionDto = z.infer<typeof uploadSessionDtoSchema>
export type ConditionalPutDto = z.infer<typeof conditionalPutDtoSchema>
export type WatermarkAnchor = z.infer<typeof watermarkAnchorSchema>
export type VerifiedAssetDto = z.infer<typeof verifiedAssetDtoSchema>
export type WatermarkProfileStatus = z.infer<typeof watermarkProfileStatusSchema>
export type WatermarkOperationStatus = z.infer<typeof watermarkOperationStatusSchema>
export type WatermarkProfileDto = z.infer<typeof watermarkProfileDtoSchema>
export type WatermarkCandidateDto = z.infer<typeof watermarkCandidateDtoSchema>
export type WatermarkImpactDto = z.infer<typeof watermarkImpactDtoSchema>
export type WatermarkBrandingDto = z.infer<typeof watermarkBrandingDtoSchema>
export type WatermarkOperationDto = z.infer<typeof watermarkOperationDtoSchema>
export type WatermarkPreviewKind = z.infer<typeof watermarkPreviewKindSchema>
