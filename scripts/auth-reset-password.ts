import { parseArgs } from 'node:util'
import {
  resetAdminPasswordCommand,
} from '../server/utils/service/auth-commands'
import { loadRuntimeConfig } from '../server/utils/runtime-config'
import { readAdminCredentials } from './auth-input'

const { values } = parseArgs({
  options: {
    confirm: {
      type: 'string',
    },
  },
})
const { password, username } = await readAdminCredentials(
  'New admin password: ',
)

const result = await resetAdminPasswordCommand(
  loadRuntimeConfig(),
  {
    username,
    password,
    confirmation: values.confirm ?? '',
  },
)

console.log(JSON.stringify({
  id: result.id,
  username: result.username,
  version: result.version,
}))
