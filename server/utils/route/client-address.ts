import { createHash } from 'node:crypto'

/**
 * T34-F5 可信客户端地址解析。
 *
 * 默认**不信任任何** `X-Forwarded-For`：只有当直连地址落在明确配置的可信代理
 * 网段内时，才解析转发链，并从右往左跳过连续的可信代理跳数。
 * 这样外部客户端无法通过伪造转发头冒充其他来源或绕过限流分桶。
 *
 * 日志与限流只使用摘要，绝不记录完整地址。
 */

/**
 * 地址规范化为定长小写十六进制串（IPv4 8 位，IPv6 32 位）。
 *
 * 刻意不用 BigInt：Nitro 的 esbuild 目标是 es2019，BigInt 字面量属于 es2020，
 * 会在每次构建时告警「may crash at run-time」。前缀匹配本来就只需要按位掩码后
 * 比较，定长十六进制串的字符串前缀比较等价且无需大整数。
 */
interface Cidr {
  /** 掩码后的定长十六进制前缀，与 maskedHex 的输出同格式。 */
  bits: number
  prefix: string
  version: 4 | 6
}

const IPV6_HEX_LENGTH = 32

function hexGroup(value: number, width: number) {
  return value.toString(16).padStart(width, '0')
}

function ipv4ToHex(value: string) {
  const parts = value.split('.')
  if (parts.length !== 4) {
    return null
  }
  let result = ''
  for (const part of parts) {
    if (!/^\d{1,3}$/u.test(part)) {
      return null
    }
    const octet = Number(part)
    if (octet > 255) {
      return null
    }
    result += hexGroup(octet, 2)
  }
  return result
}

function ipv6ToHex(value: string) {
  const zoneless = value.split('%')[0]!
  if (!/^[0-9a-f:.]+$/iu.test(zoneless) || !zoneless.includes(':')) {
    return null
  }
  const [head, tail] = zoneless.split('::') as [string, string | undefined]
  const expand = (segment: string) => segment
    ? segment.split(':').filter(part => part !== '')
    : []
  const headParts = expand(head)
  const tailParts = tail === undefined ? [] : expand(tail)

  // 末段可能是 IPv4-mapped 形式。
  const normalize = (parts: string[]) => {
    const output: string[] = []
    for (const part of parts) {
      if (part.includes('.')) {
        const mapped = ipv4ToHex(part)
        if (mapped === null) {
          return null
        }
        // 4 字节 IPv4 恰好占两个 16 位组。
        output.push(mapped.slice(0, 4), mapped.slice(4))
        continue
      }
      if (!/^[0-9a-f]{1,4}$/iu.test(part)) {
        return null
      }
      output.push(part)
    }
    return output
  }

  const normalizedHead = normalize(headParts)
  const normalizedTail = normalize(tailParts)
  if (!normalizedHead || !normalizedTail) {
    return null
  }
  const missing = 8 - (normalizedHead.length + normalizedTail.length)
  if (tail === undefined) {
    if (normalizedHead.length !== 8) {
      return null
    }
  }
  else if (missing < 0) {
    return null
  }
  const groups = tail === undefined
    ? normalizedHead
    : [
        ...normalizedHead,
        ...Array.from({ length: missing }, () => '0'),
        ...normalizedTail,
      ]
  return groups
    .map(group => hexGroup(Number.parseInt(group, 16), 4))
    .join('')
}

export function parseIpAddress(value: string) {
  const trimmed = value.trim().replace(/^\[|\]$/gu, '')
  if (trimmed === '') {
    return null
  }
  // IPv4-mapped IPv6（::ffff:1.2.3.4）按 IPv4 比较。
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/iu.exec(trimmed)
  if (mapped) {
    const value4 = ipv4ToHex(mapped[1]!)
    return value4 === null ? null : { value: value4, version: 4 as const }
  }
  if (trimmed.includes(':')) {
    const value6 = ipv6ToHex(trimmed)
    return value6 === null || value6.length !== IPV6_HEX_LENGTH
      ? null
      : { value: value6, version: 6 as const }
  }
  const value4 = ipv4ToHex(trimmed)
  return value4 === null ? null : { value: value4, version: 4 as const }
}

/**
 * 按位掩码后返回定长十六进制串。
 * 逐 4 位（一个十六进制字符）处理：整字符保留，跨字符的余数按半字节掩码，
 * 其余补 0，因此结果仍是定长串，可直接做相等比较。
 */
function maskedHex(hex: string, bits: number) {
  const fullChars = Math.floor(bits / 4)
  const remainder = bits % 4
  let result = hex.slice(0, fullChars)
  if (remainder !== 0) {
    const nibble = Number.parseInt(hex[fullChars] ?? '0', 16)
    // remainder 位保留，低位清零。
    const mask = (0xf << (4 - remainder)) & 0xf
    result += (nibble & mask).toString(16)
  }
  return result.padEnd(hex.length, '0')
}

export function parseTrustedProxyCidrs(raw: string | undefined): Cidr[] {
  if (!raw) {
    return []
  }
  const cidrs: Cidr[] = []
  for (const entry of raw.split(',')) {
    const text = entry.trim()
    if (text === '') {
      continue
    }
    const [address, bitsText] = text.split('/')
    const parsed = parseIpAddress(address ?? '')
    if (!parsed) {
      continue
    }
    const width = parsed.version === 4 ? 32 : 128
    const bits = bitsText === undefined ? width : Number(bitsText)
    if (!Number.isInteger(bits) || bits < 0 || bits > width) {
      continue
    }
    cidrs.push({
      bits,
      prefix: maskedHex(parsed.value, bits),
      version: parsed.version,
    })
  }
  return cidrs
}

export function isTrustedProxy(address: string, cidrs: readonly Cidr[]) {
  const parsed = parseIpAddress(address)
  if (!parsed) {
    return false
  }
  return cidrs.some((cidr) => {
    if (cidr.version !== parsed.version) {
      return false
    }
    return maskedHex(parsed.value, cidr.bits) === cidr.prefix
  })
}

/**
 * 解析可信客户端地址。保持为纯函数：H3 相关的取值由调用方完成，
 * 因此这里可以被纯单元测试直接覆盖。
 *
 * - 直连地址不在可信代理网段内 → 直接使用直连地址，**完全忽略转发头**；
 * - 在可信网段内 → 从转发链右端向左跳过连续可信代理，取第一个非可信条目。
 */
export function resolveTrustedClientAddress(
  directAddress: string,
  forwardedFor: string | undefined,
  trustedProxyCidrs: string | undefined,
) {
  const direct = directAddress ?? ''
  const cidrs = parseTrustedProxyCidrs(trustedProxyCidrs)
  if (cidrs.length === 0 || !isTrustedProxy(direct, cidrs)) {
    return direct
  }
  const chain = (forwardedFor ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry !== '')
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const candidate = chain[index]!
    if (!isTrustedProxy(candidate, cidrs)) {
      return candidate
    }
  }
  return direct
}

/** 限流分桶与日志只使用摘要，不出现完整地址或用户名。 */
export function subjectDigest(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}
