import type { z } from 'zod'
import type {
  publicSiteMetaSchema,
} from '../schemas/site-meta'
import type {
  analyticsActionKeySchema,
  analyticsEntityTypeSchema,
  analyticsEventRequestSchema,
  analyticsEventTypeSchema,
  analyticsOverviewDtoSchema,
  analyticsRouteKeySchema,
} from '../schemas/analytics'
import type {
  adminAssetDtoSchema,
  assetStatusSchema,
  mediaRoleSchema,
  publicPngSourceSetDtoSchema,
  publicSourceSetDtoSchema,
  publicVariantDtoSchema,
} from '../schemas/media'
import type {
  adminHeroCollectionDtoSchema,
  adminHeroItemDtoSchema,
  adminHeroItemPreviewDtoSchema,
  heroPlacementSchema,
  heroOrientationSchema,
  homeEntryKindSchema,
  publicCommissionHeroDtoSchema,
  publicHomeDtoSchema,
  publicHomeEntryDtoSchema,
  publicHeroItemDtoSchema,
  publicHeroPlacementDtoSchema,
} from '../schemas/home'
import type {
  publicAdoptionListDtoSchema,
  publicAdoptionListItemDtoSchema,
  publicFeaturedWorksDtoSchema,
  publicHomeAggregateDtoSchema,
  publicHomeEntryCardDtoSchema,
  publicWorkDetailDtoSchema,
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
} from '../schemas/upload'
import type {
  createCommissionSubmissionRequestSchema,
  commissionDeletionBlockerSchema,
  commissionDeletionResultDtoSchema,
  commissionRetentionCandidateDtoSchema,
  commissionSubmissionDetailDtoSchema,
  commissionSubmissionListItemDtoSchema,
  commissionSubmissionStatusSchema,
  commissionUploadSessionDtoSchema,
  commissionUploadStatusSchema,
} from '../schemas/commission'

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
export type CommissionDeletionBlocker = z.infer<
  typeof commissionDeletionBlockerSchema
>
export type CommissionDeletionResultDto = z.infer<
  typeof commissionDeletionResultDtoSchema
>
export type CommissionRetentionCandidateDto = z.infer<
  typeof commissionRetentionCandidateDtoSchema
>
export type AnalyticsEventType = z.infer<typeof analyticsEventTypeSchema>
export type AnalyticsRouteKey = z.infer<typeof analyticsRouteKeySchema>
export type AnalyticsEntityType = z.infer<typeof analyticsEntityTypeSchema>
export type AnalyticsActionKey = z.infer<typeof analyticsActionKeySchema>
export type AnalyticsEventRequest = z.infer<typeof analyticsEventRequestSchema>
export type AnalyticsOverviewDto = z.infer<typeof analyticsOverviewDtoSchema>
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
export type AdminHeroItemDto = z.infer<typeof adminHeroItemDtoSchema>
export type AdminHeroCollectionDto = z.infer<
  typeof adminHeroCollectionDtoSchema
>
export type AdminHeroItemPreviewDto = z.infer<
  typeof adminHeroItemPreviewDtoSchema
>
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
export type ContactPlatform = z.infer<typeof contactPlatformSchema>
export type AdminOfficialChannel = z.infer<typeof adminOfficialChannelSchema>
export type PublicOfficialChannel = z.infer<typeof publicOfficialChannelSchema>
export type PublicAdoptionListItemDto = z.infer<
  typeof publicAdoptionListItemDtoSchema
>
export type PublicAdoptionListDto = z.infer<typeof publicAdoptionListDtoSchema>
export type PublicWorkGalleryItemDto = z.infer<
  typeof publicWorkGalleryItemDtoSchema
>
export type PublicWorkSummaryDto = z.infer<typeof publicWorkSummaryDtoSchema>
export type PublicWorkDetailDto = z.infer<typeof publicWorkDetailDtoSchema>
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
export type VerifiedAssetDto = z.infer<typeof verifiedAssetDtoSchema>
