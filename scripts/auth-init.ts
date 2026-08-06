import {
  initializeAdminCommand,
} from '../server/utils/service/auth-commands'
import { loadRuntimeConfig } from '../server/utils/runtime-config'
import { readAdminCredentials } from './auth-input'

const { password, username } = await readAdminCredentials(
  'Admin password: ',
)

const result = await initializeAdminCommand(
  loadRuntimeConfig(),
  {
    username,
    password,
  },
)

console.log(JSON.stringify({
  created: result.created,
  id: result.id,
  username: result.username,
}))
