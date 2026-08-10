const ALERT_IDS = [
  'esa-plan-quota',
  'esa-traffic',
  'esa-origin-5xx',
  'esa-edge-4xx-5xx',
  'esa-cache-hit',
  'esa-purge',
  'esa-edge-certificate',
  'ecs-disk',
  'nginx-origin',
  'app-container',
]

const WAF_RULES = {
  'admin-auth-abuse': ['admin-host', '/api/auth/**', 'observe-then-block'],
  'public-analytics-abuse': ['public-host', '/api/public/v1/analytics/events', 'observe-then-block'],
  'public-read-abuse': ['public-host', '/**', 'observe-then-challenge'],
}

function assertFrozenNull(value, label) {
  if (value !== null) {
    throw new Error(`${label} must stay null until T53 target-environment measurement.`)
  }
}

function assertExactIds(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} ids drifted from the frozen contract.`)
  }
}

export function validateSecurityObservabilityPolicy(policy) {
  if (!policy || typeof policy !== 'object' || policy.schemaVersion !== 1) {
    throw new Error('Security observability policy schemaVersion must be 1.')
  }

  const environment = policy.environmentPolicy
  if (
    environment?.freePlanPurpose !== 'development-and-validation-only'
    || environment.productionPlanRequired !== true
    || environment.productionPlanSource !== 'T53-F1/F2-live-confirmation'
  ) {
    throw new Error('Free and production plan boundaries drifted.')
  }
  assertFrozenNull(environment.productionPlan, 'Production plan')

  const https = policy.edgeHttps
  if (
    https?.forceHttps !== true
    || https.certificateManagement !== 'esa-managed'
    || https.certificateHostsSource !== 'T53-F1-exact-public-hosts'
    || https.originProtocol !== 'http'
    || https.originPort !== 80
    || https.originTlsEnabled !== false
  ) {
    throw new Error('ESA edge HTTPS or HTTP origin contract drifted.')
  }

  const origin = policy.originProtection
  if (
    origin?.requiredForProduction !== true
    || origin.allowEsaConvergedNodeIpsOnly !== true
    || JSON.stringify(origin.ecsPublicPorts) !== '[80]'
    || origin.appListen !== '127.0.0.1:3000'
    || origin.esaIpListSource !== 'T53-F2-console-current-list'
    || origin.ipListChangeRequiresReview !== true
  ) {
    throw new Error('Origin protection contract drifted.')
  }

  const waf = policy.waf
  if (
    waf?.managedProtectionEnabled !== true
    || waf.initialMode !== 'observe-first'
    || waf.targetModeSource !== 'T53-live-evidence'
    || !Array.isArray(waf.rules)
    || waf.rules.length !== Object.keys(WAF_RULES).length
  ) {
    throw new Error('WAF baseline contract drifted.')
  }
  assertExactIds(waf.rules.map(rule => rule.id), Object.keys(WAF_RULES), 'WAF rule')
  for (const rule of waf.rules) {
    const expected = WAF_RULES[rule.id]
    if (
      !expected
      || rule.hostScope !== expected[0]
      || rule.pathScope !== expected[1]
      || rule.metric !== 'client-ip'
      || rule.thresholdSource !== 'T53-live-measurement'
      || rule.action !== expected[2]
    ) {
      throw new Error(`WAF rule ${rule.id ?? '<unknown>'} drifted.`)
    }
    assertFrozenNull(rule.threshold, `WAF rule ${rule.id} threshold`)
  }

  const budget = policy.budget
  if (
    budget?.budgetSource !== 'T53-F1-user-confirmation'
    || budget.notificationOnly !== true
    || budget.automaticSpendStopClaimed !== false
    || budget.usageCapSource !== 'T53-F1/F2-plan-confirmation'
    || budget.meteringDelayAcknowledged !== true
  ) {
    throw new Error('Budget notification and metering-delay contract drifted.')
  }
  assertFrozenNull(budget.monthlyBudgetCny, 'Monthly budget')
  assertFrozenNull(budget.usageCapValue, 'Usage cap')

  const measurements = policy.measurements
  if (measurements?.thresholdsSource !== 'T53-target-environment') {
    throw new Error('Measurement thresholds must come from T53.')
  }
  for (const [key, value] of Object.entries(measurements)) {
    if (key !== 'thresholdsSource') {
      assertFrozenNull(value, `Measurement ${key}`)
    }
  }

  if (!Array.isArray(policy.alerts) || policy.alerts.length !== ALERT_IDS.length) {
    throw new Error('Alert checklist is incomplete.')
  }
  assertExactIds(policy.alerts.map(alert => alert.id), ALERT_IDS, 'Alert')
  for (const alert of policy.alerts) {
    if (
      !['esa', 'ecs'].includes(alert.source)
      || typeof alert.metric !== 'string'
      || !alert.metric
      || typeof alert.thresholdSource !== 'string'
      || !alert.thresholdSource.startsWith('T53-')
    ) {
      throw new Error(`Alert ${alert.id ?? '<unknown>'} is invalid.`)
    }
    assertFrozenNull(alert.threshold, `Alert ${alert.id} threshold`)
  }

  const host = policy.hostInvariants
  for (const key of [
    'nginxConfigTestRequired',
    'reloadRequiresSuccessfulConfigTest',
    'listen80Required',
    'listen443Forbidden',
    'acmeSchedulerForbidden',
    'certificateFilesForbidden',
    'httpOriginReadyRequired',
  ]) {
    if (host?.[key] !== true) {
      throw new Error(`Host invariant ${key} must remain enabled.`)
    }
  }

  return policy
}

export function validateObservabilityEvidenceTemplate(template) {
  if (!template || typeof template !== 'object' || template.schemaVersion !== 1) {
    throw new Error('Observability evidence template schemaVersion must be 1.')
  }
  if (
    template.capturedAt !== null
    || template.operator !== null
    || template.frozenCommit !== null
    || template.environment !== 'production'
    || template.redactionConfirmed !== false
    || JSON.stringify(template.notes) !== '[]'
  ) {
    throw new Error('Observability evidence metadata must remain an unfilled production template.')
  }

  const plan = template.planAndBudget
  if (
    plan?.esaPlan !== null
    || plan.quotaEvidence !== null
    || plan.monthlyBudgetCny !== null
    || plan.budgetNotificationConfigured !== false
    || plan.usageCapValue !== null
    || plan.meteringDelayWarningRecorded !== false
  ) {
    throw new Error('Plan and budget evidence template must remain unfilled.')
  }

  const security = template.edgeSecurity
  if (
    JSON.stringify(security?.exactHosts) !== '[]'
    || security.httpsForced !== false
    || JSON.stringify(security.esaManagedCertificates) !== '[]'
    || security.wafMode !== null
    || JSON.stringify(security.rateLimitThresholds) !== '[]'
    || security.originProtectionEnabled !== false
    || security.esaOriginIpsEvidence !== null
  ) {
    throw new Error('Edge security evidence template must remain unfilled.')
  }

  const measurements = template.measurements
  if (
    measurements?.artifact !== null
    || measurements.coldConditionProven !== false
    || measurements.coldConditionEvidence !== null
    || JSON.stringify(measurements.thresholdCalibration) !== '[]'
  ) {
    throw new Error('Measurement evidence template must remain unfilled.')
  }

  if (!Array.isArray(template.alerts)) {
    throw new Error('Evidence alert checklist is missing.')
  }
  assertExactIds(template.alerts, ALERT_IDS, 'Evidence alert')

  const host = template.hostVerification
  if (host?.artifact !== null) {
    throw new Error('Host verification artifact must be unfilled.')
  }
  for (const key of [
    'nginxConfigTest',
    'safeReloadTest',
    'listen80',
    'listen443Absent',
    'appLoopbackOnly',
    'acmeSchedulerAbsent',
    'certificateFilesAbsent',
    'httpOriginReady',
  ]) {
    if (host?.[key] !== false) {
      throw new Error(`Host evidence ${key} must remain unfilled.`)
    }
  }
  return template
}

export { ALERT_IDS }
