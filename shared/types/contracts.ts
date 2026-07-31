import type { z } from 'zod'
import type {
  adminAssetDtoSchema,
  assetStatusSchema,
  mediaRoleSchema,
  publicHeroSlideDtoSchema,
  publicVariantDtoSchema,
} from '../schemas/media'
import type {
  apiErrorSchema,
  errorCodeSchema,
} from '../schemas/api'
import type {
  adminWorkDtoSchema,
  adoptionMethodSchema,
  businessStatusSchema,
  managedStudioPhotoDtoSchema,
  managedWorkDtoSchema,
  publicationStatusSchema,
  publicWorkDtoSchema,
  publicSafeWorkPreviewDtoSchema,
  returnPhotoConsentSchema,
  returnPhotoConsentSourceSchema,
  suitTypeSchema,
  workListItemDtoSchema,
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

export type ApiError = z.infer<typeof apiErrorSchema>
export type ErrorCode = z.infer<typeof errorCodeSchema>
export type WorkPurpose = z.infer<typeof workPurposeSchema>
export type SuitType = z.infer<typeof suitTypeSchema>
export type PublicationStatus = z.infer<typeof publicationStatusSchema>
export type AdoptionMethod = z.infer<typeof adoptionMethodSchema>
export type BusinessStatus = z.infer<typeof businessStatusSchema>
export type MediaRole = z.infer<typeof mediaRoleSchema>
export type AssetStatus = z.infer<typeof assetStatusSchema>
export type AdminAssetDto = z.infer<typeof adminAssetDtoSchema>
export type PublicVariantDto = z.infer<typeof publicVariantDtoSchema>
export type PublicHeroSlideDto = z.infer<typeof publicHeroSlideDtoSchema>
export type ReturnPhotoConsentSource = z.infer<
  typeof returnPhotoConsentSourceSchema
>
export type ReturnPhotoConsent = z.infer<typeof returnPhotoConsentSchema>
export type PublicWorkDto = z.infer<typeof publicWorkDtoSchema>
export type AdminWorkDto = z.infer<typeof adminWorkDtoSchema>
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
