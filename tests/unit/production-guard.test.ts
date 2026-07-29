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
  it.each([
    ['unimplemented capability copy', '接口尚未接入（T17）'],
    ['fixture/demo copy', '夹具演示'],
    ['unapproved sample media', '/fixtures/samples/example.jpg'],
  ])('blocks %s in production', async (_label, content) => {
    const directory = temporaryDirectory()
    writeFileSync(
      resolve(directory, 'client.js'),
      content,
    )

    await expect(guardProductionContent({
      appEnv: 'production',
      roots: [directory],
    })).rejects.toThrow(/Production content guard blocked/)
  })

  it('allows honest fixture warnings in development and test', async () => {
    const directory = temporaryDirectory()
    writeFileSync(
      resolve(directory, 'client.js'),
      '夹具演示 /fixtures/samples/example.jpg 接口尚未接入（T17）',
    )

    for (const appEnv of ['development', 'test']) {
      await expect(guardProductionContent({
        appEnv,
        roots: [directory],
      })).resolves.toEqual([])
    }
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
