import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  validateObservabilityEvidenceTemplate,
  validateSecurityObservabilityPolicy,
} from './security-observability-policy-core.mjs'

const input = resolve(process.argv[2] ?? 'deploy/esa/security-observability-policy.json')
const evidenceInput = resolve(process.argv[3] ?? 'deploy/esa/observability-evidence.example.json')

try {
  const policy = JSON.parse(await readFile(input, 'utf8'))
  const evidence = JSON.parse(await readFile(evidenceInput, 'utf8'))
  validateSecurityObservabilityPolicy(policy)
  validateObservabilityEvidenceTemplate(evidence)
  process.stdout.write(`Security and observability policy PASS: ${input}; ${evidenceInput}\n`)
}
catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown validation failure.'
  process.stderr.write(`Security and observability policy FAIL: ${message}\n`)
  process.exitCode = 1
}
