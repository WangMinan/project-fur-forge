import {
  initializeAdminCommand,
} from '../server/utils/auth-commands'
import { loadRuntimeConfig } from '../server/utils/runtime-config'
import { readAdminCredentials } from './auth-input'

const environmentUsername = process.env.ADMIN_USERNAME?.trim()
const environmentPassword = process.env.ADMIN_PASSWORD
const credentials = environmentUsername && environmentPassword
  ? { username: environmentUsername, password: environmentPassword }
  : await readAdminCredentials('Admin password: ')
const { password, username } = credentials

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
