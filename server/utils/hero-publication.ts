import type Database from 'better-sqlite3'

export class HeroPublicationValidationError extends Error {
  override name = 'HeroPublicationValidationError'
}

export function validateHeroSlidesForPublication(
  sqlite: Database.Database,
) {
  const rows = sqlite.prepare(`
    SELECT
      slide.id,
      slide.alt_text AS altText,
      slide.sort_order AS sortOrder,
      landscape.role AS landscapeRole,
      landscape.status AS landscapeStatus,
      portrait.role AS portraitRole,
      portrait.status AS portraitStatus,
      linked.publication_status AS linkedWorkStatus
    FROM site_hero_slides AS slide
    JOIN assets AS landscape ON landscape.id = slide.landscape_asset_id
    JOIN assets AS portrait ON portrait.id = slide.portrait_asset_id
    LEFT JOIN works AS linked ON linked.id = slide.linked_work_id
    WHERE slide.enabled = 1
    ORDER BY slide.sort_order
  `).all() as Array<{
    id: string
    altText: string
    sortOrder: number
    landscapeRole: string
    landscapeStatus: string
    portraitRole: string
    portraitStatus: string
    linkedWorkStatus: string | null
  }>

  if (rows.length < 1 || rows.length > 5) {
    throw new HeroPublicationValidationError(
      'Enabled hero slides must contain 1 to 5 items.',
    )
  }

  for (const row of rows) {
    if (
      row.altText.trim() === ''
      || row.sortOrder < 0
      || row.sortOrder > 4
      || row.landscapeRole !== 'home_hero_landscape'
      || row.portraitRole !== 'home_hero_portrait'
      || row.landscapeStatus !== 'READY'
      || row.portraitStatus !== 'READY'
      || (row.linkedWorkStatus !== null
        && row.linkedWorkStatus !== 'published')
    ) {
      throw new HeroPublicationValidationError(
        `Hero slide ${row.id} is not publication-ready.`,
      )
    }
  }

  return rows.length
}
