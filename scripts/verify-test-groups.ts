import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  coreTestFiles,
  legacyE2eFiles,
  legacyTestFiles,
  smokeTestFiles,
} from '../tests/test-groups'

function filesBelow(directory: string, suffix: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => entry.isDirectory()
      ? filesBelow(join(directory, entry.name), suffix)
      : entry.name.endsWith(suffix)
        ? [join(directory, entry.name).replaceAll('\\', '/')]
        : [])
}

function relativeFiles(directory: string, suffix: string) {
  return filesBelow(directory, suffix)
    .map(file => relative(process.cwd(), file).replaceAll('\\', '/'))
    .toSorted()
}

function assertPartition(actual: readonly string[], groups: readonly string[][], label: string) {
  const assigned = groups.flat()
  const duplicates = assigned.filter((file, index) => assigned.indexOf(file) !== index)
  const missing = actual.filter(file => !assigned.includes(file))
  const unknown = assigned.filter(file => !actual.includes(file))
  if (duplicates.length || missing.length || unknown.length) {
    throw new Error(label + ' classification drift: ' + JSON.stringify({
      duplicates: [...new Set(duplicates)],
      missing,
      unknown,
    }))
  }
}

assertPartition(
  [
    ...relativeFiles('tests/unit', '.test.ts'),
    ...relativeFiles('tests/integration', '.test.ts'),
  ],
  [[...coreTestFiles], [...legacyTestFiles]],
  'Vitest',
)
assertPartition(
  relativeFiles('tests/e2e', '.spec.ts'),
  [[...legacyE2eFiles]],
  'legacy Playwright',
)
assertPartition(
  relativeFiles('tests/smoke', '.spec.ts'),
  [[...smokeTestFiles]],
  'smoke Playwright',
)

console.log(JSON.stringify({
  core: coreTestFiles.length,
  legacyE2e: legacyE2eFiles.length,
  legacyVitest: legacyTestFiles.length,
  smoke: smokeTestFiles.length,
}))
