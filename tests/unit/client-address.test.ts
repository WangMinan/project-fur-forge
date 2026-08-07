import { describe, expect, it } from 'vitest'
import {
  isTrustedProxy,
  parseIpAddress,
  parseTrustedProxyCidrs,
  resolveTrustedClientAddress,
  subjectDigest,
} from '../../server/utils/route/client-address'
import {
  createSubjectLimiter,
} from '../../server/utils/route/request-rate-limit'

/**
 * T34-F5 可信代理与限流分桶。
 * 核心红线：不得任意信任 X-Forwarded-For。
 */
// 纯函数直接传入直连地址与转发头，不需要构造 H3 事件。

describe('trusted proxy resolution', () => {
  it('parses IPv4, IPv6 and IPv4-mapped addresses', () => {
    expect(parseIpAddress('10.0.0.1')?.version).toBe(4)
    expect(parseIpAddress('::1')?.version).toBe(6)
    expect(parseIpAddress('::ffff:10.0.0.1')?.version).toBe(4)
    expect(parseIpAddress('[2001:db8::1]')?.version).toBe(6)
    expect(parseIpAddress('not-an-ip')).toBeNull()
    expect(parseIpAddress('999.1.1.1')).toBeNull()
  })

  it('matches addresses against configured CIDRs only', () => {
    const cidrs = parseTrustedProxyCidrs('172.16.0.0/12, 10.1.2.3')
    expect(cidrs).toHaveLength(2)
    expect(isTrustedProxy('172.20.0.5', cidrs)).toBe(true)
    expect(isTrustedProxy('172.32.0.5', cidrs)).toBe(false)
    expect(isTrustedProxy('10.1.2.3', cidrs)).toBe(true)
    expect(isTrustedProxy('10.1.2.4', cidrs)).toBe(false)
    // 无效条目被忽略，不会意外放宽信任范围。
    expect(parseTrustedProxyCidrs('garbage, 10.0.0.0/99')).toHaveLength(0)
  })

  /**
   * 前缀匹配按十六进制串掩码实现，因此要覆盖"位数不是 4 的整数倍"的边界：
   * /12 与 /28 都落在半字节中间，掩码算错会让信任范围偏移。
   */
  it('masks prefixes that do not land on a hex character boundary', () => {
    // /12：172.16.0.0–172.31.255.255。
    const twelve = parseTrustedProxyCidrs('172.16.0.0/12')
    expect(isTrustedProxy('172.16.0.0', twelve)).toBe(true)
    expect(isTrustedProxy('172.31.255.255', twelve)).toBe(true)
    expect(isTrustedProxy('172.15.255.255', twelve)).toBe(false)
    expect(isTrustedProxy('172.32.0.0', twelve)).toBe(false)

    // /28：最后一个八位组的高 4 位参与匹配。
    const twentyEight = parseTrustedProxyCidrs('10.0.0.16/28')
    expect(isTrustedProxy('10.0.0.16', twentyEight)).toBe(true)
    expect(isTrustedProxy('10.0.0.31', twentyEight)).toBe(true)
    expect(isTrustedProxy('10.0.0.15', twentyEight)).toBe(false)
    expect(isTrustedProxy('10.0.0.32', twentyEight)).toBe(false)

    // /0 匹配全部同版本地址；/32 只匹配自身。
    expect(isTrustedProxy('203.0.113.1', parseTrustedProxyCidrs('0.0.0.0/0')))
      .toBe(true)
    const exact = parseTrustedProxyCidrs('10.1.2.3/32')
    expect(isTrustedProxy('10.1.2.3', exact)).toBe(true)
    expect(isTrustedProxy('10.1.2.2', exact)).toBe(false)

    // IPv6 同样按位掩码，且不与 IPv4 跨版本误判。
    const v6 = parseTrustedProxyCidrs('2001:db8::/33')
    expect(isTrustedProxy('2001:db8:7fff::1', v6)).toBe(true)
    expect(isTrustedProxy('2001:db8:8000::1', v6)).toBe(false)
    expect(isTrustedProxy('10.0.0.1', v6)).toBe(false)
  })

  it('ignores forwarded headers entirely when no proxy is trusted', () => {
    // 红线：未配置可信代理时，伪造的 X-Forwarded-For 必须完全无效。
    expect(resolveTrustedClientAddress('203.0.113.9', '1.2.3.4, 5.6.7.8', undefined))
      .toBe('203.0.113.9')
    expect(resolveTrustedClientAddress('203.0.113.9', '1.2.3.4, 5.6.7.8', ''))
      .toBe('203.0.113.9')
  })

  it('ignores forwarded headers when the direct peer is not a trusted proxy', () => {
    expect(resolveTrustedClientAddress('203.0.113.9', '1.2.3.4', '172.16.0.0/12'))
      .toBe('203.0.113.9')
  })

  it('uses the last untrusted hop when the direct peer is a trusted proxy', () => {
    // 从右往左跳过连续可信代理，取第一个非可信条目。
    expect(resolveTrustedClientAddress(
      '172.20.0.1', '198.51.100.7, 172.20.0.9', '172.16.0.0/12',
    )).toBe('198.51.100.7')
  })

  it('cannot be spoofed by claiming to be an internal proxy', () => {
    // 外部客户端把整条链都填成内网地址：解析结果回落到直连地址，
    // 而不是相信伪造的内网条目。
    expect(resolveTrustedClientAddress(
      '172.20.0.1', '172.20.0.5, 172.20.0.6', '172.16.0.0/12',
    )).toBe('172.20.0.1')
  })

  it('produces short non-reversible digests', () => {
    const digest = subjectDigest('203.0.113.9')
    expect(digest).toMatch(/^[0-9a-f]{16}$/u)
    expect(digest).not.toContain('203')
    expect(subjectDigest('203.0.113.9')).toBe(digest)
    expect(subjectDigest('203.0.113.10')).not.toBe(digest)
  })
})

describe('per-subject rate limiting', () => {
  it('isolates one subject from another', () => {
    const limit = createSubjectLimiter(2, 60_000)
    const now = 1_000
    expect(limit('a', now)).toBe(0)
    expect(limit('a', now)).toBe(0)
    // a 用尽后被拒绝……
    expect(limit('a', now)).toBeGreaterThan(0)
    // ……b 完全不受影响。这是本任务的关键：匿名流量不能耗尽管理员窗口。
    expect(limit('b', now)).toBe(0)
    expect(limit('b', now)).toBe(0)
    expect(limit('b', now)).toBeGreaterThan(0)
  })

  it('resets after the window elapses', () => {
    const limit = createSubjectLimiter(1, 1_000)
    expect(limit('a', 0)).toBe(0)
    expect(limit('a', 500)).toBeGreaterThan(0)
    expect(limit('a', 1_001)).toBe(0)
  })

  it('reports a positive retry-after in seconds', () => {
    const limit = createSubjectLimiter(1, 60_000)
    expect(limit('a', 0)).toBe(0)
    const retryAfter = limit('a', 1_000)
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(60)
  })
})
