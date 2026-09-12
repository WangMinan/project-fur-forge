import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DATABASE_MIGRATIONS_FOLDER } from '../../server/utils/database'

const journal = JSON.parse(readFileSync(
  resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8',
)) as { entries: { tag: string }[] }

function migrationEnd(tag: string) {
  const index = journal.entries.findIndex(entry => entry.tag === tag)
  if (index < 0) throw new Error(`Unknown migration tag: ${tag}`)
  return index + 1
}

export function migrationsAfter(tag: string) {
  return journal.entries.length - migrationEnd(tag)
}

export function migrationsThrough(databaseFile: string, lastTag: string) {
  const entries = journal.entries.slice(0, migrationEnd(lastTag))
  const folder = resolve(dirname(databaseFile), `migrations-through-${lastTag}`)
  mkdirSync(resolve(folder, 'meta'), { recursive: true })
  for (const { tag } of entries) {
    copyFileSync(resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`), resolve(folder, `${tag}.sql`))
  }
  writeFileSync(resolve(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }))
  return folder
}
