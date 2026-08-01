// RFC 1321 MD5：浏览器 SubtleCrypto 不提供 MD5，OSS 条件 PUT 又要求
// Content-MD5，因此在上传声明里使用这份自包含实现（向量见 tests/unit/md5.test.ts）。

const SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const SINE_TABLE = new Uint32Array(64)
for (let index = 0; index < 64; index += 1) {
  SINE_TABLE[index] = Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32)
}

function rotateLeft(value: number, shift: number) {
  return (value << shift) | (value >>> (32 - shift))
}

export function md5(input: Uint8Array): Uint8Array {
  const bitLength = input.length * 8
  const paddedLength = ((input.length + 8) >>> 6) * 64 + 64
  const buffer = new Uint8Array(paddedLength)
  buffer.set(input)
  buffer[input.length] = 0x80
  const view = new DataView(buffer.buffer)
  view.setUint32(paddedLength - 8, bitLength >>> 0, true)
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 2 ** 32), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const words = new Uint32Array(16)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, true)
    }

    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let round = 0; round < 64; round += 1) {
      let f: number
      let wordIndex: number
      if (round < 16) {
        f = (b & c) | (~b & d)
        wordIndex = round
      }
      else if (round < 32) {
        f = (d & b) | (~d & c)
        wordIndex = (5 * round + 1) % 16
      }
      else if (round < 48) {
        f = b ^ c ^ d
        wordIndex = (3 * round + 5) % 16
      }
      else {
        f = c ^ (b | ~d)
        wordIndex = (7 * round) % 16
      }
      const sum = (a + f + SINE_TABLE[round]! + words[wordIndex]!) >>> 0
      a = d
      d = c
      c = b
      b = (b + rotateLeft(sum, SHIFTS[round]!)) >>> 0
    }

    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  const digest = new Uint8Array(16)
  const digestView = new DataView(digest.buffer)
  digestView.setUint32(0, a0, true)
  digestView.setUint32(4, b0, true)
  digestView.setUint32(8, c0, true)
  digestView.setUint32(12, d0, true)
  return digest
}

export function md5Base64(input: Uint8Array): string {
  const digest = md5(input)
  let binary = ''
  for (const byte of digest) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}
