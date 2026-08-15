import { runR3StageABackupPruneCli } from './r3-stage-a-prune-backups'

try {
  process.stdout.write(`${JSON.stringify(runR3StageABackupPruneCli())}\n`)
}
catch (error) {
  process.stderr.write(`${(error as Error).message}\n`)
  process.exitCode = 1
}
