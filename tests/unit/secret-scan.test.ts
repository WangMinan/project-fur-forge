import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it('scans tracked Chinese filenames and reports locations without leaking values', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-secret-scan-'))
  const script = resolve('scripts/ci-secret-scan.mjs')
  const filename = '中文 需求.md'
  const syntheticSecret = 'LTAI' + '0123456789ABCDEF01234567'
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: directory })
    writeFileSync(resolve(directory, filename), '# 普通需求\n')
    execFileSync('git', ['add', '--', filename], { cwd: directory })
    const clean = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' })
    expect(clean.status).toBe(0)
    expect(clean.stdout).toContain('1 tracked files')

    writeFileSync(resolve(directory, filename), `${syntheticSecret}\n`)
    const rejected = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' })
    expect(rejected.status).toBe(1)
    expect(rejected.stderr).toContain(`${filename}:1 Aliyun access key id`)
    expect(rejected.stderr + rejected.stdout).not.toContain(syntheticSecret)
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
