import { parseArgs } from 'node:util'
import { backupDatabase, resolveDatabaseFile } from '../server/utils/database'
import { loadRuntimeConfig } from '../server/utils/runtime-config'

const { values } = parseArgs({
  args: process.argv.slice(2).filter(argument => argument !== '--'),
  options: {
    output: {
      short: 'o',
      type: 'string',
    },
  },
})

if (!values.output) {
  throw new Error('Usage: pnpm db:backup -- --output <new-backup.db>')
}

const databaseFile = resolveDatabaseFile(loadRuntimeConfig())
const outputFile = await backupDatabase(databaseFile, values.output)

console.log(JSON.stringify({
  databaseFile,
  outputFile,
}))
