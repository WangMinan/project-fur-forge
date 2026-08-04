import { parseArgs } from 'node:util'
import {
  resolveDatabaseFile,
  restoreDatabase,
} from '../server/utils/database'
import { loadRuntimeConfig } from '../server/utils/runtime-config'

const { values } = parseArgs({
  args: process.argv.slice(2).filter(argument => argument !== '--'),
  options: {
    input: { short: 'i', type: 'string' },
    output: { short: 'o', type: 'string' },
  },
})

if (!values.input || !values.output) {
  throw new Error(
    'Usage: pnpm db:restore -- --input <backup.db> --output <new-database.db>',
  )
}

const activeDatabaseFile = resolveDatabaseFile(loadRuntimeConfig())
const outputFile = await restoreDatabase(values.input, values.output, {
  activeDatabaseFile,
})

console.log(JSON.stringify({
  activeDatabaseFile,
  inputFile: values.input,
  outputFile,
}))
