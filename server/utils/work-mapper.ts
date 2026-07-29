import {
  adminWorkDtoSchema,
  publicWorkDtoSchema,
} from '../../shared/schemas/work'
import type {
  AdminWorkDto,
  AdoptionMethod,
  BusinessStatus,
  PublicationStatus,
  PublicWorkDto,
  SuitType,
  WorkPurpose,
} from '../../shared/types/contracts'

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
  priceCnyMinor: number | null
  ownerContact: string | null
  depositNote: string | null
  paymentNote: string | null
  originalObjectKeys: string[]
}

function commonFields(record: WorkRecord) {
  return {
    id: record.id,
    version: record.version,
    slug: record.slug,
    characterName: record.characterName,
    species: record.species,
    suitType: record.suitType,
    ownerDisplay: record.ownerDisplay,
    featureTags: [...record.featureTags],
  }
}

export function toPublicWorkDto(
  record: WorkRecord,
): PublicWorkDto | null {
  if (record.publicationStatus !== 'published') {
    return null
  }

  const common = commonFields(record)

  if (record.purpose === 'adoption') {
    return publicWorkDtoSchema.parse({
      ...common,
      purpose: record.purpose,
      adoptionMethod: record.adoptionMethod,
      businessStatus: record.businessStatus,
      ...(record.priceCnyMinor === null
        ? {}
        : {
            price: {
              currency: 'CNY',
              minorUnits: record.priceCnyMinor,
            },
          }),
    })
  }

  return publicWorkDtoSchema.parse({
    ...common,
    purpose: record.purpose,
  })
}

export function toAdminWorkDto(record: WorkRecord): AdminWorkDto {
  const common = {
    ...commonFields(record),
    publicationStatus: record.publicationStatus,
    private: {
      ownerContact: record.ownerContact,
      depositNote: record.depositNote,
      paymentNote: record.paymentNote,
      originalObjectKeys: [...record.originalObjectKeys],
    },
  }

  if (record.purpose === 'adoption') {
    return adminWorkDtoSchema.parse({
      ...common,
      purpose: record.purpose,
      ...(record.adoptionMethod === null
        ? {}
        : { adoptionMethod: record.adoptionMethod }),
      ...(record.businessStatus === null
        ? {}
        : { businessStatus: record.businessStatus }),
      ...(record.priceCnyMinor === null
        ? {}
        : { priceCnyMinor: record.priceCnyMinor }),
    })
  }

  return adminWorkDtoSchema.parse({
    ...common,
    purpose: record.purpose,
  })
}
