import { describe, expect, it } from 'vitest'
import { privacyPolicyReadiness } from '../../shared/utils/privacy-policy-readiness.mjs'

const email = 'privacy@example.test'
const readyPolicy = `
个人信息处理者：有点小狗工作室
隐私联系邮箱：${email}
提交委托申请时，我们会处理称呼、物种、手机号码、QQ、身高、体重和设定图。
`

describe('commission privacy policy readiness', () => {
  it('accepts the current collection scope, controller and contact email', () => {
    expect(privacyPolicyReadiness(readyPolicy, email)).toEqual({
      ready: true,
      reasons: [],
    })
  })

  it('rejects placeholders, legacy no-collection copy and a missing policy email', () => {
    const result = privacyPolicyReadiness(`
      个人信息处理者：有点小狗工作室
      隐私联系邮箱：{{contact_email}}
      本站不主动收集姓名、联系方式或角色设定图。
    `, email)

    expect(result.ready).toBe(false)
    expect(result.reasons).toEqual(expect.arrayContaining([
      'POLICY_PLACEHOLDER',
      'POLICY_LEGACY_NO_COLLECTION',
      'POLICY_COLLECTION_SCOPE_INCOMPLETE',
      'POLICY_CONTACT_EMAIL_MISSING',
    ]))
  })
})
