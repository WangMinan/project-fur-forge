import { parseArgs } from 'node:util'
import {
  resetAdminPasswordCommand,
} from '../server/utils/auth-commands'
import { loadRuntimeConfig } from '../server/utils/runtime-config'

const { values } = parseArgs({
  options: {
    confirm: {
      type: 'string',
    },
  },
})
const username = process.env.ADMIN_USERNAME?.trim()
const password = process.env.ADMIN_PASSWORD

if (!username || !password) {
  throw new Error(
    'ADMIN_USERNAME and ADMIN_PASSWORD are required.',
  )
}

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
