export const EXPECTED_PRIVATE_BUCKET: 'project-furry-forge-private'
export const EXPECTED_PUBLIC_BUCKET: 'project-furry-forge-public'
export const ORIGINAL_IMAGE_MAX_BYTES: 30_000_000
export const PREFLIGHT_IMAGE_MIN_BYTES: 20_000_000
export const REQUIRED_PUT_HEADERS: readonly string[]

export function createLargeSyntheticPng(): Buffer
export function createSyntheticWatermarkPng(): Buffer
export function contentDigests(content: Buffer): {
  md5Base64: string
  md5Hex: string
  sha256: string
}
export function sha256(content: Buffer): string
export function urlSafeBase64(value: string): string
export function createRunId(now?: Date, entropy?: Buffer): string
export function testPrefixFor(runId: string): string
export function assertExactObjectScope(options: {
  bucket: string
  expectedBucket: string
  key: string
  prefix: string
}): void
export function evaluateCorsRules(
  rules: ReadonlyArray<{
    allowedOrigin?: string | readonly string[]
    allowedMethod?: string | readonly string[]
    allowedHeader?: string | readonly string[]
  }>,
  options: {
    origin: string
    requiredHeaders?: readonly string[]
  },
): {
  sufficient: boolean
  matchingRuleIndex: number | null
  broadOrigin: boolean
  broadHeaders: boolean
  checkedRuleCount: number
}
export function parseImageInfo(content: Buffer | string): {
  format: string | undefined
  width: number
  height: number
  fileSize: number
}
export function ossErrorSummary(error: unknown): {
  code: string
  serviceCode: string | null
  serviceMessage: string | null
  status: number | null
  requestId: string | null
}
export function requestIdOf(result: unknown): string | null
export function responseHeader(
  result: unknown,
  name: string,
): string | null
