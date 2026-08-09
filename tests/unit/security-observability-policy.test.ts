import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  validateObservabilityEvidenceTemplate,
  validateSecurityObservabilityPolicy,
} from '../../scripts/security-observability-policy-core.mjs'

interface PolicyShape {
  alerts: Array<{ threshold: unknown }>
  budget: {
    monthlyBudgetCny: unknown
    usageCapValue: unknown
  }
  edgeHttps: { originTlsEnabled: boolean }
  environmentPolicy: { productionPlanRequired: boolean }
  hostInvariants: { certificateFilesForbidden: boolean }
  originProtection: { appListen: string }
  waf: { rules: Array<{ threshold: unknown }> }
}

function baseline(): PolicyShape {
  return JSON.parse(readFileSync(
    resolve('deploy/esa/security-observability-policy.json'),
    'utf8',
  )) as PolicyShape
}

function evidenceTemplate(): Record<string, unknown> {
  return JSON.parse(readFileSync(
    resolve('deploy/esa/observability-evidence.example.json'),
    'utf8',
  )) as Record<string, unknown>
}

describe('T52-E5 security and observability policy', () => {
  it('freezes HTTPS, origin protection, WAF, monitoring, and host invariants', () => {
    expect(() => validateSecurityObservabilityPolicy(baseline())).not.toThrow()
    expect(() => validateObservabilityEvidenceTemplate(evidenceTemplate())).not.toThrow()
  })

  it('rejects an invented rate, alert, budget, or usage-cap threshold', () => {
    for (const mutate of [
      (policy: PolicyShape) => policy.waf.rules[0]!.threshold = 20,
      (policy: PolicyShape) => policy.alerts[0]!.threshold = 80,
      (policy: PolicyShape) => policy.budget.monthlyBudgetCny = 100,
      (policy: PolicyShape) => policy.budget.usageCapValue = 90,
    ]) {
      const policy = baseline()
      mutate(policy)
      expect(() => validateSecurityObservabilityPolicy(policy)).toThrow(/must stay null/u)
    }
  })

  it('rejects Free production, origin TLS, public 3000, or host certificate drift', () => {
    const freeProduction = baseline()
    freeProduction.environmentPolicy.productionPlanRequired = false
    expect(() => validateSecurityObservabilityPolicy(freeProduction)).toThrow(/plan boundaries/u)

    const originTls = baseline()
    originTls.edgeHttps.originTlsEnabled = true
    expect(() => validateSecurityObservabilityPolicy(originTls)).toThrow(/HTTP origin/u)

    const publicApp = baseline()
    publicApp.originProtection.appListen = '0.0.0.0:3000'
    expect(() => validateSecurityObservabilityPolicy(publicApp)).toThrow(/Origin protection/u)

    const hostCertificate = baseline()
    hostCertificate.hostInvariants.certificateFilesForbidden = false
    expect(() => validateSecurityObservabilityPolicy(hostCertificate)).toThrow(/certificateFilesForbidden/u)
  })

  it('rejects a pre-filled or incomplete evidence template', () => {
    const filled = evidenceTemplate()
    filled.redactionConfirmed = true
    expect(() => validateObservabilityEvidenceTemplate(filled)).toThrow(/unfilled production template/u)

    const incomplete = evidenceTemplate()
    incomplete.alerts = []
    expect(() => validateObservabilityEvidenceTemplate(incomplete)).toThrow(/ids drifted/u)
  })
})
