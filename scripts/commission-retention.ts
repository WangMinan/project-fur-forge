import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { COMMISSION_DELETE_CONFIRMATION } from '../shared/schemas/commission'
import { getDatabase } from '../server/utils/database'
import { getExactObjectStore } from '../server/utils/exact-object-storage'
import {
  executeCommissionDeletion,
  listCommissionRetentionCandidates,
  previewCommissionDeletion,
} from '../server/utils/service/commission-retention'

export function parseCommissionRetentionCommand(args: string[]) {
  const { values } = parseArgs({
    args: args.filter(argument => argument !== '--'),
    options: {
      confirm: { type: 'string' },
      execute: { type: 'boolean' },
      identifier: { type: 'string' },
    },
  })
  if (!values.identifier) {
    if (values.execute || values.confirm) {
      throw new Error('Deletion requires one --identifier.')
    }
    return { kind: 'list' as const }
  }
  if (!values.execute) {
    return { identifier: values.identifier, kind: 'preview' as const }
  }
  if (values.confirm !== COMMISSION_DELETE_CONFIRMATION) {
    throw new Error(
      `Refusing deletion: pass --confirm "${COMMISSION_DELETE_CONFIRMATION}"`,
    )
  }
  return { identifier: values.identifier, kind: 'execute' as const }
}

export async function runCommissionRetentionCli(args = process.argv.slice(2)) {
  const command = parseCommissionRetentionCommand(args)
  const sqlite = getDatabase().sqlite
  if (command.kind === 'list') {
    return { candidates: listCommissionRetentionCandidates(sqlite) }
  }
  if (command.kind === 'preview') {
    return await previewCommissionDeletion({
      identifier: command.identifier,
      objectStore: getExactObjectStore(),
      sqlite,
    })
  }
  return await executeCommissionDeletion({
    actorUserId: null,
    identifier: command.identifier,
    objectStore: getExactObjectStore(),
    sqlite,
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${JSON.stringify(await runCommissionRetentionCli())}\n`)
}
