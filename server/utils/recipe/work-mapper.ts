import {
  adminWorkDtoSchema,
  publicWorkDtoSchema,
} from '../../../shared/schemas/work'
import type {
  AdminWorkDto,
  AdoptionMethod,
  BusinessStatus,
  PublicationStatus,
  PublicWorkDto,
  SuitType,
  WorkPurpose,
} from '../../../shared/types/contracts'

export interface WorkRecord {
  id: string
  version: number
  slug: string
  characterName: string
  species: string
  suitType: SuitType
  purpose: WorkPurpose
  publicationStatus: PublicationStatus
  ownerDisplay: string
  featureTags: string[]
  adoptionMethod: AdoptionMethod | null
  businessStatus: BusinessStatus | null
  currentEventName: string | null
  featured: boolean
  priceCnyMinor: number | null
  sortOrder: number
  ownerContact: string | null
  assetIds: string[]
  /** Service-only storage identities. DTO mappers must never project these. */
  originalObjectKeys: string[]
}

export function toPublicWorkDto(
  record: WorkRecord,
): PublicWorkDto | null {
  if (record.publicationStatus !== 'published') {
    return null
  }

  if (record.purpose === 'adoption') {
    if (record.adoptionMethod === null || record.businessStatus === null) {
      return null
    }
    if (record.priceCnyMinor === null) {
      return publicWorkDtoSchema.parse({
        id: record.id,
        version: record.version,
        slug: record.slug,
        characterName: record.characterName,
        species: record.species,
        suitType: record.suitType,
        ownerDisplay: record.ownerDisplay,
        featureTags: [...record.featureTags],
        purpose: 'adoption',
        adoptionMethod: record.adoptionMethod,
        businessStatus: record.businessStatus,
      })
    }

    return publicWorkDtoSchema.parse({
      id: record.id,
      version: record.version,
      slug: record.slug,
      characterName: record.characterName,
      species: record.species,
      suitType: record.suitType,
      ownerDisplay: record.ownerDisplay,
      featureTags: [...record.featureTags],
      purpose: 'adoption',
      adoptionMethod: record.adoptionMethod,
      businessStatus: record.businessStatus,
      price: {
        currency: 'CNY',
        minorUnits: record.priceCnyMinor,
      },
    })
  }

  return publicWorkDtoSchema.parse({
    id: record.id,
    version: record.version,
    slug: record.slug,
    characterName: record.characterName,
    species: record.species,
    suitType: record.suitType,
    ownerDisplay: record.ownerDisplay,
    featureTags: [...record.featureTags],
    purpose: record.purpose,
  })
}

export function toAdminWorkDto(record: WorkRecord): AdminWorkDto {
  if (record.purpose === 'adoption') {
    return adminWorkDtoSchema.parse({
      id: record.id,
      version: record.version,
      slug: record.slug,
      characterName: record.characterName,
      species: record.species,
      suitType: record.suitType,
      ownerDisplay: record.ownerDisplay,
      featureTags: [...record.featureTags],
      purpose: 'adoption',
      publicationStatus: record.publicationStatus,
      assetIds: [...record.assetIds],
      private: {
        ownerContact: record.ownerContact,
      },
      adoptionMethod: record.adoptionMethod,
      businessStatus: record.businessStatus,
      currentEventName: record.currentEventName,
      priceCnyMinor: record.priceCnyMinor,
      sortOrder: record.sortOrder,
      featured: record.featured,
    })
  }

  return adminWorkDtoSchema.parse({
    id: record.id,
    version: record.version,
    slug: record.slug,
    characterName: record.characterName,
    species: record.species,
    suitType: record.suitType,
    ownerDisplay: record.ownerDisplay,
    featureTags: [...record.featureTags],
    purpose: record.purpose,
    publicationStatus: record.publicationStatus,
    assetIds: [...record.assetIds],
    private: {
      ownerContact: record.ownerContact,
    },
    sortOrder: record.sortOrder,
    featured: record.featured,
  })
}
