import {
  publicWorkDtoSchema,
} from '../../../shared/schemas/work'
import type {
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
