import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import { guardProductionContent } from '../../scripts/guard-production-content.mjs'

const temporaryDirectories: string[] = []

function temporaryDirectory() {
  const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-guard-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory => rmSync(
    directory,
    {
      force: true,
      recursive: true,
    },
  ))
})

describe('production content guard', () => {
  it('allows honest development fixtures but blocks them in production', async () => {
    const directory = temporaryDirectory()
    writeFileSync(
      resolve(directory, 'client.js'),
      '夹具演示 /fixtures/samples/example.jpg 接口尚未接入（T17）',
    )

    await expect(guardProductionContent({
      appEnv: 'development',
      roots: [directory],
    })).resolves.toEqual([])
    await expect(guardProductionContent({
      appEnv: 'production',
      roots: [directory],
    })).rejects.toThrow(/Production content guard blocked/)
  })

  it('allows production output without fixture or placeholder markers', async () => {
    const directory = temporaryDirectory()
    writeFileSync(resolve(directory, 'client.js'), '已发布作品')

    await expect(guardProductionContent({
      appEnv: 'production',
      roots: [directory],
    })).resolves.toEqual([])
  })

  it('does not skip a large generated text bundle', async () => {
    const directory = temporaryDirectory()
    writeFileSync(
      resolve(directory, 'large-client.js'),
      `${'x'.repeat(8_100_000)}接口尚未接入（T17）`,
    )

    await expect(guardProductionContent({
      appEnv: 'production',
      roots: [directory],
    })).rejects.toThrow(/Production content guard blocked/)
  })
})
