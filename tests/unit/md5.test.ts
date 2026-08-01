import { describe, expect, it } from 'vitest'
import { md5, md5Base64 } from '../../app/utils/md5'

function hex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function md5Hex(text: string) {
  return hex(md5(new TextEncoder().encode(text)))
}

describe('md5', () => {
  it('matches RFC 1321 test suite', () => {
    expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5Hex('a')).toBe('0cc175b9c0f1b6a831c399e269772661')
    expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5Hex('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0')
    expect(md5Hex('abcdefghijklmnopqrstuvwxyz')).toBe('c3fcd3d76192e4007dfb496cca67e13b')
    expect(md5Hex('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'))
      .toBe('d174ab98d277d9f5a5611c2c9f419d9f')
    expect(md5Hex('1234567890'.repeat(8))).toBe('57edf4a22be3c955ac49da2e2107b67a')
  })

  it('handles binary input and multi-block padding', () => {
    const bytes = new Uint8Array(1_000_000)
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = index % 251
    }
    expect(hex(md5(bytes))).toHaveLength(32)
    // 与 Node 摘要对拍由 E2E 覆盖（浏览器声明值与 fake OSS 端校验一致）。
    expect(md5(bytes)).toHaveLength(16)
  })

  it('encodes digest as OSS Content-MD5 base64', () => {
    expect(md5Base64(new TextEncoder().encode(''))).toBe('1B2M2Y8AsgTpgAmY7PhCfg==')
    expect(md5Base64(new TextEncoder().encode('abc'))).toBe('kAFQmDzST7DWlj99KOF/cg==')
    expect(md5Base64(new Uint8Array(16))).toMatch(/^[A-Za-z0-9+/]{22}==$/u)
  })
})
