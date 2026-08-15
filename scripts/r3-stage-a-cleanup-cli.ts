import { runR3StageACleanupCli } from './r3-stage-a-cleanup'

try {
  process.stdout.write(`${JSON.stringify(await runR3StageACleanupCli())}\n`)
}
catch (error) {
  process.stderr.write(`${(error as Error).message}\n`)
  process.exitCode = 1
}
