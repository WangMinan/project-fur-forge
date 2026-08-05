import type { z } from 'zod'
import type {
  adminAssetDtoSchema,
  assetStatusSchema,
  mediaRoleSchema,
  publicHeroSlideDtoSchema,
  publicSourceSetDtoSchema,
  publicVariantDtoSchema,
} from '../schemas/media'
import type {
  adminHeroAssetDtoSchema,
  adminHeroPreviewDtoSchema,
  adminHeroSlideDtoSchema,
  adminHomeDtoSchema,
  heroPlacementSchema,
  homeEntryKindSchema,
  publicCommissionHeroDtoSchema,
  publicHomeDtoSchema,
  publicHomeEntriesDtoSchema,
  publicHomeEntryDtoSchema,
} from '../schemas/home'
import type {
  publicAdoptionListDtoSchema,
  publicAdoptionListItemDtoSchema,
  publicDesignSheetDtoSchema,
  publicFeaturedWorksDtoSchema,
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
  publicSiteBusinessStatusDtoSchema,
  publicSiteContentDtoSchema,
  siteBusinessStatusKindSchema,
  siteBusinessStatusToneSchema,
} from '../schemas/site-content'
import type {
  publicationBlockerSchema,
  publicationFailureStageSchema,
  publicationOperationDtoSchema,
  publicationOperationStatusSchema,
  workPublicationCheckDtoSchema,
} from '../schemas/publication'
import type {
  apiErrorSchema,
  errorCodeSchema,
} from '../schemas/api'
import type {
  adminWorkDtoSchema,
  adoptionMethodSchema,
  businessStatusSchema,
  managedDesignSheetDtoSchema,
  managedStudioPhotoDtoSchema,
  managedWorkDtoSchema,
  publicationStatusSchema,
  publicWorkDtoSchema,
  publicAdoptionWorkDtoSchema,
  publicSafeWorkPreviewDtoSchema,
  regularAdoptionBusinessStatusSchema,
  returnPhotoConsentSchema,
  returnPhotoConsentSourceSchema,
  suitTypeSchema,
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

export type ApiError = z.infer<typeof apiErrorSchema>
export type ErrorCode = z.infer<typeof errorCodeSchema>
export type WorkPurpose = z.infer<typeof workPurposeSchema>
export type SuitType = z.infer<typeof suitTypeSchema>
export type PublicationStatus = z.infer<typeof publicationStatusSchema>
export type AdoptionMethod = z.infer<typeof adoptionMethodSchema>
export type BusinessStatus = z.infer<typeof businessStatusSchema>
export type RegularAdoptionBusinessStatus = z.infer<
  typeof regularAdoptionBusinessStatusSchema
>
export type MediaRole = z.infer<typeof mediaRoleSchema>
export type AssetStatus = z.infer<typeof assetStatusSchema>
export type AdminAssetDto = z.infer<typeof adminAssetDtoSchema>
export type PublicVariantDto = z.infer<typeof publicVariantDtoSchema>
export type PublicSourceSetDto = z.infer<typeof publicSourceSetDtoSchema>
export type PublicHeroSlideDto = z.infer<typeof publicHeroSlideDtoSchema>
export type AdminHeroAssetDto = z.infer<typeof adminHeroAssetDtoSchema>
export type AdminHeroPreviewDto = z.infer<typeof adminHeroPreviewDtoSchema>
export type AdminHeroSlideDto = z.infer<typeof adminHeroSlideDtoSchema>
export type AdminHomeDto = z.infer<typeof adminHomeDtoSchema>
export type HeroPlacement = z.infer<typeof heroPlacementSchema>
export type PublicCommissionHeroDto = z.infer<
  typeof publicCommissionHeroDtoSchema
>
export type PublicHomeDto = z.infer<typeof publicHomeDtoSchema>
export type HomeEntryKind = z.infer<typeof homeEntryKindSchema>
export type PublicHomeEntryDto = z.infer<typeof publicHomeEntryDtoSchema>
export type PublicHomeEntriesDto = z.infer<typeof publicHomeEntriesDtoSchema>
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
export type ReturnPhotoConsentSource = z.infer<
  typeof returnPhotoConsentSourceSchema
>
export type ReturnPhotoConsent = z.infer<typeof returnPhotoConsentSchema>
export type PublicWorkDto = z.infer<typeof publicWorkDtoSchema>
export type PublicAdoptionWorkDto = z.infer<typeof publicAdoptionWorkDtoSchema>
export type AdminWorkDto = z.infer<typeof adminWorkDtoSchema>
export type WorkFields = z.infer<typeof workFieldsSchema>
export type ManagedDesignSheetDto = z.infer<typeof managedDesignSheetDtoSchema>
export type ManagedStudioPhotoDto = z.infer<typeof managedStudioPhotoDtoSchema>
export type ManagedWorkDto = z.infer<typeof managedWorkDtoSchema>
export type WorkListItemDto = z.infer<typeof workListItemDtoSchema>
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
