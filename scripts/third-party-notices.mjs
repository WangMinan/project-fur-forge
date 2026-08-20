import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const JSON_OUTPUT = 'app/assets/licenses/third-party-notices.json'
const TEXT_OUTPUT = 'app/assets/licenses/THIRD_PARTY_NOTICES.txt'
const PUBLIC_TEXT_OUTPUT = 'public/THIRD_PARTY_NOTICES.txt'
const MANUAL_ASSETS = 'config/third-party-assets.json'

function stableCompare(left, right) {
  const leftKey = `${left.name}\u0000${left.version}\u0000${left.source}`
  const rightKey = `${right.name}\u0000${right.version}\u0000${right.source}`
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
}

function assertKnownLicense(license, name) {
  if (!license
    || /^(?:unknown|unlicensed|none|see license)$/iu.test(license.trim())) {
    throw new Error(`Unknown license for ${name}.`)
  }
}

function npmNotices(licenseReport) {
  const notices = []
  for (const [groupLicense, packages] of Object.entries(licenseReport)) {
    if (!Array.isArray(packages)) {
      throw new Error(`Invalid pnpm license group ${groupLicense}.`)
    }
    for (const pkg of packages) {
      const license = String(pkg.license ?? groupLicense).trim()
      const name = String(pkg.name ?? '').trim()
      assertKnownLicense(license, name || 'unnamed package')
      if (!name || !Array.isArray(pkg.versions) || pkg.versions.length === 0) {
        throw new Error(`Incomplete pnpm license entry in ${groupLicense}.`)
      }
      for (const version of pkg.versions) {
        notices.push({
          name,
          version: String(version),
          license,
          repository: null,
          homepage: typeof pkg.homepage === 'string' ? pkg.homepage : null,
          copyright: [],
          noticeText: null,
          source: 'pnpm-prod',
          usage: name === 'ffmpeg-static'
            ? 'Platform-specific FFmpeg executable provider npm package; separate from the Linux release-image binary registry.'
            : 'Installed production dependency in the application runtime closure.',
          artifactSha256: null,
          correspondingSourceUrl: null,
          sourceRevision: null,
          buildConfiguration: null,
          patches: [],
        })
      }
    }
  }
  return notices
}

function manualNotices(manualAssets, readAsset) {
  return manualAssets.map((asset) => {
    assertKnownLicense(asset.license, asset.name)
    const content = readAsset(asset.assetPath)
    return {
      name: asset.name,
      version: asset.version,
      license: asset.license,
      repository: null,
      homepage: asset.homepage,
      copyright: [],
      noticeText: asset.noticeText,
      source: 'manual-asset',
      usage: asset.usage,
      artifactSha256: createHash('sha256').update(content).digest('hex'),
      correspondingSourceUrl: asset.homepage,
      sourceRevision: null,
      buildConfiguration: null,
      patches: [],
    }
  })
}

export function buildThirdPartyNotices({
  licenseReport,
  manualAssets,
  readAsset,
}) {
  const notices = [
    ...npmNotices(licenseReport),
    ...manualNotices(manualAssets, readAsset),
  ].sort(stableCompare)
  const identities = new Set()
  for (const notice of notices) {
    const identity = `${notice.source}\u0000${notice.name}\u0000${notice.version}`
    if (identities.has(identity)) {
      throw new Error(`Duplicate third-party notice ${notice.name}@${notice.version}.`)
    }
    identities.add(identity)
  }
  return notices
}

export function renderThirdPartyNoticesText(notices) {
  const lines = [
    'DITE DOG - THIRD-PARTY NOTICES',
    '',
    'Generated deterministically from the installed production dependency closure and the reviewed asset registry.',
    'No Linux FFmpeg runtime-binary version, digest, source revision, patches, or build configuration is asserted until the release-image registry is completed.',
    '',
  ]
  for (const notice of notices) {
    lines.push(`${notice.name}@${notice.version}`)
    lines.push(`License: ${notice.license}`)
    lines.push(`Source class: ${notice.source}`)
    lines.push(`Usage: ${notice.usage}`)
    if (notice.homepage) lines.push(`Homepage: ${notice.homepage}`)
    if (notice.artifactSha256) lines.push(`Artifact SHA-256: ${notice.artifactSha256}`)
    if (notice.noticeText) lines.push(`Notice: ${notice.noticeText}`)
    lines.push('')
  }
  return `${lines.join('\n').trimEnd()}\n`
}

function loadPnpmLicenseReport() {
  const pnpmEntry = process.env.npm_execpath
  if (!pnpmEntry) {
    throw new Error('Run through pnpm so the exact package-manager entrypoint is available.')
  }
  const output = execFileSync(
    process.execPath,
    [pnpmEntry, 'licenses', 'list', '--prod', '--json'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  return JSON.parse(output)
}

export function generateThirdPartyNoticeArtifacts() {
  const manualAssets = JSON.parse(readFileSync(resolve(ROOT, MANUAL_ASSETS), 'utf8'))
  const notices = buildThirdPartyNotices({
    licenseReport: loadPnpmLicenseReport(),
    manualAssets,
    readAsset: path => readFileSync(resolve(ROOT, path)),
  })
  return {
    json: `${JSON.stringify(notices, null, 2)}\n`,
    text: renderThirdPartyNoticesText(notices),
  }
}

function run() {
  const check = process.argv.slice(2).includes('--check')
  const artifacts = generateThirdPartyNoticeArtifacts()
  const outputs = [
    [JSON_OUTPUT, artifacts.json],
    [TEXT_OUTPUT, artifacts.text],
    [PUBLIC_TEXT_OUTPUT, artifacts.text],
  ]
  if (check) {
    const drift = outputs.filter(([path, expected]) => {
      try {
        return readFileSync(resolve(ROOT, path), 'utf8') !== expected
      }
      catch {
        return true
      }
    }).map(([path]) => path)
    if (drift.length > 0) {
      throw new Error(`Third-party notice drift: ${drift.join(', ')}`)
    }
    return
  }
  for (const [path, content] of outputs) {
    writeFileSync(resolve(ROOT, path), content)
  }
}

if (process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
}
