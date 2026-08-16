import {
  adminWorkDtoSchema,
  publicWorkDtoSchema,
} from '../../../shared/schemas/work'
import type {
  AdminWorkDto,
  AdoptionStatus,
  PublicationStatus,
  PublicWorkDto,
  WorkPurpose,
} from '../../../shared/types/contracts'

export interface WorkRecord {
  id: string
  version: number
  slug: string
  characterName: string
  species: string
  purpose: WorkPurpose
  publicationStatus: PublicationStatus
  adoptionStatus: AdoptionStatus | null
  featured: boolean
  priceCnyMinor: number | null
  sortOrder: number
  assetIds: string[]
  /** Service-only storage identities. DTO mappers must never project these. */
  originalObjectKeys: string[]
}

export function toPublicWorkDto(record: WorkRecord): PublicWorkDto | null {
  if (record.publicationStatus !== 'published') {
    return null
  }
  return publicWorkDtoSchema.parse({
    id: record.id,
    slug: record.slug,
    characterName: record.characterName,
    species: record.species,
  })
}

export function toAdminWorkDto(record: WorkRecord): AdminWorkDto {
  return adminWorkDtoSchema.parse({
    id: record.id,
    version: record.version,
    slug: record.slug,
    characterName: record.characterName,
    species: record.species,
    purpose: record.purpose,
    publicationStatus: record.publicationStatus,
    assetIds: [...record.assetIds],
    adoptionStatus: record.purpose === 'adoption' ? record.adoptionStatus : null,
    priceCnyMinor: record.purpose === 'adoption' ? record.priceCnyMinor : null,
    sortOrder: record.sortOrder,
    featured: record.featured,
  })
}
