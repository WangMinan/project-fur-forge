import {
  readdir,
  readFile,
} from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PRODUCTION_BLOCKED_CONTENT = [
  {
    label: 'unimplemented capability copy',
    pattern: /(?:尚未接入|接口未接入|真实保存能力将随\s*T\d+\s*接入)/u,
  },
  {
    label: 'fixture/demo copy',
    pattern: /(?:夹具演示|夹具数据|内部开发样张|视觉样张)/u,
  },
  {
    label: 'unapproved fixture media',
    pattern: /\/fixtures\//u,
  },
]

async function filesBelow(path) {
  const entries = await readdir(path, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const child = resolve(path, entry.name)
    if (entry.isDirectory()) {
      files.push(...await filesBelow(child))
    }
    else if (entry.isFile()) {
      files.push(child)
    }
  }

  return files
}

export async function findProductionContentLeaks(roots) {
  const leaks = []

  for (const root of roots) {
    for (const file of await filesBelow(resolve(root))) {
      const content = await readFile(file)
      if (content.includes(0)) {
        continue
      }

      const text = content.toString('utf8')
      for (const blocked of PRODUCTION_BLOCKED_CONTENT) {
        if (blocked.pattern.test(text)) {
          leaks.push({
            file,
            label: blocked.label,
          })
        }
      }
    }
  }

  return leaks
}

export async function guardProductionContent({
  appEnv,
  roots,
}) {
  if (appEnv !== 'production') {
    return []
  }

  const leaks = await findProductionContentLeaks(roots)
  if (leaks.length > 0) {
    const summary = leaks
      .map(leak => `${leak.label}: ${leak.file}`)
      .join('\n')
    throw new Error(
      `Production content guard blocked fixture or placeholder output.\n${summary}`,
    )
  }

  return leaks
}

const isEntrypoint = process.argv[1]
  && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isEntrypoint) {
  const roots = process.argv.slice(2)
  await guardProductionContent({
    appEnv: process.env.APP_ENV,
    roots: roots.length > 0 ? roots : ['.output'],
  })
}
