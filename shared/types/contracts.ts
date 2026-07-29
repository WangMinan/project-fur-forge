import type { z } from 'zod'
import type {
  apiErrorSchema,
  errorCodeSchema,
} from '../schemas/api'
import type {
  adminWorkDtoSchema,
  adoptionMethodSchema,
  businessStatusSchema,
  publicationStatusSchema,
  publicWorkDtoSchema,
  returnPhotoConsentSchema,
  returnPhotoConsentSourceSchema,
  suitTypeSchema,
  workPurposeSchema,
} from '../schemas/work'

export type ApiError = z.infer<typeof apiErrorSchema>
export type ErrorCode = z.infer<typeof errorCodeSchema>
export type WorkPurpose = z.infer<typeof workPurposeSchema>
export type SuitType = z.infer<typeof suitTypeSchema>
export type PublicationStatus = z.infer<typeof publicationStatusSchema>
export type AdoptionMethod = z.infer<typeof adoptionMethodSchema>
export type BusinessStatus = z.infer<typeof businessStatusSchema>
export type ReturnPhotoConsentSource = z.infer<
  typeof returnPhotoConsentSourceSchema
>
export type ReturnPhotoConsent = z.infer<typeof returnPhotoConsentSchema>
export type PublicWorkDto = z.infer<typeof publicWorkDtoSchema>
export type AdminWorkDto = z.infer<typeof adminWorkDtoSchema>
