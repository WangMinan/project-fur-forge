import {
  initializeAdminCommand,
} from '../server/utils/auth-commands'
import { loadRuntimeConfig } from '../server/utils/runtime-config'

const username = process.env.ADMIN_USERNAME?.trim()
const password = process.env.ADMIN_PASSWORD

if (!username || !password) {
  throw new Error(
    'ADMIN_USERNAME and ADMIN_PASSWORD are required.',
  )
}

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
