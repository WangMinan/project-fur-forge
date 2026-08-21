const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u

const requiredCollectionFacts = [
  /称呼/u,
  /物种/u,
  /手机(?:号码|号)/u,
  /QQ/iu,
  /身高/u,
  /体重/u,
  /设定图/u,
]

const legacyNoCollectionPatterns = [
  /不会通过[^。\n]{0,120}收集[^。\n]{0,120}(?:联系方式|联系信息|角色设定图)/u,
  /不主动收集[^。\n]{0,120}(?:联系方式|联系信息|角色设定图)/u,
]

/**
 * 委托申请唯一的隐私政策就绪判定。它只检查可稳定自动判断的发布事实，
 * 不尝试替代工作室的最终文案或法律审阅。
 */
export function privacyPolicyReadiness(policy, contactEmail) {
  const normalizedPolicy = typeof policy === 'string' ? policy.trim() : ''
  const normalizedEmail = typeof contactEmail === 'string'
    ? contactEmail.trim()
    : ''
  const reasons = []

  if (!normalizedPolicy) {
    reasons.push('POLICY_MISSING')
  }
  if (/\{\{[^{}]+\}\}/u.test(normalizedPolicy)) {
    reasons.push('POLICY_PLACEHOLDER')
  }
  if (legacyNoCollectionPatterns.some(pattern => pattern.test(normalizedPolicy))) {
    reasons.push('POLICY_LEGACY_NO_COLLECTION')
  }
  if (
    !normalizedPolicy.includes('个人信息处理者')
    || !normalizedPolicy.includes('有点小狗工作室')
  ) {
    reasons.push('POLICY_CONTROLLER_MISSING')
  }
  if (!requiredCollectionFacts.every(pattern => pattern.test(normalizedPolicy))) {
    reasons.push('POLICY_COLLECTION_SCOPE_INCOMPLETE')
  }
  if (
    normalizedEmail.length > 254
    || !emailPattern.test(normalizedEmail)
  ) {
    reasons.push('CONTACT_EMAIL_INVALID')
  }
  else if (!normalizedPolicy.toLowerCase().includes(normalizedEmail.toLowerCase())) {
    reasons.push('POLICY_CONTACT_EMAIL_MISSING')
  }

  return {
    ready: reasons.length === 0,
    reasons,
  }
}
