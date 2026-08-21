import type Database from 'better-sqlite3'
import { privacyPolicyReadiness } from '../../../shared/utils/privacy-policy-readiness.mjs'
import { ServiceError } from '../service-error'

interface PrivacyPolicyRow {
  contactEmail: string
  privacyPolicy: string | null
}

export function getCommissionPrivacyPolicyReadiness(
  sqlite: Database.Database,
) {
  const row = sqlite.prepare(`
    SELECT privacy_policy AS privacyPolicy, contact_email AS contactEmail
    FROM site_content
    WHERE id = 'site'
  `).get() as PrivacyPolicyRow | undefined

  return privacyPolicyReadiness(row?.privacyPolicy, row?.contactEmail)
}

export function assertCommissionPrivacyPolicyReady(
  sqlite: Database.Database,
) {
  if (!getCommissionPrivacyPolicyReadiness(sqlite).ready) {
    throw new ServiceError(
      503,
      'SERVICE_UNAVAILABLE',
      'Commission applications are temporarily unavailable.',
      'COMMISSION_PRIVACY_POLICY_NOT_READY',
    )
  }
}
