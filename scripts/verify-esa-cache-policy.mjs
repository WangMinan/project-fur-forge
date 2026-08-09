import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { validateEsaCachePolicy } from './esa-cache-policy-core.mjs'

const input = resolve(process.argv[2] ?? 'deploy/esa/cache-policy.json')

try {
  const policy = JSON.parse(await readFile(input, 'utf8'))
  validateEsaCachePolicy(policy)
  process.stdout.write(`ESA cache policy PASS: ${input}\n`)
}
catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown validation failure.'
  process.stderr.write(`ESA cache policy FAIL: ${message}\n`)
  process.exitCode = 1
}
