import {
  createHash,
  randomBytes,
} from 'node:crypto'
import {
  crc32,
  deflateSync,
} from 'node:zlib'

export const EXPECTED_PRIVATE_BUCKET = 'project-furry-forge-private'
export const EXPECTED_PUBLIC_BUCKET = 'project-furry-forge-public'
export const ORIGINAL_IMAGE_MAX_BYTES = 30_000_000
export const PREFLIGHT_IMAGE_MIN_BYTES = 20_000_000
export const REQUIRED_PUT_HEADERS = [
  'content-md5',
  'content-type',
  'x-oss-forbid-overwrite',
  'x-oss-meta-sha256',
]

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex')

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const output = Buffer.allocUnsafe(data.length + 12)

  output.writeUInt32BE(data.length, 0)
  typeBytes.copy(output, 4)
  data.copy(output, 8)
  output.writeUInt32BE(
    crc32(Buffer.concat([
      typeBytes,
      data,
    ])),
    data.length + 8,
  )

  return output
}

function createPng({
  width,
  height,
  colorType,
  channels,
  pixel,
}) {
  if (
    !Number.isInteger(width)
    || !Number.isInteger(height)
    || width < 1
    || height < 1
  ) {
    throw new Error('Synthetic PNG dimensions must be positive integers.')
  }

  const rowLength = (width * channels) + 1
  const raw = Buffer.allocUnsafe(rowLength * height)

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowLength
    raw[rowOffset] = 0

    for (let x = 0; x < width; x += 1) {
      pixel(raw, rowOffset + 1 + (x * channels), x, y)
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = colorType
  header[10] = 0
  header[11] = 0
  header[12] = 0

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 0 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

export function createLargeSyntheticPng() {
  let state = 0x6d2b79f5
  const image = createPng({
    width: 9_500,
    height: 1_030,
    channels: 3,
    colorType: 2,
    pixel(output, offset) {
      for (let channel = 0; channel < 3; channel += 1) {
        state ^= state << 13
        state ^= state >>> 17
        state ^= state << 5
        output[offset + channel] = state & 0xff
      }
    },
  })

  if (
    image.length < PREFLIGHT_IMAGE_MIN_BYTES
    || image.length > ORIGINAL_IMAGE_MAX_BYTES
  ) {
    throw new Error(
      `Synthetic PNG size ${image.length} is outside the 20,000,000–30,000,000 byte preflight boundary.`,
    )
  }

  return image
}

export function createSyntheticTransparentPng() {
  return createPng({
    width: 160,
    height: 64,
    channels: 4,
    colorType: 6,
    pixel(output, offset, x, y) {
      const border = x < 4 || x >= 156 || y < 4 || y >= 60
      const stripe = ((x >>> 3) + (y >>> 3)) % 2 === 0
      output[offset] = border ? 255 : stripe ? 50 : 255
      output[offset + 1] = border ? 255 : stripe ? 77 : 255
      output[offset + 2] = border ? 255 : stripe ? 175 : 255
      output[offset + 3] = border ? 255 : stripe ? 235 : 205
    },
  })
}

export function createSyntheticSourcePng(width, height) {
  return createPng({
    width,
    height,
    channels: 3,
    colorType: 2,
    pixel(output, offset, x, y) {
      output[offset] = (x * 17 + y * 3) & 0xff
      output[offset + 1] = (x * 5 + y * 11) & 0xff
      output[offset + 2] = (x * 7 + y * 13) & 0xff
    },
  })
}

export function contentDigests(content) {
  return {
    md5Base64: createHash('md5').update(content).digest('base64'),
    md5Hex: createHash('md5').update(content).digest('hex'),
    sha256: createHash('sha256').update(content).digest('hex'),
  }
}

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

export function urlSafeBase64(value) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

export function createRunId(now = new Date(), entropy = randomBytes(4)) {
  const timestamp = now.toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/u, 'Z')

  return `t10-${timestamp}-${Buffer.from(entropy).toString('hex')}`
}

function stringValues(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item))
  }

  if (value === undefined || value === null) {
    return []
  }

  return [String(value)]
}

export function evaluateCorsRules(rules, {
  origin,
  requiredHeaders = REQUIRED_PUT_HEADERS,
}) {
  const normalizedHeaders = requiredHeaders.map(header => header.toLowerCase())
  const details = rules.map((rule, index) => {
    const origins = stringValues(rule.allowedOrigin)
    const methods = stringValues(rule.allowedMethod)
      .map(method => method.toUpperCase())
    const headers = stringValues(rule.allowedHeader)
      .map(header => header.toLowerCase())
    const originAllowed = origins.includes(origin) || origins.includes('*')
    const methodAllowed = methods.includes('PUT')
    const headersAllowed = normalizedHeaders.every(
      header => headers.includes('*') || headers.includes(header),
    )

    return {
      index,
      sufficient: originAllowed && methodAllowed && headersAllowed,
      broadOrigin: origins.includes('*'),
      broadHeaders: headers.includes('*'),
      originAllowed,
      methodAllowed,
      headersAllowed,
    }
  })
  const matchingRule = details.find(rule => rule.sufficient)

  return {
    sufficient: Boolean(matchingRule),
    matchingRuleIndex: matchingRule?.index ?? null,
    broadOrigin: matchingRule?.broadOrigin ?? false,
    broadHeaders: matchingRule?.broadHeaders ?? false,
    checkedRuleCount: rules.length,
  }
}

export function parseImageInfo(content) {
  const parsed = JSON.parse(Buffer.isBuffer(content)
    ? content.toString('utf8')
    : String(content))
  const valueOf = key => parsed[key]?.value ?? parsed[key]?.Value

  return {
    format: valueOf('Format'),
    width: Number(valueOf('ImageWidth')),
    height: Number(valueOf('ImageHeight')),
    fileSize: Number(valueOf('FileSize')),
  }
}

export function ossErrorSummary(error) {
  const candidate = error && typeof error === 'object'
    ? error
    : {}
  const serviceError = candidate.data && typeof candidate.data === 'object'
    ? candidate.data
    : {}

  return {
    code: typeof candidate.code === 'string'
      ? candidate.code
      : typeof candidate.name === 'string'
        ? candidate.name
        : 'UnknownError',
    serviceCode: typeof serviceError.Code === 'string'
      ? serviceError.Code
      : null,
    serviceMessage: typeof serviceError.Message === 'string'
      ? serviceError.Message
      : null,
    status: typeof candidate.status === 'number'
      ? candidate.status
      : null,
    requestId: typeof candidate.requestId === 'string'
      ? candidate.requestId
      : null,
  }
}

export function requestIdOf(result) {
  return result?.res?.headers?.['x-oss-request-id']
    ?? result?.headers?.['x-oss-request-id']
    ?? null
}

export function responseHeader(result, name) {
  return result?.res?.headers?.[name.toLowerCase()]
    ?? result?.headers?.[name.toLowerCase()]
    ?? null
}
